package com.siare.core.infrastructure.adapter.out.generation;

import com.siare.core.application.service.DraftEvidence;
import com.siare.core.domain.draft.AcademicDraft.*;
import com.siare.core.domain.draft.DraftGenerationException;
import java.nio.*;
import java.nio.charset.*;
import java.util.*;
import java.util.regex.Pattern;
import tools.jackson.core.*;
import tools.jackson.core.json.JsonFactory;
import tools.jackson.databind.*;
import tools.jackson.databind.json.JsonMapper;

/** Evaluates the frozen H5-A schema subset offline; no remote refs or provider extensions. */
public final class DraftJsonContract {
    public static final int REQUEST_BYTES = 512 * 1024;
    public static final int RESPONSE_BYTES = 2 * 1024 * 1024;
    private final ObjectMapper json = JsonMapper.builder(JsonFactory.builder()
            .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
            .streamReadConstraints(StreamReadConstraints.builder().maxNestingDepth(16).build()).build())
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS, DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS).build();
    private final JsonNode schema;

    public DraftJsonContract() {
        try (var input = DraftJsonContract.class.getResourceAsStream("/contracts/h5/activity-draft.schema.json")) {
            if (input == null) throw new IllegalStateException("H5 schema missing");
            // Trusted schema is deeper than wire JSON and is parsed separately.
            schema = new ObjectMapper().readTree(input);
        } catch (java.io.IOException error) { throw new IllegalStateException("H5 schema unavailable"); }
    }
    public byte[] encode(Request request) {
        try {
            DraftEvidence.request(request);
            byte[] bytes = json.writeValueAsBytes(request);
            if (bytes.length > REQUEST_BYTES) throw new DraftGenerationException(413, "PAYLOAD_TOO_LARGE");
            shape(parse(bytes, REQUEST_BYTES), "DraftRequest"); return bytes;
        } catch (DraftGenerationException error) { throw error; }
        catch (RuntimeException error) { throw DraftGenerationException.invalidContract(); }
    }
    public Response response(Request request, byte[] bytes) {
        try {
            JsonNode node = parse(bytes, RESPONSE_BYTES); shape(node, "DraftResponse");
            Response result = json.treeToValue(node, Response.class);
            DraftEvidence.response(request, result); return result;
        } catch (DraftGenerationException error) { throw error; }
        catch (RuntimeException error) { throw DraftGenerationException.invalidContract(); }
    }
    /** Same frozen H5 definitions at the public review boundary, without JSON coercion. */
    public <T> T publicRequest(byte[] bytes, String definition, Class<T> type) {
        if (!Set.of("ReviseDraftRequest", "PublishDraftRequest").contains(definition)) throw new IllegalArgumentException("Unknown public draft definition");
        if (bytes.length > RESPONSE_BYTES) throw new com.siare.core.domain.draft.DraftLifecycleException(413, "PAYLOAD_TOO_LARGE");
        try {
            JsonNode node = parse(bytes, RESPONSE_BYTES);
            if (definition.equals("PublishDraftRequest") && (!node.path("reviewConfirmed").isBoolean() || !node.path("reviewConfirmed").asBoolean()))
                throw new com.siare.core.domain.draft.DraftLifecycleException(400, "REVIEW_REQUIRED");
            shape(node, definition); return json.treeToValue(node, type);
        } catch (com.siare.core.domain.draft.DraftLifecycleException ex) { throw ex; }
        catch (RuntimeException ex) { throw new com.siare.core.domain.draft.DraftLifecycleException(400, "INVALID_DRAFT_REQUEST"); }
    }
    public DraftGenerationException error(Request request, int status, byte[] bytes, String retryAfter) {
        JsonNode node = parse(bytes, RESPONSE_BYTES); shape(node, "ErrorResponse");
        require(node.path("status").asInt() == status);
        boolean authFailure = status == 401 || status == 403;
        require(request.requestId().toString().equals(node.path("requestId").asText()) || authFailure && node.path("requestId").isNull());
        Integer retry = null;
        if (status == 429 || status == 503) {
            require(retryAfter != null && retryAfter.matches("[0-9]{1,2}"));
            retry = Integer.valueOf(retryAfter); require(retry >= 1 && retry <= 60);
        }
        String code = node.path("code").asText();
        var details = node.path("details");
        if (code.equals("INSUFFICIENT_CONTENT") && details.has("availableCount")) require(details.path("availableCount").asInt() < request.count());
        if (code.equals("CONTENT_QUALITY_FAILED")) {
            boolean reason = false;
            for (var entry : details.path("reasonCodes")) reason |= Set.of("OCR_UNREADABLE", "AMBIGUOUS_QUESTION", "UNSUPPORTED_EXPLANATION", "DUPLICATE_CONTENT").contains(entry.asText());
            require(reason);
        }
        if (authFailure) return new DraftGenerationException(503, "GENERATOR_UNAVAILABLE");
        return new DraftGenerationException(status, code, retry);
    }
    private JsonNode parse(byte[] bytes, int maximum) {
        try {
            require(bytes.length <= maximum);
            String text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
            JsonNode node = json.readTree(text); require(node != null); depth(node, 1); return node;
        } catch (CharacterCodingException | RuntimeException error) { throw DraftGenerationException.invalidContract(); }
    }
    private void depth(JsonNode node, int level) {
        require(level <= 16);
        if (node.isContainer()) for (var child : node) depth(child, level + 1);
        if (node.isString()) {
            String value = node.asText();
            for (int i = 0; i < value.length(); i++) {
                char c = value.charAt(i);
                if (Character.isHighSurrogate(c)) require(++i < value.length() && Character.isLowSurrogate(value.charAt(i)));
                else require(!Character.isLowSurrogate(c));
            }
        }
        if (node.isFloatingPointNumber()) require(Double.isFinite(node.asDouble()));
    }
    private void shape(JsonNode node, String definition) { require(matches(node, schema.path("$defs").path(definition))); }
    private boolean matches(JsonNode value, JsonNode rule) {
        if (rule.has("$ref")) {
            String ref = rule.path("$ref").asText();
            if (!ref.startsWith("#/$defs/")) return false;
            return matches(value, schema.path("$defs").path(ref.substring(8)));
        }
        if (rule.has("oneOf")) {
            int count = 0; for (var child : rule.path("oneOf")) if (matches(value, child)) count++;
            if (count != 1) return false;
        }
        for (var child : rule.path("allOf")) if (!matches(value, child)) return false;
        if (rule.has("if")) {
            if (matches(value, rule.path("if"))) { if (rule.has("then") && !matches(value, rule.path("then"))) return false; }
            else if (rule.has("else") && !matches(value, rule.path("else"))) return false;
        }
        if (rule.has("const") && !equalValue(value, rule.path("const"))) return false;
        if (rule.has("enum")) { boolean found = false; for (var option : rule.path("enum")) found |= equalValue(value, option); if (!found) return false; }
        if (rule.has("type")) {
            boolean correct = switch (rule.path("type").asText()) {
                case "object" -> value.isObject(); case "array" -> value.isArray(); case "string" -> value.isString();
                case "integer" -> value.isNumber() && value.decimalValue().stripTrailingZeros().scale() <= 0;
                case "boolean" -> value.isBoolean(); case "null" -> value.isNull();
                default -> false;
            };
            if (!correct) return false;
        }
        if (value.isObject()) {
            for (var name : rule.path("required")) if (!value.has(name.asText())) return false;
            var properties = rule.path("properties");
            for (String name : value.propertyNames()) {
                if (properties.has(name)) { if (!matches(value.path(name), properties.path(name))) return false; }
                else if (rule.has("additionalProperties") && !rule.path("additionalProperties").asBoolean()) return false;
            }
        }
        if (value.isArray()) {
            if (value.size() < rule.path("minItems").asInt(0) || value.size() > rule.path("maxItems").asInt(Integer.MAX_VALUE)) return false;
            Set<JsonNode> unique = new HashSet<>();
            for (var entry : value) {
                if (rule.path("uniqueItems").asBoolean() && !unique.add(entry)) return false;
                if (rule.has("items") && !matches(entry, rule.path("items"))) return false;
            }
        }
        if (value.isString()) {
            String text = value.asText();
            // H5-A additionally bounds Java UTF-16 units, which is stricter than code points.
            if (text.codePointCount(0, text.length()) < rule.path("minLength").asInt(0)
                    || text.length() > rule.path("maxLength").asInt(Integer.MAX_VALUE)) return false;
            if (rule.has("pattern") && !Pattern.compile(rule.path("pattern").asText(), Pattern.UNICODE_CHARACTER_CLASS).matcher(text).find()) return false;
            if (rule.path("format").asText().equals("uuid")) {
                try { if (!UUID.fromString(text).toString().equals(text)) return false; } catch (IllegalArgumentException error) { return false; }
            }
        }
        if (value.isNumber() && (value.asDouble() < rule.path("minimum").asDouble(-Double.MAX_VALUE)
                || value.asDouble() > rule.path("maximum").asDouble(Double.MAX_VALUE))) return false;
        return true;
    }
    private static boolean equalValue(JsonNode left, JsonNode right) {
        return left.isNumber() && right.isNumber() ? left.decimalValue().compareTo(right.decimalValue()) == 0 : left.equals(right);
    }
    private static void require(boolean condition) { if (!condition) throw DraftGenerationException.invalidContract(); }
}
