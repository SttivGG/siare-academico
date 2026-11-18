package com.siare.core.domain.activity.quiz;
import com.siare.core.domain.activity.*;
import com.siare.core.domain.activity.factory.*;
import java.util.Map;
public final class BankQuizFactory implements QuizFactory {
    @Override public ActivityFamily family() { return ActivityFamily.QUIZ; }
    @Override public Generator<Quiz> createGenerator() { return new QuizGenerator(); }
    @Override public Evaluator<Quiz,QuizSubmission> createEvaluator() { return new QuizEvaluator(); }
    @Override public FeedbackPolicy createFeedbackPolicy() { return new QuizFeedbackPolicy(); }
    @Override public Class<QuizActivity> activityClass() { return QuizActivity.class; }
    @Override public QuizSubmission submission(Map<String,String> answers) { return new QuizAnswers(answers); }
}
