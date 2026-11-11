package com.siare.core.application.port.in;
import com.siare.core.domain.document.*;
import java.util.UUID;
public interface GetDocumentUseCase {
    DocumentMetadata get(UUID owner, UUID id);
    ExtractedContent text(UUID owner, UUID id);
}
