package com.siare.core;

import com.siare.core.application.port.in.ActivityUseCase;
import com.siare.core.domain.activity.ActivityFamily;
import java.nio.file.*;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.*;

/** Second JVM: read the previous run's committed result without regenerating activity or keys. */
@Tag("real-stores")
@SpringBootTest
@ActiveProfiles("test")
class ActivityRestartTests {
    @DynamicPropertySource static void storage(DynamicPropertyRegistry p) {
        if(System.getenv("H3_TEST_MYSQL_URL")==null || System.getenv("H3_TEST_MYSQL_URL").isBlank()) throw new IllegalStateException("Requires isolated H3 MySQL");
        ActivityApiTests.storage(p);
    }
    @Autowired ActivityUseCase activities;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate db;
    @Test void committedActivityResultAndPendingEventSurviveApplicationRestart() throws Exception {
        var previous=json.readTree(Files.readString(Path.of(System.getenv("H3_TEST_EVIDENCE_DIR"),"result.json")));
        UUID owner=UUID.fromString(previous.get("studentId").asText()),id=UUID.fromString(previous.get("activityId").asText());
        var activity=activities.get(owner,id); assertThat(activity.content().family()).isEqualTo(ActivityFamily.QUIZ);
        var result=activities.result(owner,id,UUID.fromString(previous.get("attemptId").asText()));
        assertThat(result.score()).isEqualTo(0.5); assertThat(result.points()).isEqualTo(1);
        assertThat(result.eventId().toString()).isEqualTo(previous.get("eventId").asText());
        assertThat(db.queryForObject("SELECT status FROM academic_attempt_outbox WHERE event_id=?",String.class,result.eventId().toString())).isEqualTo("PENDING");
    }
}
