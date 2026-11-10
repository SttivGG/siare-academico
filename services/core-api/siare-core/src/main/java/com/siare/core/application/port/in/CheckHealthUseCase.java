package com.siare.core.application.port.in;

import com.siare.core.domain.health.ServiceHealth;

public interface CheckHealthUseCase {
    ServiceHealth check();
}
