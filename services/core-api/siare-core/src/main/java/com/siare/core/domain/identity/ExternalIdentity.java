package com.siare.core.domain.identity;

import java.time.Instant;
import java.util.UUID;

public record ExternalIdentity(UUID id, UUID userId, String provider, String issuer, String subject, Instant linkedAt) {}
