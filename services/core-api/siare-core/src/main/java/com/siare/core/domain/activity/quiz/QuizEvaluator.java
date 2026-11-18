package com.siare.core.domain.activity.quiz;
import com.siare.core.domain.activity.*;
import com.siare.core.domain.activity.factory.Evaluator;
import java.util.stream.Collectors;
public final class QuizEvaluator implements Evaluator<Quiz,QuizSubmission> {
    @Override public Evaluation evaluate(Quiz quiz,QuizSubmission submission) {
        var questions=((QuizActivity)quiz).questions(); var answers=((QuizAnswers)submission).answers();
        ActivityRules.answers(answers,questions.stream().map(ActivityBank.Question::id).collect(Collectors.toSet()));
        for(var q:questions) if(answers.containsKey(q.id()) && q.options().stream().noneMatch(o->o.id().equals(answers.get(q.id()))))
            throw ActivityException.validation("Una respuesta no identifica una opción disponible.");
        return new Evaluation(questions.stream().map(q->new Evaluation.Item(q.id(),q.correctOptionId().equals(answers.get(q.id())),
                answers.get(q.id()),q.correctOptionId(),q.explanation())).toList());
    }
}
