package com.siare.core;

import com.siare.core.application.port.in.*;
import com.siare.core.application.port.out.*;
import com.siare.core.application.service.*;
import com.siare.core.domain.draft.AcademicDraft.*;
import com.siare.core.domain.document.*;
import com.siare.core.domain.identity.*;
import com.siare.core.domain.subject.Subject;
import com.siare.core.infrastructure.config.AcademicDraftConfiguration;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import static com.siare.core.AcademicDraftContractTests.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AcademicDraftServiceTests {
    UUID owner = UUID.randomUUID(), subject = UUID.randomUUID();
    Request fixture = request("quiz");
    IdentityRepository identities = mock(IdentityRepository.class);
    SubjectUseCase subjects = mock(SubjectUseCase.class);
    DocumentRepository documents = mock(DocumentRepository.class);
    AcademicDraftGenerator generator = mock(AcademicDraftGenerator.class);
    Instant now = Instant.parse("2026-11-19T18:00:00Z");
    Clock clock = Clock.fixed(now, ZoneOffset.UTC);
    AtomicReference<DocumentMetadata> metadata = new AtomicReference<>();
    AtomicReference<ExtractedContent> content = new AtomicReference<>();
    GenerateAcademicDraftService service;
    Selection selection;
    @BeforeEach void setup() {
        when(identities.access(owner)).thenReturn(new UserAccess(owner, Role.USER, UUID.randomUUID(), true, 1));
        when(subjects.get(owner, subject)).thenReturn(new Subject(subject, owner, "Ciencias", null, false, now, now));
        metadata.set(metadata(DocumentStatus.READY, UUID.fromString(fixture.extractionVersion().substring(10)), owner, subject));
        var first = fixture.fragments().getFirst();
        content.set(new ExtractedContent("PDF", first.text() + "\n\nOtro fragmento privado", List.of(
                new ExtractedContent.Fragment(0, "page", 1, first.text()), new ExtractedContent.Fragment(1, "page", 2, "Otro fragmento privado")),
                2, fixture.extractionWarnings(), "READY"));
        when(documents.find(fixture.documentId())).thenAnswer(invocation -> Optional.ofNullable(metadata.get()));
        when(documents.content(eq(fixture.documentId()), any())).thenAnswer(invocation -> Optional.of(content.get()));
        when(generator.generate(any())).thenAnswer(invocation -> echo(invocation.getArgument(0)));
        selection = new Selection(fixture.documentId(), fixture.extractionVersion(), fixture.type(), fixture.topic(), 1, 15, List.of(0));
        service = new GenerateAcademicDraftService(identities, subjects, documents, generator, new DraftAdmission(clock));
    }
    DocumentMetadata metadata(DocumentStatus status, UUID operation, UUID user, UUID subjectId) {
        return new DocumentMetadata(fixture.documentId(), subjectId, user, "grid", "synthetic.pdf", "application/pdf", 12, "checksum",
                status, now, now, null, operation, null);
    }
    @Test void onlyAuthorizedSelectedFragmentsReachGeneratorAndDraftStaysUnvalidated() {
        var response = service.generate(owner, subject, selection); assertThat(response.draft().validated()).isFalse();
        var capture = org.mockito.ArgumentCaptor.forClass(Request.class); verify(generator).generate(capture.capture());
        var sent = capture.getValue(); assertThat(sent.fragments()).hasSize(1); assertThat(sent.fragments().getFirst().index()).isZero();
        assertThat(sent.fragments().getFirst().text()).doesNotContain("privado");
        assertThat(sent.extractionWarnings()).containsExactlyElementsOf(fixture.extractionWarnings());
        verify(identities, times(2)).access(owner); verify(subjects, times(2)).get(owner, subject);
        verify(documents, never()).insert(any()); verify(documents, never()).complete(any(), any(), any(), any());
    }
    @Test void deniesAnonymousDisabledMissingAndForeignUsersBeforeReadingContent() {
        assertFailure(() -> service.generate(null, subject, selection), 401, "UNAUTHORIZED");
        when(identities.access(owner)).thenReturn(null); assertFailure(() -> service.generate(owner, subject, selection), 403, "FORBIDDEN");
        when(identities.access(owner)).thenReturn(new UserAccess(owner, Role.USER, UUID.randomUUID(), false, 1));
        assertFailure(() -> service.generate(owner, subject, selection), 403, "FORBIDDEN"); verifyNoInteractions(documents, generator);
    }
    @Test void deniesArchivedAndForeignSubjects() {
        when(subjects.get(owner, subject)).thenReturn(new Subject(subject, owner, "Materia", null, true, now, now));
        assertFailure(() -> service.generate(owner, subject, selection), 409, "SUBJECT_ARCHIVED");
        when(subjects.get(owner, subject)).thenReturn(new Subject(subject, UUID.randomUUID(), "Materia", null, false, now, now));
        assertFailure(() -> service.generate(owner, subject, selection), 403, "FORBIDDEN"); verifyNoInteractions(documents, generator);
    }
    @Test void deniesForeignDocumentOwnerAndSubject() {
        metadata.set(metadata(DocumentStatus.READY, UUID.randomUUID(), UUID.randomUUID(), subject));
        assertFailure(() -> service.generate(owner, subject, selection), 403, "FORBIDDEN");
        metadata.set(metadata(DocumentStatus.READY, UUID.randomUUID(), owner, UUID.randomUUID()));
        assertFailure(() -> service.generate(owner, subject, selection), 403, "FORBIDDEN"); verifyNoInteractions(generator);
    }
    @ParameterizedTest @EnumSource(value=DocumentStatus.class, names={"UPLOADED", "PROCESSING", "FAILED"})
    void quarantineNeverReachesGeneration(DocumentStatus status) {
        metadata.set(metadata(status, metadata.get().operationId(), owner, subject));
        assertFailure(() -> service.generate(owner, subject, selection), 409, "TEXT_NOT_READY"); verifyNoInteractions(generator);
    }
    @Test void staleVersionAndInvalidSelectionAreRejected() {
        var stale = new Selection(selection.documentId(), "operation:" + UUID.randomUUID(), selection.type(), selection.topic(), 1, 15, List.of(0));
        assertFailure(() -> service.generate(owner, subject, stale), 409, "EXTRACTION_CHANGED");
        for (var indexes : List.of(List.<Integer>of(), List.of(0, 0), List.of(99), List.of(-1))) {
            var invalid = new Selection(selection.documentId(), selection.extractionVersion(), selection.type(), selection.topic(), 1, 15, indexes);
            assertFailure(() -> service.generate(owner, subject, invalid), 400, "INVALID_DRAFT_REQUEST");
        }
        verifyNoInteractions(generator);
    }
    @Test void emptyContentAndOversizedSelectionCannotProducePartialDrafts() {
        var original = content.get();
        content.set(new ExtractedContent("PDF", " ", original.fragments(), 2, List.of(), "READY"));
        assertFailure(() -> service.generate(owner, subject, selection), 422, "INSUFFICIENT_CONTENT");
        content.set(new ExtractedContent("PDF", "x", List.of(new ExtractedContent.Fragment(0,"page",1,"x".repeat(100001))), 1, List.of(), "READY"));
        assertFailure(() -> service.generate(owner, subject, selection), 413, "PAYLOAD_TOO_LARGE"); verifyNoInteractions(generator);
    }
    @Test void detectsOperationContentAndQuarantineChangesWhileProviderIsRunning() {
        var originalMetadata = metadata.get(); var originalContent = content.get();
        for (int mode = 0; mode < 3; mode++) {
            int change = mode; metadata.set(originalMetadata); content.set(originalContent);
            doAnswer(invocation -> {
                if (change == 0) metadata.set(metadata(DocumentStatus.READY, UUID.randomUUID(), owner, subject));
                if (change == 1) content.set(new ExtractedContent("PDF", originalContent.text() + " changed", originalContent.fragments(), 2, originalContent.warnings(), "READY"));
                if (change == 2) metadata.set(metadata(DocumentStatus.PROCESSING, originalMetadata.operationId(), owner, subject));
                return echo(invocation.getArgument(0));
            }).when(generator).generate(any());
            assertFailure(() -> service.generate(owner, subject, selection), 409, "EXTRACTION_CHANGED");
        }
    }
    @Test void detectsSnapshotRaceBeforeProviderAndRevokedIdentityAfterIt() {
        var original = metadata.get();
        when(documents.find(fixture.documentId())).thenReturn(Optional.of(original), Optional.of(metadata(DocumentStatus.READY, UUID.randomUUID(), owner, subject)));
        assertFailure(() -> service.generate(owner, subject, selection), 409, "EXTRACTION_CHANGED"); verifyNoInteractions(generator);
        when(documents.find(fixture.documentId())).thenReturn(Optional.of(original));
        doAnswer(invocation -> {
            when(identities.access(owner)).thenReturn(new UserAccess(owner, Role.USER, UUID.randomUUID(), false, 2)); return echo(invocation.getArgument(0));
        }).when(generator).generate(any());
        assertFailure(() -> service.generate(owner, subject, selection), 403, "FORBIDDEN");
    }
    @Test void admissionRejectsConcurrentAndOverQuotaWorkAndReleasesAfterFailure() {
        var admission = new DraftAdmission(clock);
        try (var lease = admission.acquire(owner)) {
            assertFailure(() -> admission.acquire(owner), 429, "GENERATOR_BUSY");
            assertFailure(() -> admission.acquire(UUID.randomUUID()), 429, "GENERATOR_BUSY");
        }
        for (int i = 1; i < 6; i++) try (var lease = admission.acquire(owner)) { /* finish */ }
        assertFailure(() -> admission.acquire(owner), 429, "GENERATOR_BUSY");
        try (var lease = admission.acquire(UUID.randomUUID())) { assertThat(lease).isNotNull(); }
        doThrow(new com.siare.core.domain.draft.DraftGenerationException(504, "GENERATION_TIMEOUT")).when(generator).generate(any());
        assertFailure(() -> service.generate(owner, subject, selection), 504, "GENERATION_TIMEOUT");
        doAnswer(invocation -> echo(invocation.getArgument(0))).when(generator).generate(any());
        assertThat(service.generate(owner, subject, selection)).isNotNull();
    }
    @Test void productionWiringNeverBindsHttpOrAcceptsEnableFlags() {
        new ApplicationContextRunner().withUserConfiguration(AcademicDraftConfiguration.class)
                .withPropertyValues("siare.generation.enabled=true", "siare.generation.url=http://localhost:1")
                .withBean(IdentityRepository.class, () -> identities).withBean(SubjectUseCase.class, () -> subjects)
                .withBean(DocumentRepository.class, () -> documents).withBean(Clock.class, () -> clock)
                .withBean(AcademicDraftRepository.class, () -> mock(AcademicDraftRepository.class))
                .withBean(ActivityUseCase.class, () -> mock(ActivityUseCase.class))
                .withBean(TransactionPort.class, () -> mock(TransactionPort.class)).run(context -> {
                    assertThat(context).hasNotFailed().hasSingleBean(AcademicDraftGenerator.class);
                    assertFailure(() -> context.getBean(AcademicDraftGenerator.class).generate(fixture), 503, "GENERATION_DISABLED");
                    assertThat(context.getBeansOfType(com.siare.core.infrastructure.adapter.out.generation.HttpAcademicDraftGenerator.class)).isEmpty();
                });
    }
}
