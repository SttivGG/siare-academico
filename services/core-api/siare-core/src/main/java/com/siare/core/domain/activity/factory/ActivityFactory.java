package com.siare.core.domain.activity.factory;

import com.siare.core.domain.activity.Activity;
import com.siare.core.domain.activity.ActivityFamily;
import com.siare.core.domain.activity.Submission;

/** Abstract Factory contract. No concrete factory or product is implemented yet. */
public interface ActivityFactory<A extends Activity, S extends Submission> {
    ActivityFamily family();
    Generator<A> createGenerator();
    Evaluator<A, S> createEvaluator();
    FeedbackPolicy createFeedbackPolicy();
}
