package com.siare.core.infrastructure.config;

import com.siare.core.application.port.in.CheckHealthUseCase;
import com.siare.core.application.port.out.ReadinessPort;
import com.siare.core.application.service.CheckHealthService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class ApplicationConfiguration {
    @Bean
    CheckHealthUseCase checkHealthUseCase(ReadinessPort readiness) {
        return new CheckHealthService(readiness);
    }
}
