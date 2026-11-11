package com.siare.core.infrastructure.adapter.in.web;

import com.siare.core.application.port.in.*;
import com.siare.core.domain.document.*;
import java.io.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1")
public class DocumentController {
    private final UploadDocumentUseCase uploads; private final ListDocumentsUseCase lists;
    private final GetDocumentUseCase reads; private final DownloadDocumentUseCase downloads; private final ProcessDocumentUseCase processes;
    public DocumentController(UploadDocumentUseCase uploads, ListDocumentsUseCase lists, GetDocumentUseCase reads,
            DownloadDocumentUseCase downloads, ProcessDocumentUseCase processes) {
        this.uploads = uploads; this.lists = lists; this.reads = reads; this.downloads = downloads; this.processes = processes;
    }
    public record Metadata(UUID documentId, UUID subjectId, String originalFilename, String contentType, long sizeBytes,
                           String checksum, DocumentStatus status, Instant createdAt, Instant processedAt, String errorCode,
                           UUID operationId, Instant leaseUntil) {
        static Metadata from(DocumentMetadata m) { return new Metadata(m.documentId(), m.subjectId(), m.originalFilename(), m.contentType(),
                m.sizeBytes(), m.checksum(), m.status(), m.createdAt(), m.processedAt(), m.errorCode(), m.operationId(), m.leaseUntil()); }
    }
    @PostMapping(value = "/subjects/{subjectId}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    ResponseEntity<Metadata> upload(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID subjectId, @RequestPart("file") MultipartFile file) {
        var result = uploads.upload(UUID.fromString(jwt.getSubject()), subjectId, file.getOriginalFilename(), file.getContentType(), file.getSize(), () -> {
            try { return file.getInputStream(); } catch (IOException error) { throw new DocumentException(400, "INVALID_FILE", "No se pudo leer el archivo recibido."); }
        });
        return ResponseEntity.created(URI.create("/api/v1/documents/" + result.documentId())).cacheControl(CacheControl.noStore()).body(Metadata.from(result));
    }
    @GetMapping("/subjects/{subjectId}/documents")
    ResponseEntity<List<Metadata>> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID subjectId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(lists.list(UUID.fromString(jwt.getSubject()), subjectId).stream().map(Metadata::from).toList());
    }
    @GetMapping("/documents/{documentId}")
    ResponseEntity<Metadata> get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID documentId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Metadata.from(reads.get(UUID.fromString(jwt.getSubject()), documentId)));
    }
    @PostMapping("/documents/{documentId}/process")
    ResponseEntity<Metadata> process(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID documentId,
            @RequestHeader(value = "Idempotency-Key", required = false) UUID operation) {
        var result = processes.process(UUID.fromString(jwt.getSubject()), documentId, operation == null ? UUID.randomUUID() : operation);
        return ResponseEntity.status(result.status() == DocumentStatus.PROCESSING ? 202 : 200).cacheControl(CacheControl.noStore()).body(Metadata.from(result));
    }
    @GetMapping("/documents/{documentId}/text")
    ResponseEntity<ExtractedContent> text(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID documentId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(reads.text(UUID.fromString(jwt.getSubject()), documentId));
    }
    @GetMapping("/documents/{documentId}/download")
    ResponseEntity<InputStreamResource> download(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID documentId) {
        var result = downloads.download(UUID.fromString(jwt.getSubject()), documentId);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(result.metadata().originalFilename(), StandardCharsets.UTF_8).build().toString())
                .contentType(MediaType.parseMediaType(result.metadata().contentType())).contentLength(result.metadata().sizeBytes())
                .body(new InputStreamResource(result.stream()));
    }
}
