package com.siare.core.domain.activity.crossword;
import com.siare.core.domain.activity.*;
import com.siare.core.domain.activity.factory.*;
import java.util.Map;
public final class GridCrosswordFactory implements CrosswordFactory {
    @Override public ActivityFamily family() { return ActivityFamily.CROSSWORD; }
    @Override public Generator<Crossword> createGenerator() { return new CrosswordGenerator(); }
    @Override public Evaluator<Crossword,CrosswordSubmission> createEvaluator() { return new CrosswordEvaluator(); }
    @Override public FeedbackPolicy createFeedbackPolicy() { return new CrosswordFeedbackPolicy(); }
    @Override public Class<CrosswordActivity> activityClass() { return CrosswordActivity.class; }
    @Override public CrosswordSubmission submission(Map<String,String> answers) { return new CrosswordAnswers(answers); }
}
