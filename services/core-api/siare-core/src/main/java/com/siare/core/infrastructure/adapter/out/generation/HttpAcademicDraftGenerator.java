package com.siare.core.infrastructure.adapter.out.generation;

import com.siare.core.application.port.out.AcademicDraftGenerator;
import com.siare.core.domain.draft.AcademicDraft.*;
import com.siare.core.domain.draft.DraftGenerationException;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.concurrent.*;

/** Deliberately not a Spring component. Only synthetic contract tests bind this adapter. */
public final class HttpAcademicDraftGenerator implements AcademicDraftGenerator, AutoCloseable {
    private final HttpClient client;
    private final URI endpoint;
    private final String token;
    private final Duration timeout;
    private final DraftJsonContract contract = new DraftJsonContract();
    public HttpAcademicDraftGenerator(URI baseUrl, String token) { this(baseUrl, token, Duration.ofSeconds(35)); }
    public HttpAcademicDraftGenerator(URI baseUrl, String token, Duration timeout) {
        if (baseUrl == null || !java.util.Set.of("http", "https").contains(baseUrl.getScheme()) || baseUrl.getHost() == null
                || baseUrl.getRawUserInfo() != null || baseUrl.getRawQuery() != null || baseUrl.getRawFragment() != null
                || token == null || !token.matches("[\\x21-\\x7e]{32,}") || timeout == null || timeout.isNegative()
                || timeout.isZero() || timeout.compareTo(Duration.ofSeconds(35)) > 0)
            throw new IllegalArgumentException("Invalid H5 transport configuration");
        this.endpoint = baseUrl.resolve("/internal/v1/activity-bank-drafts"); this.token = token; this.timeout = timeout;
        this.client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).followRedirects(HttpClient.Redirect.NEVER).build();
    }
    @Override public Response generate(Request request) {
        byte[] body = contract.encode(request);
        var http = HttpRequest.newBuilder(endpoint).timeout(timeout).header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json").header("Accept", "application/json")
                .header("X-Request-Id", request.requestId().toString()).POST(HttpRequest.BodyPublishers.ofByteArray(body)).build();
        var pending = client.sendAsync(http, info -> new DraftBodySubscriber());
        try {
            // Total deadline includes a slow/stalled response body, not just headers.
            var response = pending.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
            String media = response.headers().firstValue("Content-Type").orElse("");
            if (!media.matches("(?i)application/json(?:\\s*;\\s*charset=utf-8)?")
                    || !response.headers().firstValue("Content-Encoding").orElse("identity").equalsIgnoreCase("identity")
                    || !response.headers().firstValue("Cache-Control").orElse("").equalsIgnoreCase("no-store")
                    || !response.headers().firstValue("X-Request-Id").orElse("").equals(request.requestId().toString()))
                throw DraftGenerationException.invalidContract();
            if (response.statusCode() == 200) return contract.response(request, response.body());
            throw contract.error(request, response.statusCode(), response.body(), response.headers().firstValue("Retry-After").orElse(null));
        } catch (TimeoutException error) {
            pending.cancel(true); throw new DraftGenerationException(504, "GENERATION_TIMEOUT");
        } catch (InterruptedException error) {
            pending.cancel(true); Thread.currentThread().interrupt(); throw new DraftGenerationException(503, "GENERATOR_UNAVAILABLE");
        } catch (ExecutionException error) {
            Throwable cause = error;
            while (cause.getCause() != null && cause.getCause() != cause) cause = cause.getCause();
            if (cause instanceof DraftGenerationException known) throw known;
            if (cause instanceof HttpTimeoutException) throw new DraftGenerationException(504, "GENERATION_TIMEOUT");
            throw new DraftGenerationException(503, "GENERATOR_UNAVAILABLE");
        }
    }
    @Override public void close() { client.shutdownNow(); }
}
