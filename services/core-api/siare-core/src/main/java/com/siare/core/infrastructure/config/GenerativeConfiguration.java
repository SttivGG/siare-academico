package com.siare.core.infrastructure.config;

import com.siare.core.application.port.out.GenerativeAssessmentProcessor;
import com.siare.core.infrastructure.adapter.out.learning.HttpGenerativeAssessmentProcessor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import tools.jackson.databind.ObjectMapper;

/**Configuración interna que conecta Spring con el adaptador generativo de Flask.*/
@Configuration(proxyBeanMethods = false)
@Profile("!test")
public class GenerativeConfiguration {
    @Bean
    GenerativeAssessmentProcessor generativeAssessmentProcessor(
            @Value("${siare.learning.processor-url:http://content-ai:5000}") String url,
            @Value("${siare.learning.service-token}") String token,
            ObjectMapper mapper) {
        return new HttpGenerativeAssessmentProcessor(url, token, mapper);
    }
}
