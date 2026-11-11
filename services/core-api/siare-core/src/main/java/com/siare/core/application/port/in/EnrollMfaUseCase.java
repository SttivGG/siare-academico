package com.siare.core.application.port.in;

import java.time.Instant;
import java.util.UUID;

public interface EnrollMfaUseCase {
    record Enrollment(String otpauthUri, Instant expiresAt) {
        @Override public String toString() { return "Enrollment[REDACTED]"; }
    }
    Enrollment enroll(UUID actor, String password, String code);
    Enrollment enrollChallenge(String challenge);
}
