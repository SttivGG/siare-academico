package com.siare.core.application.port.in;
import com.siare.core.domain.identity.*;
import java.util.UUID;
public interface AssignRoleUseCase {
    UserAccess assign(UUID actor, UUID target, Role role, UUID scope, boolean enabled, long expectedVersion);
}
