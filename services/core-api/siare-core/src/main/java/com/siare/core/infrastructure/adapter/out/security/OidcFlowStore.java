package com.siare.core.infrastructure.adapter.out.security;

import java.time.*;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class OidcFlowStore {
    public record Flow(String provider,String bindingHash,String nonce,String verifier,String state,String redirectUri,UUID user,UUID session,Instant expiresAt) {
        @Override public String toString() { return "OidcFlow[REDACTED]"; }
    }
    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;
    @org.springframework.beans.factory.annotation.Autowired
    public OidcFlowStore(StringRedisTemplate redis,ObjectMapper mapper) { this.redis=redis; this.mapper=mapper; }
    protected OidcFlowStore() { this.redis=null; this.mapper=null; }
    private String key(String state) { return "siare:oidc:flow:"+com.siare.core.application.service.SessionService.fingerprint(state); }
    public void put(Flow flow) {
        if(!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(key(flow.state()),mapper.writeValueAsString(flow),Duration.ofMinutes(5))))
            throw new IllegalStateException("Colisión de estado OIDC.");
    }
    public Flow take(String state) {
        String value=redis.opsForValue().getAndDelete(key(state));
        return value==null?null:mapper.readValue(value,Flow.class);
    }
}
