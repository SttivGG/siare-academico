package com.siare.core.application.port.in;

import com.siare.core.domain.activity.Activity;
import com.siare.core.domain.activity.ActivityFamily;
import com.siare.core.domain.activity.GenerationRequest;

/** Future input port; intentionally has no service implementation or endpoint. */
public interface GenerateActivityUseCase {
    Activity generate(ActivityFamily family, GenerationRequest request);
}
