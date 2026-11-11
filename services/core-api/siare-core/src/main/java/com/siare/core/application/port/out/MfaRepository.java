package com.siare.core.application.port.out;

import com.siare.core.domain.identity.MfaCredential;
import java.time.Instant;
import java.util.*;

public interface MfaRepository {
    record Challenge(String hash, UUID userId, Instant expiresAt, int attempts, Instant consumedAt) {
        public boolean active(Instant now) { return consumedAt == null && attempts < 5 && now.isBefore(expiresAt); }
        @Override public String toString() { return "Challenge[REDACTED]"; }
    }
    Optional<MfaCredential> credential(UUID userId);
    void save(MfaCredential credential);
    void insertChallenge(String hash, UUID userId, Instant expiresAt);
    Optional<Challenge> challenge(String hash, boolean lock);
    void attempt(String hash);
    void consumeChallenge(String hash, Instant now);
    void invalidateChallenges(UUID userId, Instant now);
    void replaceRecovery(UUID userId, List<String> hashes);
    boolean consumeRecovery(UUID userId, String hash, Instant now);
    int remainingRecovery(UUID userId);
}
