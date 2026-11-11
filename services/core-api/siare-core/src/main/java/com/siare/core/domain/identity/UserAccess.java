package com.siare.core.domain.identity;

import java.util.UUID;

public record UserAccess(UUID userId, Role role, UUID scopeId, boolean enabled, long version) {}
