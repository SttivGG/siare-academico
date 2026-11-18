package com.siare.core.domain.activity.factory;

import com.siare.core.domain.activity.Activity;
import com.siare.core.domain.activity.ActivityFamily;
import com.siare.core.domain.activity.Submission;
import java.util.Map;

/** Typed family: all products and the submission adapter belong to the same family. */
public interface ActivityFactory<A extends Activity, S extends Submission> {
    ActivityFamily family();
    Generator<A> createGenerator();
    Evaluator<A, S> createEvaluator();
    FeedbackPolicy createFeedbackPolicy();
    Class<? extends A> activityClass();
    S submission(Map<String, String> answers);
}
