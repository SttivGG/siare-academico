package com.siare.core.domain.identity;

import java.time.Instant;
import java.util.UUID;

public record AuditEvent(UUID id, UUID actorId, String operation, String resource,
        Instant occurredAt, String outcome, UUID scopeId) {}
