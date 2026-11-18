package com.siare.core.application.port.in;

import java.util.*;
import com.siare.core.application.port.out.TokenPort.AccessToken;

public interface ConfirmMfaUseCase {
    record Confirmation(List<String> recoveryCodes, AccessToken session) {
        @Override public String toString() { return "Confirmation[REDACTED]"; }
    }
    Confirmation confirm(UUID actor, String code);
    Confirmation confirmChallenge(String challenge, String code);
}
