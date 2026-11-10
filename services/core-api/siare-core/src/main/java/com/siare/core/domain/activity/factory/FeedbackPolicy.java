package com.siare.core.domain.activity.factory;

import com.siare.core.domain.activity.Evaluation;

public interface FeedbackPolicy {
    String feedbackFor(Evaluation evaluation);
}
