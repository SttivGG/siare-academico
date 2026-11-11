package com.siare.core.infrastructure.adapter.out.document;

import com.siare.core.application.port.out.DocumentProcessor;
import com.siare.core.domain.document.*;
import java.io.*;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import tools.jackson.databind.ObjectMapper;

public final class HttpDocumentProcessor implements DocumentProcessor {
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).followRedirects(HttpClient.Redirect.NEVER).build();
    private final URI endpoint;
    private final String secret;
    private final ObjectMapper mapper;
    public HttpDocumentProcessor(String url, String secret, ObjectMapper mapper) {
        if (secret.length() < 32) throw new IllegalArgumentException("CONTENT_SERVICE_TOKEN must have at least 32 characters");
        this.endpoint = URI.create(url + "/internal/v1/extractions"); this.secret = secret; this.mapper = mapper;
    }
    @Override public ExtractedContent extract(DocumentMetadata document, UUID operation, InputStream source) {
        try {
            var request = HttpRequest.newBuilder(endpoint).timeout(Duration.ofSeconds(35))
                    .header("Authorization", "Bearer " + secret).header("Content-Type", document.contentType())
                    .header("X-Operation-Id", operation.toString()).header("X-Document-Type", DocumentType.fromFilename(document.originalFilename()).name())
                    .POST(HttpRequest.BodyPublishers.ofInputStream(() -> source)).build();
            // The request timeout includes body consumption; observed response bytes are capped.
            var response = client.send(request, info -> new BoundedResponseSubscriber());
            var json = mapper.readTree(response.body());
            if (!operation.toString().equals(json.path("operationId").asText())) throw new IOException("operation mismatch");
            if (response.statusCode() != 200) {
                String code = json.path("errorCode").asText();
                var permitted = Set.of("NO_EXTRACTABLE_TEXT", "CORRUPT_DOCUMENT", "PASSWORD_PROTECTED", "UNSAFE_DOCUMENT", "EXTRACTION_TIMEOUT", "TEXT_LIMIT", "OCR_UNAVAILABLE", "PROCESSOR_BUSY");
                throw new DocumentException(422, permitted.contains(code) ? code : "PROCESSOR_UNAVAILABLE", "No se pudo extraer el contenido. Puedes reintentar el procesamiento.");
            }
            var result = mapper.treeToValue(json.get("result"), ExtractedContent.class);
            if (result == null || !"READY".equals(result.extractionStatus()) || result.text() == null || result.text().isBlank()
                    || result.text().length() > 1_000_000 || result.fragments() == null || result.fragments().isEmpty()
                    || result.fragments().size() > 2000 || result.warnings() == null || result.unitCount() < 1 || result.unitCount() > 2000
                    || !DocumentType.fromFilename(document.originalFilename()).name().equals(result.fileType())) throw new IOException("invalid contract");
            int expected = 0;
            for (var fragment : result.fragments()) {
                if (fragment.index() != expected++ || fragment.unitNumber() < 1 || fragment.unitNumber() > result.unitCount()
                        || !Set.of("page", "slide", "section", "image").contains(fragment.unitType())
                        || fragment.text() == null || fragment.text().length() > 64_000) throw new IOException("invalid fragment");
            }
            if (!result.text().equals(String.join("\n\n", result.fragments().stream().map(ExtractedContent.Fragment::text).toList()))) throw new IOException("inconsistent text");
            return result;
        } catch (DocumentException error) { throw error; }
        catch (InterruptedException error) { Thread.currentThread().interrupt(); throw unavailable(); }
        catch (Exception error) {
            // Log only the failure class, never payloads, authorization or exception messages.
            Throwable cause = error;
            while (cause.getCause() != null && cause.getCause() != cause) cause = cause.getCause();
            System.getLogger(HttpDocumentProcessor.class.getName()).log(System.Logger.Level.WARNING,
                    "Internal extraction transport/contract failure: {0}", cause.getClass().getSimpleName());
            throw unavailable();
        }
    }
    private DocumentException unavailable() { return new DocumentException(503, "PROCESSOR_UNAVAILABLE", "El procesador no está disponible. El original se conserva; vuelve a intentarlo."); }
}
