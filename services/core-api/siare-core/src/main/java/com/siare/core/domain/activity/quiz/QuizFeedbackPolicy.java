package com.siare.core.domain.activity.quiz;
import com.siare.core.domain.activity.Evaluation;
import com.siare.core.domain.activity.factory.FeedbackPolicy;
public final class QuizFeedbackPolicy implements FeedbackPolicy {
    @Override public String feedbackFor(Evaluation evaluation) {
        return evaluation.correct() ? "Opciones correctas. Revisa la justificación de cada pregunta." : "Revisa las opciones incorrectas y sus justificaciones.";
    }
}
