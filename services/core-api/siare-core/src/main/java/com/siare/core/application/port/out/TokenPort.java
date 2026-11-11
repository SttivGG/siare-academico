package com.siare.core.application.port.out;

import java.time.Instant;
import java.util.UUID;

public interface TokenPort {
    record AccessToken(String accessToken, String tokenType, Instant expiresAt, String refreshToken,
                       Instant refreshExpiresAt, UUID sessionId, String challengeToken, Instant challengeExpiresAt,
                       boolean mfaRequired, boolean enrollmentRequired) {
        public AccessToken(String accessToken,String tokenType,Instant expiresAt,String refreshToken,Instant refreshExpiresAt,UUID sessionId) {
            this(accessToken,tokenType,expiresAt,refreshToken,refreshExpiresAt,sessionId,null,null,false,false);
        }
        public static AccessToken challenge(String challenge,Instant expiry,boolean enroll) {
            return new AccessToken(null,null,null,null,null,null,challenge,expiry,true,enroll);
        }
        @Override public String toString() { return "AccessToken[REDACTED]"; }
    }
    AccessToken issue(UUID userId, UUID sessionId, Instant absoluteExpiry);
}
