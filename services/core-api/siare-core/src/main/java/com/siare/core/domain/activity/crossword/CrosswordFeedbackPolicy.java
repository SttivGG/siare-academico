package com.siare.core.domain.activity.crossword;
import com.siare.core.domain.activity.Evaluation;
import com.siare.core.domain.activity.factory.FeedbackPolicy;
public final class CrosswordFeedbackPolicy implements FeedbackPolicy {
    @Override public String feedbackFor(Evaluation evaluation) {
        return evaluation.correct() ? "Palabras correctas y cruces completados." : "Comprueba las palabras incorrectas con sus pistas y cruces.";
    }
}
