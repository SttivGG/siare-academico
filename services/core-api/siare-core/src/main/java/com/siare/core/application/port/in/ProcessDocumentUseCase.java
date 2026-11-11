package com.siare.core.application.port.in;
import com.siare.core.domain.document.DocumentMetadata;
import java.util.UUID;
public interface ProcessDocumentUseCase { DocumentMetadata process(UUID owner, UUID id, UUID operation); }
