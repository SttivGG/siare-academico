package com.siare.core.application.port.out;

import java.util.List;
import java.util.UUID;

/**Port de salida para generación educativa mediante el servicio interno.*/
public interface GenerativeAssessmentProcessor {
    GeneratedAssessment generate(UUID subjectId, UUID documentId, String topic, String content, int questionCount);

    record GeneratedAssessment(UUID assessmentId, List<GeneratedQuestion> questions) {}
    record GeneratedQuestion(String question, List<String> options, int correctAnswer,
                             String difficulty, String topicId) {}
}
