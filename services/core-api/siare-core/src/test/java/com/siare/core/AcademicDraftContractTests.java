package com.siare.core;

import com.siare.core.domain.draft.AcademicDraft.*;
import com.siare.core.domain.draft.DraftGenerationException;
import com.siare.core.infrastructure.adapter.out.generation.*;
import com.sun.net.httpserver.HttpServer;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import static org.assertj.core.api.Assertions.*;

class AcademicDraftContractTests {
    static final ObjectMapper JSON = new ObjectMapper();
    static final String TOKEN = "synthetic-generation-token-independent-32";
    final DraftJsonContract contract = new DraftJsonContract();
    HttpServer server;
    ExecutorService executor;
    HttpAcademicDraftGenerator adapter;
    volatile byte[] response;
    volatile int status = 200;
    volatile String retryAfter, contentType = "application/json", encoding;
    volatile String responseId;
    volatile long delay, bodyDelay;
    volatile byte[] received;
    volatile String authorization, requestId, accept;
    AtomicInteger requests = new AtomicInteger();

    static byte[] fixture(String name) {
        try (var input = AcademicDraftContractTests.class.getResourceAsStream("/contracts/h5/" + name + ".json")) {
            return Objects.requireNonNull(input).readAllBytes();
        } catch (Exception error) { throw new AssertionError(error); }
    }
    static Request request(String family) { return JSON.readValue(fixture(family + "-request"), Request.class); }
    static Response echo(Request request) {
        var original = JSON.readValue(fixture(request.type().name().toLowerCase(Locale.ROOT) + "-response"), Response.class);
        return new Response(1, request.requestId(), request.documentId(), request.extractionVersion(), request.type(), request.topic(), request.count(),
                original.status(), original.generatorVersion(), original.draft(), request.extractionWarnings(), original.quality());
    }
    @BeforeEach void start() throws Exception {
        response = fixture("quiz-response");
        server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        executor = Executors.newCachedThreadPool(); server.setExecutor(executor);
        server.createContext("/internal/v1/activity-bank-drafts", exchange -> {
            requests.incrementAndGet(); received = exchange.getRequestBody().readAllBytes();
            authorization = exchange.getRequestHeaders().getFirst("Authorization");
            requestId = exchange.getRequestHeaders().getFirst("X-Request-Id");
            accept = exchange.getRequestHeaders().getFirst("Accept");
            try {
                if (delay > 0) Thread.sleep(delay);
                exchange.getResponseHeaders().add("Content-Type", contentType);
                exchange.getResponseHeaders().add("X-Request-Id", responseId == null ? requestId : responseId);
                exchange.getResponseHeaders().add("Cache-Control", "no-store");
                if (retryAfter != null) exchange.getResponseHeaders().add("Retry-After", retryAfter);
                if (encoding != null) exchange.getResponseHeaders().add("Content-Encoding", encoding);
                exchange.sendResponseHeaders(status, 0); // chunked: no declared length to trust
                if (bodyDelay > 0) { exchange.getResponseBody().write(' '); exchange.getResponseBody().flush(); Thread.sleep(bodyDelay); }
                exchange.getResponseBody().write(response);
            } catch (InterruptedException error) { Thread.currentThread().interrupt(); }
            catch (java.io.IOException ignored) { /* expected client cancellation */ }
            finally { exchange.close(); }
        });
        server.start(); adapter = adapter(Duration.ofSeconds(3));
    }
    HttpAcademicDraftGenerator adapter(Duration timeout) {
        return new HttpAcademicDraftGenerator(URI.create("http://localhost:" + server.getAddress().getPort()), TOKEN, timeout);
    }
    @AfterEach void stop() { adapter.close(); server.stop(0); executor.shutdownNow(); }

    @ParameterizedTest @ValueSource(strings = {"quiz", "crossword"})
    void realHttpMatchesBothFrozenFixtures(String family) {
        response = fixture(family + "-response"); var request = request(family);
        var result = adapter.generate(request);
        assertThat(result.draft().validated()).isFalse(); assertThat(result.quality().requiresHumanReview()).isTrue();
        assertThat(JSON.readTree(received)).isEqualTo(JSON.readTree(fixture(family + "-request")));
        assertThat(authorization).isEqualTo("Bearer " + TOKEN); assertThat(accept).isEqualTo("application/json");
        assertThat(requestId).isEqualTo(request.requestId().toString()); assertThat(requests).hasValue(1);
    }
    static Stream<Arguments> mutations() {
        return Stream.of(
                mutation("foreign request", n -> n.put("requestId", UUID.randomUUID().toString())),
                mutation("foreign document", n -> n.put("documentId", UUID.randomUUID().toString())),
                mutation("stale version", n -> n.put("extractionVersion", "operation:" + UUID.randomUUID())),
                mutation("wrong family", n -> n.put("type", "CROSSWORD")),
                mutation("wrong topic", n -> n.put("topic", "Otro")),
                mutation("partial count", n -> n.put("count", 2)),
                mutation("validated bank", n -> ((ObjectNode)n.path("draft")).put("validated", true)),
                mutation("unknown authority", n -> n.put("studentId", UUID.randomUUID().toString())),
                mutation("false evidence", n -> source(n).put("quote", "Contenido inventado")),
                mutation("unselected fragment", n -> source(n).put("fragmentIndex", 1)),
                mutation("wrong reference", n -> source(n).put("reference", "Página 2")),
                mutation("wrong unit", n -> source(n).put("unitType", "slide")),
                mutation("wrong unit number", n -> source(n).put("unitNumber", 2)),
                mutation("unknown answer key", n -> question(n).put("correctOptionId", "missing")),
                mutation("unsupported answer", n -> question(n).put("correctOptionId", "b")),
                mutation("empty normalized answer", n -> ((ObjectNode)question(n).path("options").get(0)).put("text", "--")),
                mutation("duplicate option id", n -> ((ObjectNode)question(n).path("options").get(1)).put("id", "a")),
                mutation("duplicate option text", n -> ((ObjectNode)question(n).path("options").get(1)).put("text", " sol ")),
                mutation("null boolean", n -> ((ObjectNode)n.path("draft")).putNull("validated")),
                mutation("coerced boolean", n -> ((ObjectNode)n.path("draft")).put("validated", "false")),
                mutation("coerced count", n -> n.put("count", "1")),
                mutation("fractional count", n -> n.put("count", 1.5)),
                mutation("missing explanation", n -> question(n).remove("explanation")),
                mutation("missing review", n -> ((ObjectNode)n.path("quality")).put("requiresHumanReview", false)),
                mutation("false quality", n -> ((ObjectNode)n.path("quality").path("checks")).put("answerSupported", false)),
                mutation("lost warnings", n -> n.putArray("warnings")),
                mutation("unknown warning", n -> n.withArray("warnings").add("invented warning")),
                mutation("utf16 limit", n -> question(n).put("prompt", "😀".repeat(1001)))
        );
    }
    static Arguments mutation(String name, Consumer<ObjectNode> change) { return Arguments.of(name, change); }
    static ObjectNode question(ObjectNode response) { return (ObjectNode) response.path("draft").path("questions").get(0); }
    static ObjectNode source(ObjectNode response) { return (ObjectNode) question(response).path("source"); }
    @ParameterizedTest(name = "{0}") @MethodSource("mutations")
    void rejectsProviderMutations(String name, Consumer<ObjectNode> change) {
        var node = (ObjectNode) JSON.readTree(response); change.accept(node); response = JSON.writeValueAsBytes(node);
        assertFailure(() -> adapter.generate(request("quiz")), 502, "GENERATOR_CONTRACT_INVALID");
    }
    @ParameterizedTest @ValueSource(strings = {"insufficient", "ocr", "ambiguous"})
    void preservesSafeSyntheticQualityFailures(String name) {
        response = fixture(name + "-response"); status = 422;
        assertFailure(() -> adapter.generate(request("quiz")), 422, name.equals("insufficient") ? "INSUFFICIENT_CONTENT" : "CONTENT_QUALITY_FAILED");
    }
    @ParameterizedTest @CsvSource({"400,INVALID_DRAFT_REQUEST", "401,UNAUTHORIZED", "403,FORBIDDEN", "413,PAYLOAD_TOO_LARGE", "429,GENERATOR_BUSY", "500,GENERATOR_ERROR", "503,GENERATOR_UNAVAILABLE", "504,GENERATION_TIMEOUT"})
    void mapsInternalErrorsWithoutLeakingMessages(int httpStatus, String code) {
        status = httpStatus; retryAfter = "5";
        response = JSON.writeValueAsBytes(Map.of("schemaVersion", 1, "requestId", request("quiz").requestId(), "status", status, "code", code,
                "message", "private provider diagnostic should never escape", "details", Map.of()));
        assertFailure(() -> adapter.generate(request("quiz")), status == 401 || status == 403 ? 503 : status,
                status == 401 || status == 403 ? "GENERATOR_UNAVAILABLE" : code);
        assertThat(requests).hasValue(1);
    }
    @Test void busyRequiresBoundedRetryAfter() {
        status = 429; response = JSON.writeValueAsBytes(Map.of("schemaVersion", 1, "requestId", request("quiz").requestId(), "status", 429,
                "code", "GENERATOR_BUSY", "message", "Ocupado", "details", Map.of()));
        for (String value : new String[]{null, "0", "61", "tomorrow"}) {
            retryAfter = value; assertFailure(() -> adapter.generate(request("quiz")), 502, "GENERATOR_CONTRACT_INVALID");
        }
        retryAfter = "5";
        assertThatThrownBy(() -> adapter.generate(request("quiz"))).isInstanceOfSatisfying(DraftGenerationException.class, e -> assertThat(e.retryAfter()).isEqualTo(5));
    }
    @Test void strictWireJsonRejectsDuplicateKeysNonfiniteTrailingInvalidUnicodeAndDepth() {
        var valid = new String(fixture("quiz-response"), StandardCharsets.UTF_8);
        for (String invalid : List.of(valid.replaceFirst("\\{", "{\"schemaVersion\":1,"), valid + " {}", valid.replace("\"count\": 1", "\"count\": NaN"),
                valid.replace("synthetic-fixture-v1", "\\uD800"), "[".repeat(17) + "0" + "]".repeat(17))) {
            response = invalid.getBytes(StandardCharsets.UTF_8);
            assertFailure(() -> adapter.generate(request("quiz")), 502, "GENERATOR_CONTRACT_INVALID");
        }
        response = new byte[]{(byte)0xc3, (byte)0x28};
        assertFailure(() -> adapter.generate(request("quiz")), 502, "GENERATOR_CONTRACT_INVALID");
    }
    @Test void observedChunkedResponseLimitIsEnforced() {
        response = new byte[DraftJsonContract.RESPONSE_BYTES + 1]; Arrays.fill(response, (byte)' ');
        assertFailure(() -> adapter.generate(request("quiz")), 502, "GENERATOR_CONTRACT_INVALID");
    }
    @Test void schemaIntegerSemanticsAcceptIntegralDecimalsWithoutStringCoercion() {
        var valid = new String(response, StandardCharsets.UTF_8).replace("\"count\": 1", "\"count\": 1.0")
                .replace("\"schemaVersion\": 1", "\"schemaVersion\": 1.0");
        response = valid.getBytes(StandardCharsets.UTF_8);
        assertThat(adapter.generate(request("quiz")).count()).isEqualTo(1);
    }
    @Test void outboundUtf8BudgetIsEnforcedBeforeHttp() {
        var base = request("quiz"); var fragments = new ArrayList<Fragment>();
        for (int i = 0; i < 32; i++) fragments.add(new Fragment(i, "Página 1", "page", 1, "\u0001".repeat(3000)));
        var large = new Request(1, base.requestId(), base.documentId(), base.extractionVersion(), base.type(), base.topic(), 1, 15, "es", List.of(), fragments);
        assertFailure(() -> adapter.generate(large), 413, "PAYLOAD_TOO_LARGE"); assertThat(requests).hasValue(0);
    }
    @Test void rejectsWrongHeadersCompressionAndRedirectWithoutFollowing() {
        contentType = "text/html"; assertFailure(() -> adapter.generate(request("quiz")), 502, "GENERATOR_CONTRACT_INVALID");
        contentType = "application/json"; encoding = "gzip"; assertFailure(() -> adapter.generate(request("quiz")), 502, "GENERATOR_CONTRACT_INVALID");
        encoding = null; responseId = UUID.randomUUID().toString(); assertFailure(() -> adapter.generate(request("quiz")), 502, "GENERATOR_CONTRACT_INVALID");
        responseId = null; status = 302; assertFailure(() -> adapter.generate(request("quiz")), 502, "GENERATOR_CONTRACT_INVALID");
        assertThat(requests).hasValue(4);
    }
    @Test void timeoutCoversHeadersAndSlowBodyAndDoesNotRetry() {
        adapter.close(); adapter = adapter(Duration.ofMillis(200)); delay = 800;
        assertFailure(() -> adapter.generate(request("quiz")), 504, "GENERATION_TIMEOUT");
        delay = 0; bodyDelay = 800;
        assertFailure(() -> adapter.generate(request("quiz")), 504, "GENERATION_TIMEOUT");
        assertThat(requests).hasValue(2);
    }
    @Test void unavailableAndInterruptionAreSafe() {
        server.stop(0); assertFailure(() -> adapter.generate(request("quiz")), 503, "GENERATOR_UNAVAILABLE");
        Thread.currentThread().interrupt();
        try { assertFailure(() -> adapter.generate(request("quiz")), 503, "GENERATOR_UNAVAILABLE"); assertThat(Thread.currentThread().isInterrupted()).isTrue(); }
        finally { Thread.interrupted(); }
    }
    @Test void bundledSchemaAndFixturesRemainByteIdenticalToH5A() throws Exception {
        // Git normalizes text to LF; the digest must also work in a fresh Linux checkout.
        byte[] schema = getClass().getResourceAsStream("/contracts/h5/activity-draft.schema.json").readAllBytes();
        Path root = Path.of("../../../docs/contracts/h5");
        if (Files.exists(root)) {
            assertThat(schema).isEqualTo(Files.readAllBytes(root.resolve("activity-draft.schema.json")));
            try (var paths = Files.list(root.resolve("fixtures"))) {
                for (var path : paths.toList()) assertThat(fixture(path.getFileName().toString().replace(".json", ""))).isEqualTo(Files.readAllBytes(path));
            }
        }
        byte[] normalized = new String(schema, StandardCharsets.UTF_8).replace("\r\n", "\n").getBytes(StandardCharsets.UTF_8);
        assertThat(java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(normalized)))
                .isEqualTo("0b958b89d7d12410c330e45559ed7d57ff2e40bdf6e5847fae6ada61bd8c7b57");
    }
    static void assertFailure(Throwing action, int status, String code) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(DraftGenerationException.class, e -> {
            assertThat(e.status()).isEqualTo(status); assertThat(e.code()).isEqualTo(code);
            assertThat(e.getMessage()).doesNotContain("private provider", TOKEN, "El Sol");
        });
    }
    interface Throwing { void run() throws Exception; }
}
