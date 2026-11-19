package com.siare.core;

import com.siare.core.application.port.in.*;
import com.siare.core.application.port.out.*;
import com.siare.core.application.service.*;
import com.siare.core.domain.account.User;
import com.siare.core.domain.activity.*;
import com.siare.core.domain.document.*;
import com.siare.core.domain.draft.*;
import com.siare.core.domain.draft.AcademicDraft.*;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.*;
import org.springframework.boot.webmvc.test.autoconfigure.*;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;
import static com.siare.core.AcademicDraftContractTests.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real persistence and HTTP security; only the ML producer and Mongo port use synthetic fixtures. */
@SpringBootTest
@AutoConfigureMockMvc(print=MockMvcPrint.NONE)
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
class AcademicDraftLifecycleTests {
    @DynamicPropertySource static void storage(DynamicPropertyRegistry p) {
        String url = System.getenv("H5D_TEST_MYSQL_URL");
        if (url == null || url.isBlank()) p.add("spring.datasource.url", () -> "jdbc:h2:mem:siare_h5d;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE");
        else {
            if (!url.matches("jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/siare_h5d_test\\?.*")) throw new IllegalStateException("Requires isolated loopback siare_h5d_test");
            p.add("spring.datasource.url", () -> url);
            p.add("spring.datasource.username", () -> System.getenv("H5D_TEST_MYSQL_USER"));
            p.add("spring.datasource.password", () -> System.getenv("H5D_TEST_MYSQL_PASSWORD"));
            p.add("spring.datasource.driver-class-name", () -> "com.mysql.cj.jdbc.Driver");
        }
    }
    @Autowired AcademicDraftUseCase production;
    @Autowired AcademicDraftRepository drafts;
    @Autowired ActivityUseCase activities;
    @Autowired IdentityRepository identities;
    @Autowired SubjectUseCase subjects;
    @Autowired UserRepository users;
    @Autowired DocumentRepository documents;
    @Autowired SessionService sessions;
    @Autowired TransactionPort tx;
    @Autowired JdbcTemplate db;
    @Autowired ObjectMapper json;
    @Autowired MockMvc mvc;
    UUID owner, foreign, subject;
    String token, foreignToken;
    MutableClock clock;
    AcademicDraftService service;
    Request fixture;
    DocumentMetadata metadata;
    ExtractedContent content;
    static final class MutableClock extends Clock {
        Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
    @BeforeEach void setup() {
        reset(documents); clock = new MutableClock(); owner = UUID.randomUUID(); foreign = UUID.randomUUID();
        for (UUID user : List.of(owner, foreign)) users.save(new User(user, "Synthetic H5D", user + "@example.test", "unused-hash", clock.instant()));
        subject = subjects.create(owner, "H5D pruebas", null).id();
        token = sessions.open(owner).accessToken(); foreignToken = sessions.open(foreign).accessToken();
        fixture("quiz");
        var generation = new GenerateAcademicDraftService(identities, subjects, documents, AcademicDraftContractTests::echo, new DraftAdmission(clock));
        service = new AcademicDraftService(generation, drafts, activities, tx, clock);
    }
    void fixture(String family) {
        fixture = request(family);
        metadata = new DocumentMetadata(fixture.documentId(), subject, owner, "synthetic-grid-id", "synthetic.pdf", "application/pdf", 10, "synthetic-checksum",
                DocumentStatus.READY, clock.instant(), clock.instant(), null, UUID.fromString(fixture.extractionVersion().substring(10)), null);
        content = new ExtractedContent("PDF", String.join("\n", fixture.fragments().stream().map(Fragment::text).toList()) + "\nUNSELECTED_PRIVATE_TEXT",
                fixture.fragments().stream().map(f -> new ExtractedContent.Fragment(f.index(), f.unitType(), f.unitNumber(), f.text())).toList(),
                fixture.fragments().size(), fixture.extractionWarnings(), "READY");
        when(documents.find(fixture.documentId())).thenAnswer(i -> Optional.of(metadata));
        when(documents.content(eq(fixture.documentId()), any())).thenAnswer(i -> Optional.of(content));
    }
    Selection selection() { return new Selection(fixture.documentId(), fixture.extractionVersion(), fixture.type(), fixture.topic(), fixture.count(), fixture.gridSize(), fixture.fragments().stream().map(Fragment::index).toList()); }
    AcademicDraftUseCase.View create() { return service.create(owner, subject, selection()); }
    String path(UUID id) { return "/api/v1/activity-drafts/" + id; }
    String publishBody(int revision, UUID key) { return json.writeValueAsString(Map.of("draftRevision", revision, "reviewConfirmed", true, "idempotencyKey", key)); }
    Bank edited(Bank bank) {
        var q = bank.questions().getFirst();
        return new Bank(false, List.of(new Question(q.id(), q.prompt() + " (revisada)", q.options(), q.correctOptionId(), q.topic(), q.source(), q.explanation() + " Revisada.")), List.of());
    }
    void code(Runnable action, String code) {
        assertThatThrownBy(action::run).isInstanceOfAny(DraftLifecycleException.class, DraftGenerationException.class)
                .satisfies(e -> assertThat(e instanceof DraftLifecycleException l ? l.code() : ((DraftGenerationException)e).code()).isEqualTo(code));
    }
    @Test void createPersistsPrivateDraftAndExpiresIn24HoursWithoutRetainingDocumentText() throws Exception {
        var view = create(); var stored = drafts.find(view.draftId(), false).orElseThrow();
        assertThat(service.get(owner, view.draftId())).isEqualTo(view);
        assertThat(view.draft().validated()).isFalse(); assertThat(view.qualityAppliesToRevision()).isEqualTo(1);
        assertThat(stored.expiresAt()).isEqualTo(stored.createdAt().plus(Duration.ofHours(24)));
        assertThat(stored.extractionFingerprint()).hasSize(64);
        assertThat(db.queryForObject("SELECT private_response_json FROM academic_drafts WHERE id=?", String.class, view.draftId().toString())).doesNotContain("UNSELECTED_PRIVATE_TEXT");
        mvc.perform(get(path(view.draftId())).header("Authorization", "Bearer " + token)).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store")).andExpect(jsonPath("$.draft.validated").value(false))
                .andExpect(jsonPath("$.ownerId").doesNotExist()).andExpect(jsonPath("$.extractionFingerprint").doesNotExist());
        assertThat(view.toString() + stored.toString() + view.draft().toString()).doesNotContain(view.draft().questions().getFirst().explanation());
    }
    @Test void editIncrementsRevisionAndDoesNotReattributeMlQuality() throws Exception {
        var original = create(); var bank = edited(original.draft());
        mvc.perform(put(path(original.draftId())).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("draftRevision", 1, "draft", bank))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.draftRevision").value(2))
                .andExpect(jsonPath("$.qualityAppliesToRevision").value(1)).andExpect(jsonPath("$.draft.validated").value(false));
        code(() -> service.revise(owner, original.draftId(), 1, bank), "DRAFT_REVISION_CONFLICT");
        assertThat(service.get(owner, original.draftId()).draft()).isEqualTo(bank);
        var key = UUID.randomUUID();
        code(() -> service.publish(owner, original.draftId(), 1, true, key), "DRAFT_REVISION_CONFLICT");
        assertThat(service.publish(owner, original.draftId(), 2, true, key).activity().documentId()).isEqualTo(fixture.documentId());
    }
    @ParameterizedTest @ValueSource(strings={"quiz", "crossword"})
    void publishesThroughRealH3AndReplaysAfterLostResponseWithoutLeakingSolutions(String family) throws Exception {
        fixture(family); var view = create(); var key = UUID.randomUUID();
        String body = publishBody(1, key);
        var first = mvc.perform(post(path(view.draftId()) + "/publish").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andExpect(header().string("Cache-Control", "no-store")).andReturn().getResponse();
        var retry = mvc.perform(post(path(view.draftId()) + "/publish").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse();
        assertThat(retry.getContentAsString()).isEqualTo(first.getContentAsString()); assertThat(retry.getHeader("Location")).isEqualTo(first.getHeader("Location"));
        assertThat(first.getContentAsString()).doesNotContain("correctOptionId", "explanation", "quote", "placements", "answer");
        var stored = drafts.find(view.draftId(), false).orElseThrow();
        assertThat(activities.get(owner, stored.activityId()).content().family()).isEqualTo(fixture.type());
        var answers = new HashMap<String,String>();
        view.draft().questions().forEach(q -> answers.put(q.id(), q.correctOptionId())); view.draft().words().forEach(w -> answers.put(w.id(), w.answer()));
        assertThat(activities.submit(owner, stored.activityId(), UUID.randomUUID(), answers, 1).score()).isEqualTo(1);
        mvc.perform(get(path(view.draftId())).header("Authorization", "Bearer " + token)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DRAFT_ALREADY_PUBLISHED")).andExpect(jsonPath("$.fields.activityId").value(stored.activityId().toString()));
        code(() -> service.revise(owner, view.draftId(), 1, view.draft()), "DRAFT_ALREADY_PUBLISHED");
        code(() -> service.publish(owner, view.draftId(), 1, true, UUID.randomUUID()), "DRAFT_ALREADY_PUBLISHED");
        code(() -> service.publish(owner, view.draftId(), 2, true, key), "IDEMPOTENCY_CONFLICT");
        clock.now = clock.now.plus(Duration.ofDays(2)); subjects.archive(owner, subject);
        assertThat(service.publish(owner, view.draftId(), 1, true, key).activity().activityId()).isEqualTo(stored.activityId());
    }
    @Test void simultaneousPublicationsCommitOneActivityAndOneDurableKey() throws Exception {
        var view = create(); var key = UUID.randomUUID(); var barrier = new CyclicBarrier(6); var pool = Executors.newFixedThreadPool(6);
        try {
            var calls = new ArrayList<Future<AcademicDraftUseCase.Publication>>();
            for (int i=0; i<6; i++) calls.add(pool.submit(() -> { barrier.await(10, TimeUnit.SECONDS); return service.publish(owner, view.draftId(), 1, true, key); }));
            var results = new ArrayList<AcademicDraftUseCase.Publication>(); for (var call : calls) results.add(call.get(30, TimeUnit.SECONDS));
            assertThat(results.stream().map(r -> r.activity().activityId()).distinct()).hasSize(1);
            assertThat(results.stream().filter(r -> !r.replayed())).hasSize(1);
            assertThat(db.queryForObject("SELECT COUNT(*) FROM academic_activities WHERE subject_id=?", Integer.class, subject.toString())).isEqualTo(1);
        } finally { pool.shutdownNow(); }
    }
    @Test void concurrentEditsUseOptimisticRevisionCheck() throws Exception {
        var view = create(); var barrier = new CyclicBarrier(2); var pool = Executors.newFixedThreadPool(2);
        try {
            Callable<String> action = () -> { barrier.await(10, TimeUnit.SECONDS); try { service.revise(owner, view.draftId(), 1, edited(view.draft())); return "OK"; }
                catch (DraftLifecycleException ex) { return ex.code(); } };
            var a = pool.submit(action); var b = pool.submit(action);
            assertThat(List.of(a.get(30, TimeUnit.SECONDS), b.get(30, TimeUnit.SECONDS))).containsExactlyInAnyOrder("OK", "DRAFT_REVISION_CONFLICT");
        } finally { pool.shutdownNow(); }
    }
    @Test void rollbackAfterH3InsertLeavesDraftUnpublishedAndKeyReusable() {
        var view = create(); var key = UUID.randomUUID(); ActivityUseCase failing = mock(ActivityUseCase.class);
        when(failing.create(any(), any(), any(), any(), any(), any(), anyInt(), anyInt())).thenAnswer(i -> {
            activities.create(i.getArgument(0), i.getArgument(1), i.getArgument(2), i.getArgument(3), i.getArgument(4), i.getArgument(5), i.getArgument(6), i.getArgument(7));
            throw new IllegalStateException("Synthetic failure after H3 insert");
        });
        var generation = new GenerateAcademicDraftService(identities, subjects, documents, AcademicDraftContractTests::echo, new DraftAdmission(clock));
        var faulty = new AcademicDraftService(generation, drafts, failing, tx, clock);
        assertThatThrownBy(() -> faulty.publish(owner, view.draftId(), 1, true, key)).hasMessageContaining("Synthetic failure");
        assertThat(db.queryForObject("SELECT COUNT(*) FROM academic_activities WHERE subject_id=?", Integer.class, subject.toString())).isZero();
        assertThat(drafts.find(view.draftId(), false).orElseThrow().activityId()).isNull();
        assertThat(service.publish(owner, view.draftId(), 1, true, key).replayed()).isFalse();
    }
    @Test void changedDocumentAfterH3InsertRollsBackAndSameOperationTextMutationIsDetected() {
        var view = create(); var original = content;
        var generation = new GenerateAcademicDraftService(identities, subjects, documents, AcademicDraftContractTests::echo, new DraftAdmission(clock));
        ActivityUseCase changed = mock(ActivityUseCase.class);
        when(changed.create(any(), any(), any(), any(), any(), any(), anyInt(), anyInt())).thenAnswer(i -> {
            var result = activities.create(i.getArgument(0), i.getArgument(1), i.getArgument(2), i.getArgument(3), i.getArgument(4), i.getArgument(5), i.getArgument(6), i.getArgument(7));
            content = new ExtractedContent(original.fileType(), original.text() + " changed", original.fragments(), original.unitCount(), original.warnings(), "READY"); return result;
        });
        code(() -> new AcademicDraftService(generation, drafts, changed, tx, clock).publish(owner, view.draftId(), 1, true, UUID.randomUUID()), "EXTRACTION_CHANGED");
        assertThat(db.queryForObject("SELECT COUNT(*) FROM academic_activities WHERE subject_id=?", Integer.class, subject.toString())).isZero();
        code(() -> service.publish(owner, view.draftId(), 1, true, UUID.randomUUID()), "EXTRACTION_CHANGED");
        code(() -> service.revise(owner, view.draftId(), 1, view.draft()), "EXTRACTION_CHANGED");
    }
    @Test void exactExpiryArchivedSubjectAndMissingConfirmationPreventPublication() throws Exception {
        var view = create(); var key = UUID.randomUUID(); var start = clock.now;
        clock.now = start.plus(Duration.ofHours(24)).minusNanos(1); assertThat(service.get(owner, view.draftId())).isNotNull();
        clock.now = start.plus(Duration.ofHours(24));
        code(() -> service.get(owner, view.draftId()), "DRAFT_EXPIRED");
        code(() -> service.revise(owner, view.draftId(), 1, view.draft()), "DRAFT_EXPIRED");
        code(() -> service.publish(owner, view.draftId(), 1, true, key), "DRAFT_EXPIRED");
        clock.now = start;
        for (String confirmation : List.of("false", "null")) mvc.perform(post(path(view.draftId()) + "/publish").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"draftRevision\":1,\"reviewConfirmed\":" + confirmation + ",\"idempotencyKey\":\"" + key + "\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("REVIEW_REQUIRED"));
        subjects.archive(owner, subject); code(() -> service.publish(owner, view.draftId(), 1, true, key), "SUBJECT_ARCHIVED");
    }
    @Test void foreignUsersAnonymousAndDisabledIdentityCannotReadEditPublishOrReplay() throws Exception {
        var view = create(); var key = UUID.randomUUID();
        mvc.perform(get(path(view.draftId()))).andExpect(status().isUnauthorized()).andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(get(path(view.draftId())).header("Authorization", "Bearer " + foreignToken)).andExpect(status().isForbidden());
        mvc.perform(put(path(view.draftId())).header("Authorization", "Bearer " + foreignToken).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("draftRevision", 1, "draft", view.draft())))).andExpect(status().isForbidden());
        mvc.perform(post(path(view.draftId()) + "/publish").header("Authorization", "Bearer " + foreignToken).contentType(MediaType.APPLICATION_JSON)
                .content(publishBody(1, key))).andExpect(status().isForbidden());
        service.publish(owner, view.draftId(), 1, true, key);
        code(() -> service.publish(foreign, view.draftId(), 1, true, key), "FORBIDDEN");
        db.update("UPDATE user_access SET enabled=FALSE WHERE user_id=?", owner.toString());
        code(() -> service.publish(owner, view.draftId(), 1, true, key), "FORBIDDEN");
    }
    @Test void rejectsUnsupportedAnswersCitationsValidatedBanksAndForgedAuthorityFields() throws Exception {
        var view = create(); var q = view.draft().questions().getFirst();
        var wrongSource = new Source(q.source().reference(), q.source().fragmentIndex(), q.source().unitType(), q.source().unitNumber(), "Invented citation");
        var wrongReference = new Source("Página 99", q.source().fragmentIndex(), q.source().unitType(), q.source().unitNumber(), q.source().quote());
        for (var source : List.of(wrongSource, wrongReference)) code(() -> service.revise(owner, view.draftId(), 1,
                new Bank(false, List.of(new Question(q.id(), q.prompt(), q.options(), q.correctOptionId(), q.topic(), source, q.explanation())), List.of())), "INVALID_DRAFT_CONTENT");
        code(() -> service.revise(owner, view.draftId(), 1, new Bank(true, view.draft().questions(), List.of())), "INVALID_DRAFT_CONTENT");
        code(() -> service.revise(owner, view.draftId(), 1, new Bank(false, List.of(new Question(q.id(), q.prompt(), q.options(), "missing", q.topic(), q.source(), q.explanation())), List.of())), "INVALID_DRAFT_CONTENT");
        for (String field : List.of("ownerId", "quality", "generatorVersion", "score")) mvc.perform(put(path(view.draftId())).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("draftRevision", 1, "draft", view.draft(), field, "forged"))))
                .andExpect(status().isBadRequest()).andExpect(header().string("Cache-Control", "no-store"));
        assertThat(service.get(owner, view.draftId()).draftRevision()).isEqualTo(1);
    }
    @Test void productionCreationRemainsDisabledAndNoSyntheticCreationEndpointExists() throws Exception {
        code(() -> production.create(owner, subject, selection()), "GENERATION_DISABLED");
        mvc.perform(post("/api/v1/subjects/" + subject + "/activity-drafts").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(selection()))).andExpect(status().isNotFound());
    }
    @Test void changedVersionNotReadyAndReassignedDocumentBlockPublication() {
        var view = create(); var original = metadata;
        metadata = new DocumentMetadata(original.documentId(), subject, owner, original.gridfsId(), original.originalFilename(), original.contentType(), original.sizeBytes(), original.checksum(),
                DocumentStatus.READY, original.createdAt(), original.processedAt(), null, UUID.randomUUID(), null);
        code(() -> service.publish(owner, view.draftId(), 1, true, UUID.randomUUID()), "EXTRACTION_CHANGED");
        metadata = new DocumentMetadata(original.documentId(), subject, owner, original.gridfsId(), original.originalFilename(), original.contentType(), original.sizeBytes(), original.checksum(),
                DocumentStatus.UPLOADED, original.createdAt(), original.processedAt(), null, original.operationId(), null);
        code(() -> service.publish(owner, view.draftId(), 1, true, UUID.randomUUID()), "TEXT_NOT_READY");
        metadata = new DocumentMetadata(original.documentId(), subject, foreign, original.gridfsId(), original.originalFilename(), original.contentType(), original.sizeBytes(), original.checksum(),
                DocumentStatus.READY, original.createdAt(), original.processedAt(), null, original.operationId(), null);
        code(() -> service.publish(owner, view.draftId(), 1, true, UUID.randomUUID()), "FORBIDDEN");
        assertThat(drafts.find(view.draftId(), false).orElseThrow().activityId()).isNull();
    }
    @Test void crosswordClueExplanationAndNormalizedAnswerCanBeRevisedThenPublished() {
        fixture("crossword"); var view = create(); var word = view.draft().words().getFirst();
        var words = new ArrayList<>(view.draft().words());
        words.set(0, new Word(word.id(), word.answer().toLowerCase(Locale.ROOT), word.clue() + " Revisada.", word.topic(), word.source(), word.explanation() + " Revisada."));
        var revised = service.revise(owner, view.draftId(), 1, new Bank(false, List.of(), words));
        assertThat(revised.draftRevision()).isEqualTo(2); assertThat(revised.qualityAppliesToRevision()).isEqualTo(1);
        assertThat(service.publish(owner, view.draftId(), 2, true, UUID.randomUUID()).activity().content().family()).isEqualTo(ActivityFamily.CROSSWORD);
        assertThat(drafts.find(view.draftId(), false).orElseThrow().response().draft().words().getFirst().explanation()).endsWith("Revisada.");
    }
    @Test void h3ImpossibleCrosswordKeepsReviewAndDoesNotConsumePublicationKey() {
        fixture("crossword");
        String text = "AAA y BBB son palabras sintéticas sin letras comunes.";
        content = new ExtractedContent("PDF", text, List.of(new ExtractedContent.Fragment(0, "page", 1, text)), 1, List.of(), "READY");
        var s = selection(); s = new Selection(s.documentId(), s.extractionVersion(), s.type(), s.topic(), 2, 5, List.of(0));
        AcademicDraftGenerator synthetic = r -> {
            var source = new Source("Página 1", 0, "page", 1, text);
            var bank = new Bank(false, List.of(), List.of(new Word("a", "AAA", "Primera", r.topic(), source, "Cita sintética."), new Word("b", "BBB", "Segunda", r.topic(), source, "Cita sintética.")));
            return new Response(1, r.requestId(), r.documentId(), r.extractionVersion(), r.type(), r.topic(), r.count(), "DRAFT", "synthetic-test", bank, List.of(), new Quality(true, new Checks(true,true,true,true,true,true)));
        };
        var generation = new GenerateAcademicDraftService(identities, subjects, documents, synthetic, new DraftAdmission(clock));
        var custom = new AcademicDraftService(generation, drafts, activities, tx, clock); var view = custom.create(owner, subject, s);
        assertThatThrownBy(() -> custom.publish(owner, view.draftId(), 1, true, UUID.randomUUID())).isInstanceOf(ActivityException.class)
                .satisfies(e -> assertThat(((ActivityException)e).code()).isEqualTo("INVALID_CROSSWORD"));
        assertThat(custom.get(owner, view.draftId()).draftRevision()).isEqualTo(1);
        assertThat(drafts.find(view.draftId(), false).orElseThrow().publicationKey()).isNull();
        assertThat(db.queryForObject("SELECT COUNT(*) FROM academic_activities WHERE subject_id=?", Integer.class, subject.toString())).isZero();
    }
    @Test void publicWireRejectsMissingFieldsDuplicateKeysCoercionAndOversizedBodies() throws Exception {
        var view = create(); var key = UUID.randomUUID();
        String good = json.writeValueAsString(Map.of("draftRevision", 1, "draft", view.draft()));
        for (String bad : List.of(good.replace("\"validated\":false,", ""), good.replace("\"draftRevision\":1", "\"draftRevision\":\"1\""),
                good.replace("\"draftRevision\":1", "\"draftRevision\":1,\"draftRevision\":1"), good.replace("\"fragmentIndex\":0", "\"fragmentIndex\":null"),
                good + " {}")) mvc.perform(put(path(view.draftId())).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(bad))
                .andExpect(status().isBadRequest()).andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(put(path(view.draftId())).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content(" ".repeat(2*1024*1024+1))).andExpect(status().isPayloadTooLarge());
        mvc.perform(post(path(view.draftId()) + "/publish").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content(publishBody(1, key).replace("\"reviewConfirmed\":true", "\"reviewConfirmed\":\"true\"")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("REVIEW_REQUIRED"));
        assertThat(service.get(owner, view.draftId()).draftRevision()).isEqualTo(1);
    }
    @Test void recordsCommittedDraftsForSecondJvmAndDatabaseRestart() throws Exception {
        String directory = System.getenv("H5D_TEST_EVIDENCE_DIR");
        Assumptions.assumeTrue(directory != null && !directory.isBlank(), "Explicit real-store restart run only");
        var pending = create(); var published = create(); var key = UUID.randomUUID();
        var saved = service.publish(owner, published.draftId(), 1, true, key).activity();
        Path root = Path.of(directory); Files.createDirectories(root);
        Files.writeString(root.resolve("restart.json"), json.writeValueAsString(Map.of("owner", owner, "pending", pending.draftId(), "published", published.draftId(),
                "activity", saved.activityId(), "key", key, "expiresAt", pending.expiresAt(), "fingerprint", drafts.find(pending.draftId(), false).orElseThrow().extractionFingerprint())));
    }
    @Test void privateSolutionsCitationsBearerAndRejectedCredentialsStayOutOfLogs(CapturedOutput output) throws Exception {
        var view = create(); var q = view.draft().questions().getFirst(); String secret = "H5D_PRIVATE_SENTINEL_FOR_LOG_TEST";
        var bank = new Bank(false, List.of(new Question(q.id(), q.prompt(), q.options(), q.correctOptionId(), q.topic(), q.source(), secret)), List.of());
        mvc.perform(put(path(view.draftId())).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("draftRevision", 1, "draft", bank)))).andExpect(status().isOk());
        mvc.perform(get(path(view.draftId())).header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        mvc.perform(post(path(view.draftId()) + "/publish").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("draftRevision", 2, "reviewConfirmed", true, "idempotencyKey", UUID.randomUUID(), "serviceToken", secret))))
                .andExpect(status().isBadRequest());
        assertThat(output.getAll()).doesNotContain(secret, q.source().quote(), token);
    }
}
