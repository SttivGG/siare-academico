package com.siare.core.domain.document;

import java.time.Instant;
import java.util.UUID;

public record DocumentMetadata(UUID documentId, UUID subjectId, UUID ownerId, String gridfsId,
        String originalFilename, String contentType, long sizeBytes, String checksum,
        DocumentStatus status, Instant createdAt, Instant processedAt, String errorCode,
        UUID operationId, Instant leaseUntil) {}
