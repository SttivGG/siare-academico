package com.siare.core.domain.identity;

import java.util.UUID;

public record AdministrativeScope(UUID id, String name, long version) {
    public static final UUID COMMUNITY = UUID.fromString("00000000-0000-0000-0000-000000000001");
}
