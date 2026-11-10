package com.siare.core.application.service;

import com.siare.core.application.port.in.CheckHealthUseCase;
import com.siare.core.application.port.out.ReadinessPort;
import com.siare.core.domain.health.ServiceHealth;

public final class CheckHealthService implements CheckHealthUseCase {
    private final ReadinessPort readiness;

    public CheckHealthService(ReadinessPort readiness) {
        this.readiness = readiness;
    }

    @Override
    public ServiceHealth check() {
        return new ServiceHealth(readiness.isReady()
                ? ServiceHealth.Status.UP : ServiceHealth.Status.DOWN);
    }
}
