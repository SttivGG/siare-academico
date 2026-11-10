package com.siare.core.infrastructure.adapter.in.web;

import com.siare.core.application.port.in.CheckHealthUseCase;
import com.siare.core.domain.health.ServiceHealth;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public final class HealthController {
    private final CheckHealthUseCase checkHealth;

    public HealthController(CheckHealthUseCase checkHealth) {
        this.checkHealth = checkHealth;
    }

    @GetMapping("/health")
    public ResponseEntity<ServiceHealth> health() {
        ServiceHealth health = checkHealth.check();
        return ResponseEntity.status(health.status() == ServiceHealth.Status.UP ? 200 : 503)
                .body(health);
    }
}
