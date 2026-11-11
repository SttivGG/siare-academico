package com.siare.core.application.port.in;
import com.siare.core.domain.identity.*;
import java.util.*;
public interface ManageAdministratorUseCase {
    List<UserAccess> users(UUID actor, int limit, int offset);
    List<AdministrativeScope> scopes(UUID actor);
    AdministrativeScope createScope(UUID actor, String name);
}
