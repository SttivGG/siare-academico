package com.siare.core.application.port.out;

import java.time.Instant;
import java.util.*;

public interface PasswordResetRepository {
    record ResetToken(String hash, UUID userId, Instant expiresAt, Instant consumedAt) {
        @Override public String toString() { return "ResetToken[REDACTED]"; }
    }
    void insert(String hash, UUID userId, Instant expiresAt);
    Optional<ResetToken> find(String hash, boolean lock);
    boolean consume(String hash, Instant now);
    void invalidate(UUID userId, Instant now);
}
