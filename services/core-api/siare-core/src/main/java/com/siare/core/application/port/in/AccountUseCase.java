package com.siare.core.application.port.in;

import com.siare.core.domain.account.User;
import com.siare.core.application.port.out.TokenPort.AccessToken;
import java.util.UUID;

public interface AccountUseCase {
    User register(String name, String email, String password);
    AccessToken login(String email, String password);
    User me(UUID userId);
}
