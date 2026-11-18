package com.siare.core.application.port.in;

import com.siare.core.domain.identity.*;
import com.siare.core.application.port.out.TokenPort.AccessToken;
import java.util.*;

public interface FederatedIdentityUseCase {
    AccessToken login(FederatedPrincipal principal);
    void requireRecent(UUID user, UUID session);
    void link(UUID user, UUID session, FederatedPrincipal principal);
    List<ExternalIdentity> connected(UUID user);
    void unlink(UUID user, UUID session, UUID identity);
}
