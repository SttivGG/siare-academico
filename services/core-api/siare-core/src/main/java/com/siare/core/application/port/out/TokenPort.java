package com.siare.core.application.port.out;

import java.time.Instant;
import java.util.UUID;

public interface TokenPort {
    record AccessToken(String accessToken, String tokenType, Instant expiresAt) {
        @Override public String toString() { return "AccessToken[REDACTED]"; }
    }
    AccessToken issue(UUID userId);
}
