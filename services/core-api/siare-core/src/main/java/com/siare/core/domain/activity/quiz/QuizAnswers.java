package com.siare.core.domain.activity.quiz;
import java.util.Map;
public record QuizAnswers(Map<String,String> answers) implements QuizSubmission {
    public QuizAnswers { answers=Map.copyOf(answers); }
}
