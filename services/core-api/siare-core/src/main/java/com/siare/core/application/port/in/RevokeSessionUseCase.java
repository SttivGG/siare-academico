package com.siare.core.application.port.in;
import java.util.UUID;
public interface RevokeSessionUseCase {
    void revoke(UUID actor, UUID sessionId);
    void revokeOthers(UUID actor, UUID currentSession);
    void revokeAll(UUID actor);
}
