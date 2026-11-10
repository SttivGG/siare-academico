package com.siare.core;

import com.siare.core.domain.document.*;
import com.siare.core.infrastructure.adapter.out.document.HttpDocumentProcessor;
import com.sun.net.httpserver.HttpServer;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.*;

class DocumentProcessorHttpTests {
    HttpServer server;
    UUID operation = UUID.randomUUID();
    String secret = "synthetic-service-token-32-characters";
    String response;
    int responseStatus = 200;
    byte[] received;
    String authorization, receivedOperation;
    HttpDocumentProcessor processor;
    DocumentMetadata metadata = new DocumentMetadata(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "grid", "academic.pdf", "application/pdf", 3, "sha", DocumentStatus.PROCESSING, Instant.now(), null, null, operation, null);

    @BeforeEach void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        server.createContext("/internal/v1/extractions", exchange -> {
            received = exchange.getRequestBody().readAllBytes();
            authorization = exchange.getRequestHeaders().getFirst("Authorization");
            receivedOperation = exchange.getRequestHeaders().getFirst("X-Operation-Id");
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(responseStatus, bytes.length);
            try (var output = exchange.getResponseBody()) { output.write(bytes); }
        });
        server.start();
        processor = new HttpDocumentProcessor("http://localhost:" + server.getAddress().getPort(), secret, new ObjectMapper());
        response = "{\"operationId\":\"" + operation + "\",\"result\":{\"fileType\":\"PDF\",\"text\":\"Ciencias\",\"fragments\":[{\"index\":0,\"unitType\":\"page\",\"unitNumber\":1,\"text\":\"Ciencias\"}],\"unitCount\":1,\"warnings\":[],\"extractionStatus\":\"READY\"}}";
    }
    @AfterEach void stop() { server.stop(0); }
    @Test void rawBytesOperationAndServiceCredentialReachTheInternalEndpoint() {
        assertThat(processor.extract(metadata, operation, new ByteArrayInputStream(new byte[]{1,2,3})).text()).isEqualTo("Ciencias");
        assertThat(received).containsExactly(1,2,3);
        assertThat(authorization).isEqualTo("Bearer " + secret);
        assertThat(receivedOperation).isEqualTo(operation.toString());
    }
    @Test void explicitExtractionFailureIsPreserved() {
        responseStatus = 422; response = "{\"operationId\":\"" + operation + "\",\"errorCode\":\"NO_EXTRACTABLE_TEXT\"}";
        assertThatThrownBy(() -> processor.extract(metadata, operation, new ByteArrayInputStream(new byte[3])))
                .isInstanceOfSatisfying(DocumentException.class, e -> assertThat(e.code()).isEqualTo("NO_EXTRACTABLE_TEXT"));
    }
    @Test void mismatchedOperationAndInconsistentTextAreRejected() {
        String valid = response;
        for (String invalid : new String[]{"not-json", valid.replace(operation.toString(), UUID.randomUUID().toString()), valid.replace("\"text\":\"Ciencias\",\"fragments\"", "\"text\":\"Changed\",\"fragments\"")}) {
            response = invalid;
            assertThatThrownBy(() -> processor.extract(metadata, operation, new ByteArrayInputStream(new byte[3])))
                    .isInstanceOfSatisfying(DocumentException.class, e -> assertThat(e.code()).isEqualTo("PROCESSOR_UNAVAILABLE"));
        }
    }
    @Test void unavailableServiceAndOversizedResponseAreBounded() {
        response = "x".repeat(8 * 1024 * 1024 + 1);
        assertThatThrownBy(() -> processor.extract(metadata, operation, new ByteArrayInputStream(new byte[3]))).isInstanceOf(DocumentException.class);
        server.stop(0);
        assertThatThrownBy(() -> processor.extract(metadata, operation, new ByteArrayInputStream(new byte[3])))
                .isInstanceOfSatisfying(DocumentException.class, e -> assertThat(e.code()).isEqualTo("PROCESSOR_UNAVAILABLE"));
    }
}
