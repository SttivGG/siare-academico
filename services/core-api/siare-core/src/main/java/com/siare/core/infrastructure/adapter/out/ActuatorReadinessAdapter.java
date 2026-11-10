package com.siare.core.infrastructure.adapter.out;

import com.siare.core.application.port.out.ReadinessPort;
import org.springframework.boot.health.actuate.endpoint.HealthEndpoint;
import org.springframework.boot.health.contributor.Status;
import org.springframework.stereotype.Component;

/** Includes the real JDBC and Mongo health contributors configured by Boot. */
@Component
public final class ActuatorReadinessAdapter implements ReadinessPort {
    private final HealthEndpoint healthEndpoint;

    public ActuatorReadinessAdapter(HealthEndpoint healthEndpoint) {
        this.healthEndpoint = healthEndpoint;
    }

    @Override
    public boolean isReady() {
        return Status.UP.equals(healthEndpoint.health().getStatus());
    }
}
