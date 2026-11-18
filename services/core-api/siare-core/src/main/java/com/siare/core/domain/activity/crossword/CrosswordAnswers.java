package com.siare.core.domain.activity.crossword;
import java.util.Map;
public record CrosswordAnswers(Map<String,String> answers) implements CrosswordSubmission {
    public CrosswordAnswers { answers=Map.copyOf(answers); }
}
