package com.siare.core.domain.activity.factory;

import com.siare.core.domain.activity.Activity;
import com.siare.core.domain.activity.GenerationRequest;

public interface Generator<A extends Activity> {
    A generate(GenerationRequest request);
}
