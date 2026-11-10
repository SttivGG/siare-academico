package com.siare.core.infrastructure.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import jakarta.servlet.http.HttpServletResponse;
import tools.jackson.databind.ObjectMapper;
import com.siare.core.infrastructure.adapter.in.web.ApiError;

@Configuration(proxyBeanMethods = false)
public class SecurityConfiguration {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper mapper) {
        http.authorizeHttpRequests(requests -> requests
                .requestMatchers(HttpMethod.GET, "/health").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/auth/register", "/api/v1/auth/login").permitAll()
                .requestMatchers("/api/v1/**").authenticated()
                .anyRequest().denyAll());
        http.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
        // This API accepts bearer headers only, never browser session cookies.
        // Cookie-based CSRF protection belongs to the Next.js BFF boundary.
        http.csrf(csrf -> csrf.disable());
        http.requestCache(cache -> cache.disable());
        http.oauth2ResourceServer(resource -> resource.jwt(jwt -> {})
                .authenticationEntryPoint((request, response, ex) -> writeError(response, mapper, 401))
                .accessDeniedHandler((request, response, ex) -> writeError(response, mapper, 403)));
        http.exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, ex) -> writeError(response, mapper, 401))
                .accessDeniedHandler((request, response, ex) -> writeError(response, mapper, 403)));
        return http.build();
    }

    private void writeError(HttpServletResponse response, ObjectMapper mapper, int status) throws java.io.IOException {
        response.setStatus(status);
        if (status == 401) response.setHeader("WWW-Authenticate", "Bearer");
        response.setContentType("application/json");
        response.setHeader("Cache-Control", "no-store");
        mapper.writeValue(response.getOutputStream(), ApiError.of(status,
                status == 401 ? "UNAUTHORIZED" : "FORBIDDEN",
                status == 401 ? "Se requiere una sesión válida." : "Acceso denegado."));
    }
}
