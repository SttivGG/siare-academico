package com.siare.core;

import com.siare.core.application.port.in.*;
import com.siare.core.application.port.out.*;
import com.siare.core.application.service.*;
import com.siare.core.domain.activity.*;
import com.siare.core.domain.document.*;
import com.siare.core.domain.account.User;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Same suite runs against H2 or an explicitly isolated MySQL via H3_TEST_MYSQL_URL. */
@SpringBootTest
@AutoConfigureMockMvc(print=org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint.NONE)
@ActiveProfiles("test")
class ActivityApiTests {
    @DynamicPropertySource static void storage(DynamicPropertyRegistry p) {
        String url=System.getenv("H3_TEST_MYSQL_URL");
        if(url==null || url.isBlank()) p.add("spring.datasource.url",()->"jdbc:h2:mem:siare_h3;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE");
        else {
            // Prevent accidentally targeting the application's durable database.
            if(!url.contains("/siare_h3_test?")) throw new IllegalStateException("H3 tests require the isolated siare_h3_test database");
            p.add("spring.datasource.url",()->url);
            p.add("spring.datasource.username",()->System.getenv("H3_TEST_MYSQL_USER"));
            p.add("spring.datasource.password",()->System.getenv("H3_TEST_MYSQL_PASSWORD"));
            p.add("spring.datasource.driver-class-name",()->"com.mysql.cj.jdbc.Driver");
        }
    }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired ActivityUseCase activities;
    @Autowired SubjectUseCase subjects;
    @Autowired UserRepository users;
    @Autowired SessionService sessions;
    @Autowired DocumentRepository documents;
    @Autowired JdbcTemplate db;
    @Autowired ActivityRepository repository;
    @Autowired AttemptOutbox outbox;
    @Autowired TransactionPort tx;
    UUID owner,subject,foreign;
    String token,foreignToken;
    @BeforeEach void setup() {
        reset(documents);
        owner=UUID.randomUUID(); foreign=UUID.randomUUID();
        for(UUID user:List.of(owner,foreign)) users.save(new User(user,"H3 test",user+"@example.test","unused-test-hash",Instant.now()));
        subject=subjects.create(owner,"H3 pruebas",null).id();
        token=sessions.open(owner).accessToken(); foreignToken=sessions.open(foreign).accessToken();
    }
    SavedActivity quiz() { return activities.create(owner,subject,ActivityFamily.QUIZ,null,"Repaso",ActivityFixtures.quizBank(),2,15); }
    String path(UUID activity) { return "/api/v1/activities/"+activity; }
    Map<String,Object> submission(UUID key,Map<String,String> answers) { return Map.of("idempotencyKey",key,"answers",answers,"durationMs",45000); }
    JsonNode create(ActivityFamily family,ActivityBank bank,int count) throws Exception {
        var result=mvc.perform(post("/api/v1/subjects/"+subject+"/activities").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("type",family,"topic","Repaso","bank",bank,"count",count,"gridSize",15))))
                .andExpect(status().isCreated()).andExpect(header().string("Cache-Control","no-store")).andReturn();
        return json.readTree(result.getResponse().getContentAsString());
    }
    @Test void allActivityEndpointsRequireBearerAndRevokedSessionCannotAccess() throws Exception {
        var activity=quiz(); UUID attempt=UUID.randomUUID();
        for(String url:List.of("/api/v1/subjects/"+subject+"/activities",path(activity.activityId()),path(activity.activityId())+"/submissions/"+attempt))
            mvc.perform(get(url)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/subjects/"+subject+"/activities").contentType(MediaType.APPLICATION_JSON).content("{}" )).andExpect(status().isUnauthorized());
        mvc.perform(post(path(activity.activityId())+"/submissions").contentType(MediaType.APPLICATION_JSON).content("{}" )).andExpect(status().isUnauthorized());
        sessions.logout(owner,UUID.fromString(sessionsJwtSession(token)));
        mvc.perform(get(path(activity.activityId())).header("Authorization","Bearer "+token)).andExpect(status().isUnauthorized());
    }
    String sessionsJwtSession(String jwt) { return json.readTree(new String(Base64.getUrlDecoder().decode(jwt.split("\\.")[1]),java.nio.charset.StandardCharsets.UTF_8)).get("sid").asText(); }
    @Test void createReadListAndEvaluateQuizNeverExposesKeysUntilSubmission() throws Exception {
        var created=create(ActivityFamily.QUIZ,ActivityFixtures.quizBank(),2); UUID id=UUID.fromString(created.get("activityId").asText());
        assertThat(created.at("/content/questions").size()).isEqualTo(2);
        assertThat(created.toString()).doesNotContain("correctOptionId","explanation","expected","answer_key","protectedSnapshot");
        mvc.perform(get(path(id)).header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.content.questions[0].correctOptionId").doesNotExist());
        mvc.perform(get("/api/v1/subjects/"+subject+"/activities").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].activityId").value(id.toString())).andExpect(jsonPath("$.items[0].content").doesNotExist());
        var sent=mvc.perform(post(path(id)+"/submissions").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(submission(UUID.randomUUID(),Map.of("q1","a","q2","b")))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.score").value(0.5)).andExpect(jsonPath("$.percentage").value(50)).andExpect(jsonPath("$.points").value(1)).andReturn();
        var result=json.readTree(sent.getResponse().getContentAsString());
        evidence("quiz",created); evidence("result",result);
        assertThat(result.get("studentId").asText()).isEqualTo(owner.toString());
        mvc.perform(get(path(id)+"/submissions/"+result.get("attemptId").asText()).header("Authorization","Bearer "+token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.score").value(0.5)).andExpect(jsonPath("$.items[0].expected").value("a"));
        assertThat(db.queryForObject("SELECT COUNT(*) FROM academic_attempt_outbox WHERE event_id=? AND status='PENDING'",Integer.class,result.get("eventId").asText())).isEqualTo(1);
        var event=json.readTree(db.queryForObject("SELECT payload_json FROM academic_attempt_outbox WHERE event_id=?",String.class,result.get("eventId").asText()));
        assertThat(event.get("schemaVersion").asInt()).isEqualTo(1); assertThat(event.get("source").asText()).isEqualTo("core-api");
        assertThat(event.toString()).doesNotContain("answers","expected","rationale","prompt");
    }
    @Test void crosswordApiProvidesEmptyCellsCluesAndRealScore() throws Exception {
        var created=create(ActivityFamily.CROSSWORD,ActivityFixtures.wordBank("SOL","LUNA"),2);
        evidence("crossword",created);
        String publicJson=created.toString(); assertThat(publicJson).doesNotContain("SOL","LUNA","answer","placements");
        assertThat(created.at("/content/clues").size()).isEqualTo(2); assertThat(created.at("/content/cells").size()).isEqualTo(6);
        mvc.perform(post(path(UUID.fromString(created.get("activityId").asText()))+"/submissions").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(submission(UUID.randomUUID(),Map.of("w1","sól","w2","sol")))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.score").value(0.5)).andExpect(jsonPath("$.items[0].feedback").exists());
    }
    @Test void ownershipAppliesToCreationListingReadingSubmissionAndResult() throws Exception {
        var activity=quiz(); var result=activities.submit(owner,activity.activityId(),UUID.randomUUID(),Map.of(),0);
        for(String url:List.of("/api/v1/subjects/"+subject+"/activities",path(activity.activityId()),path(activity.activityId())+"/submissions/"+result.attemptId()))
            mvc.perform(get(url).header("Authorization","Bearer "+foreignToken)).andExpect(status().isForbidden());
        mvc.perform(post(path(activity.activityId())+"/submissions").header("Authorization","Bearer "+foreignToken).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(submission(UUID.randomUUID(),Map.of())))).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/subjects/"+subject+"/activities").header("Authorization","Bearer "+foreignToken).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("type","QUIZ","topic","Repaso","count",2,"gridSize",15,"bank",ActivityFixtures.quizBank())))).andExpect(status().isForbidden());
    }
    @Test void sequentialAndConcurrentRetriesAreDurableAndConflictingBodiesFail() throws Exception {
        var activity=quiz(); UUID key=UUID.randomUUID(); var answers=Map.of("q1","a","q2","b");
        var pool=Executors.newFixedThreadPool(6); var barrier=new CyclicBarrier(6);
        try {
            var futures=new ArrayList<Future<AttemptResult>>();
            for(int i=0;i<6;i++) futures.add(pool.submit(()->{ barrier.await(10,TimeUnit.SECONDS); return activities.submit(owner,activity.activityId(),key,answers,45000); }));
            var results=new ArrayList<AttemptResult>(); for(var future:futures) results.add(future.get(30,TimeUnit.SECONDS));
            assertThat(results).extracting(AttemptResult::attemptId).containsOnly(results.getFirst().attemptId());
            assertThat(results).extracting(AttemptResult::eventId).containsOnly(results.getFirst().eventId());
            assertThat(activities.submit(owner,activity.activityId(),key,new LinkedHashMap<>(Map.of("q2","b","q1","a")),45000)).isEqualTo(results.getFirst());
            assertThat(db.queryForObject("SELECT COUNT(*) FROM academic_attempts WHERE activity_id=?",Integer.class,activity.activityId().toString())).isEqualTo(1);
            assertThat(db.queryForObject("SELECT COUNT(*) FROM academic_attempt_outbox WHERE attempt_id=?",Integer.class,results.getFirst().attemptId().toString())).isEqualTo(1);
        } finally { pool.shutdownNow(); }
        assertThatThrownBy(()->activities.submit(owner,activity.activityId(),key,Map.of("q1","b"),45000)).isInstanceOf(ActivityException.class).hasMessageContaining("idempotencia");
        assertThatThrownBy(()->activities.submit(owner,activity.activityId(),key,answers,1)).isInstanceOf(ActivityException.class);
    }
    @Test void differentConcurrentAttemptsRemainIndependentAndHaveSeparateEvents() throws Exception {
        var activity=quiz(); var pool=Executors.newFixedThreadPool(2);
        try {
            var a=pool.submit(()->activities.submit(owner,activity.activityId(),UUID.randomUUID(),Map.of("q1","a","q2","a"),1));
            var b=pool.submit(()->activities.submit(owner,activity.activityId(),UUID.randomUUID(),Map.of(),1));
            assertThat(a.get(15,TimeUnit.SECONDS).score()).isEqualTo(1); assertThat(b.get(15,TimeUnit.SECONDS).score()).isZero();
            assertThat(db.queryForObject("SELECT COUNT(*) FROM academic_attempts WHERE activity_id=?",Integer.class,activity.activityId().toString())).isEqualTo(2);
        } finally { pool.shutdownNow(); }
    }
    @Test void attemptAndOutboxRollBackTogether() {
        var activity=quiz(); var result=activities.submit(owner,activity.activityId(),UUID.randomUUID(),Map.of(),0);
        long before=db.queryForObject("SELECT COUNT(*) FROM academic_attempts WHERE activity_id=?",Long.class,activity.activityId().toString());
        var candidate=new AttemptResult(UUID.randomUUID(),UUID.randomUUID(),owner,subject,activity.activityId(),ActivityFamily.QUIZ,0,0,0,2,0,Instant.now(),"test",result.items());
        assertThatThrownBy(()->tx.required(()->{ repository.saveAttempt(UUID.randomUUID(),"a".repeat(64),candidate); throw new IllegalStateException("Simulated crash before commit"); })).isInstanceOf(RuntimeException.class).hasMessageContaining("Simulated crash");
        assertThat(db.queryForObject("SELECT COUNT(*) FROM academic_attempts WHERE activity_id=?",Long.class,activity.activityId().toString())).isEqualTo(before);
        assertThat(db.queryForObject("SELECT COUNT(*) FROM academic_attempt_outbox WHERE event_id=?",Integer.class,candidate.eventId().toString())).isZero();
    }
    DocumentMetadata document(UUID id,UUID documentOwner,UUID documentSubject,DocumentStatus status) {
        return new DocumentMetadata(id,documentSubject,documentOwner,"grid-test","bank.pdf","application/pdf",10,"sha",status,Instant.now(),Instant.now(),null,UUID.randomUUID(),null);
    }
    @Test void foreignDocumentWrongSubjectNotReadyAndEmptyTextAreRejected() {
        UUID id=UUID.randomUUID();
        when(documents.find(id)).thenReturn(Optional.of(document(id,foreign,subject,DocumentStatus.READY)));
        assertThatThrownBy(()->activities.create(owner,subject,ActivityFamily.QUIZ,id,"Repaso",ActivityFixtures.quizBank(),1,15)).hasMessageContaining("acceso");
        var another=subjects.create(owner,"Otra",null);
        when(documents.find(id)).thenReturn(Optional.of(document(id,owner,another.id(),DocumentStatus.READY)));
        assertThatThrownBy(()->activities.create(owner,subject,ActivityFamily.QUIZ,id,"Repaso",ActivityFixtures.quizBank(),1,15)).hasMessageContaining("pertenece");
        when(documents.find(id)).thenReturn(Optional.of(document(id,owner,subject,DocumentStatus.UPLOADED)));
        assertThatThrownBy(()->activities.create(owner,subject,ActivityFamily.QUIZ,id,"Repaso",ActivityFixtures.quizBank(),1,15)).isInstanceOf(ActivityException.class).hasMessageContaining("READY");
        var ready=document(id,owner,subject,DocumentStatus.READY); when(documents.find(id)).thenReturn(Optional.of(ready));
        when(documents.content(id,ready.operationId())).thenReturn(Optional.of(new ExtractedContent("PDF","",List.of(),1,List.of(),"READY")));
        assertThatThrownBy(()->activities.create(owner,subject,ActivityFamily.QUIZ,id,"Repaso",null,1,15)).isInstanceOf(ActivityException.class);
    }
    @Test void readyStructuredDocumentGeneratesWithVerifiedEvidenceAndPublicSourceHasNoQuote() throws Exception {
        UUID id=UUID.randomUUID(); var ready=document(id,owner,subject,DocumentStatus.READY);
        var original=ActivityFixtures.quizBank().questions().getFirst(); String quote="2 + 2 = 4.";
        var source=new ActivityBank.Source("Página 1",0,quote);
        var question=new ActivityBank.Question(original.id(),original.prompt(),original.options(),original.correctOptionId(),original.topic(),source,original.explanation());
        var bank=new ActivityBank(true,List.of(question),List.of()); String structured=json.writeValueAsString(bank);
        when(documents.find(id)).thenReturn(Optional.of(ready));
        when(documents.content(id,ready.operationId())).thenReturn(Optional.of(new ExtractedContent("PDF",structured,List.of(new ExtractedContent.Fragment(0,"page",1,structured)),1,List.of(),"READY")));
        var saved=activities.create(owner,subject,ActivityFamily.QUIZ,id,"Repaso",null,1,15);
        var response=mvc.perform(get(path(saved.activityId())).header("Authorization","Bearer "+token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.documentId").value(id.toString())).andExpect(jsonPath("$.content.questions[0].source.fragmentIndex").value(0)).andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain("quote","2 + 2 = 4.","correctOptionId");
        when(documents.content(id,ready.operationId())).thenReturn(Optional.of(new ExtractedContent("PDF","Texto libre sin banco",List.of(new ExtractedContent.Fragment(0,"page",1,"Texto libre sin banco")),1,List.of(),"READY")));
        assertThatThrownBy(()->activities.create(owner,subject,ActivityFamily.QUIZ,id,"Repaso",null,1,15)).isInstanceOf(ActivityException.class);
        assertThatThrownBy(()->activities.create(owner,subject,ActivityFamily.QUIZ,id,"Repaso",bank,1,15)).isInstanceOf(ActivityException.class).hasMessageContaining("sustentadas");
    }
    @Test void emptyBankBadOptionsUnknownAnswersAndArchivedSubjectHaveControlledErrors() throws Exception {
        mvc.perform(post("/api/v1/subjects/"+subject+"/activities").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"type\":\"QUIZ\",\"topic\":\"Repaso\",\"count\":1,\"gridSize\":15}"))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("INSUFFICIENT_CONTENT"));
        var activity=quiz();
        mvc.perform(post(path(activity.activityId())+"/submissions").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(submission(UUID.randomUUID(),Map.of("other","a")))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION"));
        subjects.archive(owner,subject);
        assertThatThrownBy(this::quiz).hasMessageContaining("archivada");
        assertThatThrownBy(()->activities.submit(owner,activity.activityId(),UUID.randomUUID(),Map.of(),0)).hasMessageContaining("archivada");
        assertThat(activities.get(owner,activity.activityId())).isNotNull();
    }
    @Test void listingHasStableCursorAndNoDuplicateItems() throws Exception {
        quiz(); quiz(); quiz();
        var response=mvc.perform(get("/api/v1/subjects/"+subject+"/activities?limit=2").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andReturn();
        var page=json.readTree(response.getResponse().getContentAsString()); assertThat(page.get("items").size()).isEqualTo(2);
        var next=mvc.perform(get("/api/v1/subjects/"+subject+"/activities?limit=2&cursor="+page.get("nextCursor").asText()).header("Authorization","Bearer "+token)).andExpect(status().isOk()).andReturn();
        var last=json.readTree(next.getResponse().getContentAsString()); assertThat(last.get("items").size()).isEqualTo(1); assertThat(last.get("nextCursor").isNull()).isTrue();
        assertThat(last.at("/items/0/activityId").asText()).isNotEqualTo(page.at("/items/0/activityId").asText()).isNotEqualTo(page.at("/items/1/activityId").asText());
    }
    @Test void clientCannotSetIdentityScoreOrServerIdsAndIdempotencyConflictUses409() throws Exception {
        var activity=quiz(); UUID key=UUID.randomUUID();
        var request=new LinkedHashMap<>(submission(key,Map.of("q1","a")));
        for(String field:List.of("studentId","score","attemptId","eventId")) {
            request.put(field,field.equals("score")?1:foreign.toString());
            mvc.perform(post(path(activity.activityId())+"/submissions").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(request))).andExpect(status().isBadRequest());
            request.remove(field);
        }
        activities.submit(owner,activity.activityId(),key,Map.of("q1","a"),45000);
        mvc.perform(post(path(activity.activityId())+"/submissions").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(submission(key,Map.of("q1","b")))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("IDEMPOTENCY_CONFLICT"));
    }
    @Test void durableOutboxRecoversFromTransportFailureExpiredLeaseAndDuplicateDelivery() {
        var activity=quiz(); var result=activities.submit(owner,activity.activityId(),UUID.randomUUID(),Map.of(),0);
        // Restrict claims to this test event while preserving every other test's rows.
        var future=Instant.now().plusSeconds(10000);
        db.update("UPDATE academic_attempt_outbox SET available_at=? WHERE status='PENDING'",java.sql.Timestamp.from(future));
        db.update("UPDATE academic_attempt_outbox SET available_at=? WHERE event_id=?",java.sql.Timestamp.from(Instant.now().minusSeconds(1)),result.eventId().toString());
        Clock now=Clock.systemUTC(); var failing=new AttemptOutboxDispatcher(outbox,event->{ throw new IllegalStateException("offline"); },now);
        assertThat(failing.dispatch(1)).isZero();
        assertThat(db.queryForObject("SELECT status FROM academic_attempt_outbox WHERE event_id=?",String.class,result.eventId().toString())).isEqualTo("PENDING");
        Instant recovered=Instant.now().plusSeconds(60); var claimed=outbox.claim(recovered,1); assertThat(claimed).hasSize(1);
        assertThat(outbox.claim(recovered,1)).isEmpty(); // live lease is exclusive
        var delivered=new ArrayList<AttemptEvent>();
        var recovery=new AttemptOutboxDispatcher(outbox,delivered::add,Clock.fixed(recovered.plusSeconds(121),ZoneOffset.UTC));
        assertThat(recovery.dispatch(1)).isEqualTo(1); assertThat(delivered).extracting(AttemptEvent::eventId).containsExactly(result.eventId());
        outbox.retry(claimed.getFirst(),recovered); // stale worker must not undo successful delivery
        assertThat(recovery.dispatch(1)).isZero();
    }
    void evidence(String name,JsonNode value) throws java.io.IOException {
        String directory=System.getenv("H3_TEST_EVIDENCE_DIR");
        if(directory!=null && !directory.isBlank()) {
            var root=java.nio.file.Path.of(directory); java.nio.file.Files.createDirectories(root);
            java.nio.file.Files.writeString(root.resolve(name+".json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(value));
        }
    }
}
