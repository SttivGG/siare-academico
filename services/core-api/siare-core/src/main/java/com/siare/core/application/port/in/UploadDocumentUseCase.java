package com.siare.core.application.port.in;

import com.siare.core.domain.document.DocumentMetadata;
import java.io.InputStream;
import java.util.UUID;
import java.util.function.Supplier;

public interface UploadDocumentUseCase {
    DocumentMetadata upload(UUID owner, UUID subject, String filename, String declaredMime, long size, Supplier<InputStream> source);
}
