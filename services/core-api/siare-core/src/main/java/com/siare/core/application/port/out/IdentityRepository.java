package com.siare.core.application.port.out;

import com.siare.core.domain.identity.*;
import java.util.*;

public interface IdentityRepository {
    UserAccess access(UUID userId);
    UserAccess lockAccess(UUID userId);
    void update(UserAccess access);
    List<UserAccess> users(UUID scopeId, int limit, int offset);
    List<AdministrativeScope> scopes();
    AdministrativeScope createScope(String name);
    void lockBootstrap();
    boolean bootstrapped();
    void finishBootstrap();
}
