package com.siare.core.application.port.out;

import java.time.Instant;
import java.util.UUID;

public interface TotpPort {
    String generateSecret();
    String encrypt(UUID owner, String secret);
    String decrypt(UUID owner, String encrypted);
    long verify(String secret, String code, Instant now, long lastUsedStep);
    String uri(String email, String secret);
}
