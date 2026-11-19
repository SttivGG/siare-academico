package com.siare.core;

import com.siare.core.application.port.in.AcademicDraftUseCase;
import com.siare.core.application.port.out.AcademicDraftRepository;
import com.siare.core.application.service.*;
import com.siare.core.domain.draft.DraftLifecycleException;
import java.nio.file.*;
import java.time.*;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.*;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.*;

/** Explicit second JVM over the same persistent MySQL after a database restart. */
@Tag("real-stores")
@SpringBootTest
@ActiveProfiles("test")
class AcademicDraftRestartTests {
    @DynamicPropertySource static void storage(DynamicPropertyRegistry p) {
        if (System.getenv("H5D_TEST_MYSQL_URL") == null) throw new IllegalStateException("Requires isolated H5D MySQL");
        AcademicDraftLifecycleTests.storage(p);
    }
    @Autowired AcademicDraftUseCase drafts;
    @Autowired AcademicDraftRepository repository;
    @Autowired GenerateAcademicDraftService generation;
    @Autowired com.siare.core.application.port.in.ActivityUseCase activities;
    @Autowired com.siare.core.application.port.out.TransactionPort tx;
    @Autowired ObjectMapper json;
    @Test void persistedContentFingerprintRevisionExpiryAndIdempotentPublicationSurviveRestart() throws Exception {
        var data = json.readTree(Files.readString(Path.of(System.getenv("H5D_TEST_EVIDENCE_DIR"), "restart.json")));
        UUID owner = UUID.fromString(data.get("owner").asText()), pending = UUID.fromString(data.get("pending").asText()),
                published = UUID.fromString(data.get("published").asText()), key = UUID.fromString(data.get("key").asText());
        var view = drafts.get(owner, pending); assertThat(view.draft().validated()).isFalse(); assertThat(view.draftRevision()).isEqualTo(1);
        var stored = repository.find(pending, false).orElseThrow();
        assertThat(stored.extractionFingerprint()).isEqualTo(data.get("fingerprint").asText());
        assertThat(view.expiresAt()).isEqualTo(Instant.parse(data.get("expiresAt").asText()));
        var result = drafts.publish(owner, published, 1, true, key);
        assertThat(result.replayed()).isTrue(); assertThat(result.activity().activityId().toString()).isEqualTo(data.get("activity").asText());
        var expired = new AcademicDraftService(generation, repository, activities, tx, Clock.fixed(view.expiresAt(), ZoneOffset.UTC));
        assertThatThrownBy(() -> expired.get(owner, pending)).isInstanceOf(DraftLifecycleException.class)
                .satisfies(ex -> assertThat(((DraftLifecycleException)ex).code()).isEqualTo("DRAFT_EXPIRED"));
        assertThatThrownBy(() -> expired.publish(owner, pending, 1, true, UUID.randomUUID())).isInstanceOf(DraftLifecycleException.class)
                .satisfies(ex -> assertThat(((DraftLifecycleException)ex).code()).isEqualTo("DRAFT_EXPIRED"));
    }
}
