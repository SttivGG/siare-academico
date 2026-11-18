package com.siare.core;

import com.siare.core.application.port.in.SubjectUseCase;
import com.siare.core.application.port.out.*;
import com.siare.core.application.service.DocumentService;
import com.siare.core.domain.document.*;
import com.siare.core.domain.subject.Subject;
import java.io.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class DocumentServiceTests {
    SubjectUseCase subjects = mock(SubjectUseCase.class);
    DocumentRepository documents = mock(DocumentRepository.class);
    DocumentStorage storage = mock(DocumentStorage.class);
    DocumentValidator validator = mock(DocumentValidator.class);
    DocumentProcessor processor = mock(DocumentProcessor.class);
    UUID owner = UUID.randomUUID(), subject = UUID.randomUUID(), id = UUID.randomUUID();
    Instant now = Instant.parse("2026-11-10T12:00:00Z");
    DocumentService service;
    @BeforeEach void setup() {
        when(subjects.get(owner, subject)).thenReturn(new Subject(subject, owner, "Ciencias", null, false, now, now));
        service = service(Runnable::run);
    }
    DocumentService service(Executor executor) { return new DocumentService(subjects, documents, storage, validator, processor, executor, Clock.fixed(now, ZoneOffset.UTC), 1024); }
    DocumentMetadata metadata(DocumentStatus status, UUID operation) {
        return new DocumentMetadata(id, subject, owner, "grid-id", "academic.pdf", "application/pdf", 3, "checksum", status, now, null, null, operation, null);
    }
    @Test void uploadStoresOriginalChecksumAndMetadataWithoutBinary() {
        when(storage.store(any(), eq("academic.pdf"), eq("application/pdf"))).thenReturn("grid-id");
        var result = service.upload(owner, subject, "academic.pdf", "application/pdf", 3, () -> new ByteArrayInputStream(new byte[]{1,2,3}));
        assertThat(result.status()).isEqualTo(DocumentStatus.UPLOADED);
        assertThat(result.checksum()).isEqualTo("039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81");
        verify(documents).insert(result); verify(validator).validate(any(), eq(DocumentType.PDF));
    }
    @Test void metadataFailureCompensatesGridFs() {
        when(storage.store(any(), anyString(), anyString())).thenReturn("grid-id");
        doThrow(new IllegalStateException("metadata unavailable")).when(documents).insert(any());
        assertThatThrownBy(() -> service.upload(owner, subject, "a.pdf", "application/pdf", 3, () -> new ByteArrayInputStream(new byte[]{1,2,3}))).isInstanceOf(IllegalStateException.class);
        verify(storage).delete("grid-id");
    }
    @Test void unsafeEmptyOversizedLegacyAndMismatchedMimeAreRejectedBeforeStorage() {
        for (String name : new String[]{"../a.pdf", "a\\b.pdf", "a\r\n.pdf", "CON.pdf", "a.doc", "a.ppt", "a.exe"}) {
            assertThatThrownBy(() -> service.upload(owner, subject, name, null, 3, () -> new ByteArrayInputStream(new byte[3]))).isInstanceOf(DocumentException.class);
        }
        for (long size : new long[]{0, 1025}) assertThatThrownBy(() -> service.upload(owner, subject, "a.pdf", "application/pdf", size, () -> null)).isInstanceOf(DocumentException.class);
        assertThatThrownBy(() -> service.upload(owner, subject, "a.pdf", "image/png", 3, () -> null)).isInstanceOf(DocumentException.class);
        verifyNoInteractions(storage, documents);
    }
    @Test void otherStudentAndArchivedSubjectCannotMutate() {
        when(documents.find(id)).thenReturn(Optional.of(metadata(DocumentStatus.UPLOADED, null)));
        when(subjects.get(owner, subject)).thenReturn(new Subject(subject, owner, "Ciencias", null, true, now, now));
        assertThatThrownBy(() -> service.upload(owner, subject, "a.pdf", null, 3, () -> null)).isInstanceOf(DocumentException.class);
        assertThatThrownBy(() -> service.process(owner, id, UUID.randomUUID())).isInstanceOf(DocumentException.class);
        assertThat(service.get(owner, id)).isNotNull();
        UUID other = UUID.randomUUID();
        when(subjects.get(other, subject)).thenThrow(new com.siare.core.domain.account.BusinessException(com.siare.core.domain.account.BusinessException.Kind.FORBIDDEN, "denied"));
        assertThatThrownBy(() -> service.download(other, id)).isInstanceOf(com.siare.core.domain.account.BusinessException.class);
        verifyNoInteractions(storage);
    }
    @Test void unavailablePythonMarksFailedAndRetainsOriginalForRetry() {
        UUID operation = UUID.randomUUID();
        when(documents.find(id)).thenReturn(Optional.of(metadata(DocumentStatus.UPLOADED, null)));
        when(documents.claim(eq(id), eq(operation), eq(now), any())).thenReturn(Optional.of(metadata(DocumentStatus.PROCESSING, operation)));
        when(storage.open("grid-id")).thenReturn(new ByteArrayInputStream(new byte[3]));
        when(processor.extract(any(), eq(operation), any())).thenThrow(new DocumentException(503, "PROCESSOR_UNAVAILABLE", "offline"));
        service.process(owner, id, operation);
        verify(documents).fail(id, operation, "PROCESSOR_UNAVAILABLE", now); verify(storage, never()).delete(any());
        UUID retry = UUID.randomUUID();
        when(documents.find(id)).thenReturn(Optional.of(metadata(DocumentStatus.FAILED, operation)));
        when(documents.claim(eq(id), eq(retry), eq(now), any())).thenReturn(Optional.of(metadata(DocumentStatus.PROCESSING, retry)));
        var result = new ExtractedContent("PDF", "Ciencias", List.of(new ExtractedContent.Fragment(0, "page", 1, "Ciencias")), 1, List.of(), "READY");
        when(processor.extract(any(), eq(retry), any())).thenReturn(result);
        service.process(owner, id, retry);
        verify(documents).complete(id, retry, result, now);
    }
    @Test void duplicateOperationAndActiveLeaseDoNotScheduleTwice() {
        UUID operation = UUID.randomUUID();
        when(documents.find(id)).thenReturn(Optional.of(metadata(DocumentStatus.PROCESSING, operation)));
        service.process(owner, id, operation);
        verify(documents, never()).claim(any(), any(), any(), any());
        service.process(owner, id, UUID.randomUUID());
        verifyNoInteractions(processor, storage);
    }
    @Test void rejectedQueueIsRetryableAndTextRequiresReady() {
        UUID operation = UUID.randomUUID();
        when(documents.find(id)).thenReturn(Optional.of(metadata(DocumentStatus.UPLOADED, null)));
        when(documents.claim(eq(id), eq(operation), any(), any())).thenReturn(Optional.of(metadata(DocumentStatus.PROCESSING, operation)));
        assertThatThrownBy(() -> service(r -> { throw new RejectedExecutionException(); }).process(owner, id, operation)).isInstanceOf(DocumentException.class);
        verify(documents).fail(id, operation, "PROCESSOR_BUSY", now);
        assertThatThrownBy(() -> service.text(owner, id)).isInstanceOf(DocumentException.class);
    }
}
