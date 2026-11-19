package com.siare.core.application.service;

import com.siare.core.application.port.in.*;
import com.siare.core.application.port.out.*;
import com.siare.core.domain.document.*;
import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.function.Supplier;

public final class DocumentService implements UploadDocumentUseCase, ListDocumentsUseCase, GetDocumentUseCase,
        DownloadDocumentUseCase, ProcessDocumentUseCase {
    private final SubjectUseCase subjects;
    private final DocumentRepository documents;
    private final DocumentStorage storage;
    private final DocumentValidator validator;
    private final DocumentProcessor processor;
    private final Executor executor;
    private final Clock clock;
    private final long maximum;

    public DocumentService(SubjectUseCase subjects, DocumentRepository documents, DocumentStorage storage,
            DocumentValidator validator, DocumentProcessor processor, Executor executor, Clock clock, long maximum) {
        this.subjects = subjects; this.documents = documents; this.storage = storage; this.validator = validator;
        this.processor = processor; this.executor = executor; this.clock = clock; this.maximum = maximum;
    }
    private void writable(UUID owner, UUID subject) {
        if (subjects.get(owner, subject).archived()) throw new DocumentException(409, "SUBJECT_ARCHIVED", "La materia está archivada. Puedes consultar sus documentos, pero no cargar ni procesar archivos.");
    }
    @Override public DocumentMetadata upload(UUID owner, UUID subject, String filename, String declaredMime, long size, Supplier<InputStream> source) {
        writable(owner, subject);
        filename = DocumentRules.filename(filename);
        DocumentRules.size(size, maximum);
        var type = DocumentType.fromFilename(filename);
        if (declaredMime != null && !declaredMime.isBlank() && !declaredMime.equalsIgnoreCase("application/octet-stream")
                && !declaredMime.equalsIgnoreCase(type.contentType())) throw new DocumentException(415, "MIME_MISMATCH", "El tipo MIME no coincide con la extensión del archivo.");
        Path snapshot = null;
        try {
            snapshot = Files.createTempFile("siare-upload-", ".bin");
            var digest = MessageDigest.getInstance("SHA-256");
            long actual = 0;
            // Freeze exactly one supplier read: validation, checksum and GridFS see identical bytes.
            try (var input = source.get(); var output = Files.newOutputStream(snapshot)) {
                byte[] buffer = new byte[8192]; int count;
                while ((count = input.read(buffer)) != -1) {
                    actual += count; DocumentRules.size(actual, maximum); digest.update(buffer, 0, count);
                    output.write(buffer, 0, count);
                }
            }
            if (actual != size) throw new DocumentException(400, "INVALID_SIZE", "El tamaño real no coincide con el archivo recibido.");
            try (var input = Files.newInputStream(snapshot)) { validator.validateForStorage(input, type); }
            String gridId;
            try (var input = Files.newInputStream(snapshot)) { gridId = storage.store(input, filename, type.contentType()); }
            var metadata = new DocumentMetadata(UUID.randomUUID(), subject, owner, gridId, filename, type.contentType(),
                    actual, HexFormat.of().formatHex(digest.digest()), DocumentStatus.UPLOADED, clock.instant(), null, null, null, null);
            try { documents.insert(metadata); }
            catch (RuntimeException error) {
                try { storage.delete(gridId); } catch (RuntimeException compensation) { error.addSuppressed(compensation); }
                throw error;
            }
            return metadata;
        } catch (IOException | NoSuchAlgorithmException error) { throw new DocumentException(503, "STORAGE_ERROR", "No se pudo guardar el documento. Vuelve a intentarlo."); }
        finally { if (snapshot != null) try { Files.deleteIfExists(snapshot); } catch (IOException ignored) { /* temporary OS cleanup */ } }
    }
    @Override public List<DocumentMetadata> list(UUID owner, UUID subject) {
        subjects.get(owner, subject); return documents.list(owner, subject);
    }
    @Override public DocumentMetadata get(UUID owner, UUID id) {
        var document = documents.find(id).orElseThrow(() -> new DocumentException(404, "NOT_FOUND", "Documento no encontrado."));
        subjects.get(owner, document.subjectId());
        if (!document.ownerId().equals(owner)) throw new DocumentException(403, "FORBIDDEN", "No tienes acceso a este documento.");
        return document;
    }
    @Override public Download download(UUID owner, UUID id) {
        var document = get(owner, id);
        // UPLOADED/PROCESSING/FAILED are private quarantine states. Authorize before checking status.
        if (document.status() != DocumentStatus.READY)
            throw new DocumentException(409, "DOCUMENT_QUARANTINED", "El original está en cuarentena hasta completar su procesamiento seguro.");
        return new Download(document, storage.open(document.gridfsId()));
    }
    @Override public ExtractedContent text(UUID owner, UUID id) {
        var document = get(owner, id);
        if (document.status() != DocumentStatus.READY) throw new DocumentException(409, "TEXT_NOT_READY", "El texto todavía no está disponible. Solicita o reintenta el procesamiento.");
        return documents.content(id, document.operationId()).orElseThrow(() -> new DocumentException(503, "CONTENT_UNAVAILABLE", "No se pudo consultar el texto extraído."));
    }
    @Override public DocumentMetadata process(UUID owner, UUID id, UUID operation) {
        var current = get(owner, id); writable(owner, current.subjectId());
        if (current.status() == DocumentStatus.READY || operation.equals(current.operationId())) return current;
        var now = clock.instant();
        var claimed = documents.claim(id, operation, now, now.plusSeconds(120));
        if (claimed.isEmpty()) return get(owner, id);
        try { executor.execute(() -> run(claimed.get(), operation)); }
        catch (RejectedExecutionException error) {
            documents.fail(id, operation, "PROCESSOR_BUSY", clock.instant());
            throw new DocumentException(503, "PROCESSOR_BUSY", "Hay otros documentos en proceso. Vuelve a intentarlo.");
        }
        return claimed.get();
    }
    private void run(DocumentMetadata document, UUID operation) {
        Path snapshot = null;
        try {
            snapshot = Files.createTempFile("siare-process-", ".bin");
            var digest = MessageDigest.getInstance("SHA-256");
            long actual = 0;
            try (var source = storage.open(document.gridfsId()); var output = Files.newOutputStream(snapshot)) {
                byte[] buffer = new byte[8192]; int count;
                while ((count = source.read(buffer)) != -1) {
                    actual += count;
                    if (actual > maximum) throw new DocumentException(422, "CHECKSUM_MISMATCH", "No se pudo comprobar la integridad del original.");
                    digest.update(buffer, 0, count); output.write(buffer, 0, count);
                }
            }
            if (actual != document.sizeBytes() || !MessageDigest.isEqual(HexFormat.of().parseHex(document.checksum()), digest.digest()))
                throw new DocumentException(422, "CHECKSUM_MISMATCH", "No se pudo comprobar la integridad del original.");
            try (var source = Files.newInputStream(snapshot)) {
                var result = processor.extract(document, operation, source);
                documents.complete(document.documentId(), operation, result, clock.instant());
            }
        } catch (Exception error) {
            String code = error instanceof DocumentException de ? de.code() : "PROCESSING_ERROR";
            documents.fail(document.documentId(), operation, code, clock.instant());
        }
        finally { if (snapshot != null) try { Files.deleteIfExists(snapshot); } catch (IOException ignored) { /* temporary OS cleanup */ } }
    }
}
