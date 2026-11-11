package com.siare.core.application.port.out;

import com.siare.core.domain.identity.UserSession;
import java.time.Instant;
import java.util.*;

public interface SessionRepository {
    record RefreshRecord(String hash, UUID sessionId, Instant consumedAt) {}
    void insert(UserSession session);
    Optional<UserSession> find(UUID id);
    UserSession lockSession(UUID id);
    List<UserSession> list(UUID userId);
    void touch(UUID id, Instant now, Instant idleExpiry);
    void revoke(UUID id, Instant now);
    Optional<RefreshRecord> refresh(String hash);
    Optional<RefreshRecord> lookupRefresh(String hash);
    void insertRefresh(String hash, UUID sessionId, Instant now);
    void consume(String hash, Instant now);
}
