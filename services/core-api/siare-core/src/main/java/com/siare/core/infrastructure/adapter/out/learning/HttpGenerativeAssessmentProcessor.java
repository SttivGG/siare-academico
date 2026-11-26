package com.siare.core.infrastructure.adapter.out.learning;

import com.siare.core.application.port.out.GenerativeAssessmentProcessor;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import tools.jackson.databind.ObjectMapper;

/**Adaptador HTTP que consume exclusivamente los endpoints internos generativos de Flask.*/
public final class HttpGenerativeAssessmentProcessor implements GenerativeAssessmentProcessor {
    private final HttpClient client;
    private final URI endpoint;
    private final String secret;
    private final ObjectMapper mapper;

    public HttpGenerativeAssessmentProcessor(String url, String secret, ObjectMapper mapper) {
        if (secret == null || secret.length() < 32) {
            throw new IllegalArgumentException("LEARNING_SERVICE_TOKEN must have at least 32 characters");
        }
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        this.endpoint = URI.create(url + "/internal/v1/learning/generate-assessment");
        this.secret = secret;
        this.mapper = mapper;
    }

    @Override
    public GeneratedAssessment generate(UUID subjectId, UUID documentId, String topic, String content, int questionCount) {
        try {
            var requestId = UUID.randomUUID();
            // Gemini recibe solo el presupuesto seguro definido por Flask. Se conserva
            // el tema solicitado y se evita rechazar un PDF largo por superar 100000 caracteres.
            var safeContent = content == null ? "" : content.trim();
            if (safeContent.length() > 90000) safeContent = safeContent.substring(0, 90000);

            var body = mapper.writeValueAsString(Map.of(
                    "requestId", requestId.toString(),
                    "subjectId", subjectId.toString(),
                    "documentId", documentId.toString(),
                    "topic", topic.trim(),
                    "content", safeContent,
                    "questionCount", questionCount
            ));

            var request = HttpRequest.newBuilder(endpoint)
                    .timeout(Duration.ofSeconds(75))
                    .header("Authorization", "Bearer " + secret)
                    .header("Content-Type", "application/json")
                    .header("X-Request-Id", requestId.toString())
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            var json = mapper.readTree(response.body());

            if (response.statusCode() != 200) {
                var code = json.path("errorCode").asText("GENERATIVE_SERVICE_ERROR");
                var message = switch (code) {
                    case "GEMINI_AUTH_ERROR" -> "Gemini rechazó la credencial configurada.";
                    case "GEMINI_MODEL_NOT_FOUND" -> "El modelo Gemini configurado no está disponible.";
                    case "RATE_LIMITED" -> "Gemini alcanzó temporalmente su límite de solicitudes.";
                    case "GEMINI_TIMEOUT" -> "Gemini excedió el tiempo de generación.";
                    case "VALIDATION" -> "Gemini recibió datos generativos incompletos o inválidos.";
                    default -> "El servicio generativo rechazó la solicitud.";
                };
                throw new GenerativeServiceException(response.statusCode(), code, message);
            }

            var assessmentId = UUID.fromString(json.path("assessmentId").asText());
            var questions = new ArrayList<GeneratedQuestion>();
            for (var node : json.path("questions")) {
                var options = new ArrayList<String>();
                node.path("options").forEach(option -> options.add(option.asText()));
                questions.add(new GeneratedQuestion(
                        node.path("question").asText(),
                        List.copyOf(options),
                        node.path("correctAnswer").asInt(-1),
                        node.path("difficulty").asText(),
                        node.path("topicId").asText()
                ));
            }
            return new GeneratedAssessment(assessmentId, List.copyOf(questions));
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Generative request interrupted");
        } catch (GenerativeServiceException error) {
            throw error;
        } catch (Exception error) {
            throw new IllegalStateException("Generative service unavailable");
        }
    }
}
