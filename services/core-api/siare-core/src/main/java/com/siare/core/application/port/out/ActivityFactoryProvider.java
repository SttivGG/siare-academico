package com.siare.core.application.port.out;

import com.siare.core.domain.activity.ActivityFamily;
import com.siare.core.domain.activity.factory.ActivityFactory;

/** Future composition port; no provider is registered in Spring. */
public interface ActivityFactoryProvider {
    ActivityFactory<?, ?> forFamily(ActivityFamily family);
}
