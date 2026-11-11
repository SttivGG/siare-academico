package com.siare.core.application.port.in;
import com.siare.core.domain.document.DocumentMetadata;
import java.io.InputStream;
import java.util.UUID;
public interface DownloadDocumentUseCase {
    record Download(DocumentMetadata metadata, InputStream stream) {}
    Download download(UUID owner, UUID id);
}
