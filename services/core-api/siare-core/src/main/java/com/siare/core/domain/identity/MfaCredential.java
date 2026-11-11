package com.siare.core.domain.identity;

import java.time.Instant;
import java.util.UUID;

public record MfaCredential(UUID userId, String activeSecret, String pendingSecret,
                            Instant pendingExpiresAt, long lastUsedStep) {
    public boolean enabled() { return activeSecret != null; }
    public boolean pending(Instant now) { return pendingSecret != null && pendingExpiresAt != null && now.isBefore(pendingExpiresAt); }
    @Override public String toString() { return "MfaCredential[REDACTED]"; }
}
