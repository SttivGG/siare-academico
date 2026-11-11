package com.siare.core.application.port.in;

import com.siare.core.application.port.out.TokenPort.AccessToken;
import java.util.*;

public interface RecoverMfaUseCase {
    AccessToken recover(String challenge, String recoveryCode);
    List<String> regenerate(UUID actor, String password, String code);
    void disable(UUID actor, String password, String code);
}
