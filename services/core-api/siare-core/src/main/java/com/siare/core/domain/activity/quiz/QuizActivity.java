package com.siare.core.domain.activity.quiz;
import com.siare.core.domain.activity.*;
import java.util.List;
public record QuizActivity(List<ActivityBank.Question> questions) implements Quiz {
    public QuizActivity { questions=List.copyOf(questions); }
    @Override public ActivityFamily family() { return ActivityFamily.QUIZ; }
    @Override public String toString() { return "QuizActivity[REDACTED]"; }
}
