package com.siare.core.domain.activity.factory;

import com.siare.core.domain.activity.Activity;
import com.siare.core.domain.activity.Submission;
import com.siare.core.domain.activity.Evaluation;

public interface Evaluator<A extends Activity, S extends Submission> {
    Evaluation evaluate(A activity, S submission);
}
