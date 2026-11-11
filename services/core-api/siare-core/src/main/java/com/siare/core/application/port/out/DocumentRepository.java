package com.siare.core.application.port.out;

import com.siare.core.domain.document.*;
import java.time.Instant;
import java.util.*;

public interface DocumentRepository {
    void insert(DocumentMetadata metadata);
    Optional<DocumentMetadata> find(UUID id);
    List<DocumentMetadata> list(UUID owner, UUID subject);
    Optional<DocumentMetadata> claim(UUID id, UUID operation, Instant now, Instant leaseUntil);
    boolean complete(UUID id, UUID operation, ExtractedContent content, Instant now);
    void fail(UUID id, UUID operation, String code, Instant now);
    Optional<ExtractedContent> content(UUID id, UUID operation);
}
