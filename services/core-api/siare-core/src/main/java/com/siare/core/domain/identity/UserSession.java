package com.siare.core.domain.identity;

import java.time.Instant;
import java.util.UUID;

public record UserSession(UUID id, UUID userId, Instant createdAt, Instant lastSeenAt,
        Instant idleExpiresAt, Instant absoluteExpiresAt, Instant revokedAt, long version,
        String authenticationLevel, Instant mfaVerifiedAt, Instant mfaExpiresAt) {
    public UserSession(UUID id,UUID userId,Instant createdAt,Instant lastSeenAt,Instant idleExpiresAt,Instant absoluteExpiresAt,Instant revokedAt,long version) {
        this(id,userId,createdAt,lastSeenAt,idleExpiresAt,absoluteExpiresAt,revokedAt,version,"PASSWORD",null,null);
    }
    public boolean mfa(Instant now) {
        return "MFA".equals(authenticationLevel) && mfaVerifiedAt!=null && !now.isBefore(mfaVerifiedAt) && mfaExpiresAt!=null && now.isBefore(mfaExpiresAt);
    }
    public boolean active(Instant now) {
        return revokedAt == null && now.isBefore(idleExpiresAt) && now.isBefore(absoluteExpiresAt);
    }
}
