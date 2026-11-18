package com.siare.core.application.port.out;

import com.siare.core.domain.document.*;
import java.io.InputStream;
import java.util.UUID;

public interface DocumentProcessor {
    ExtractedContent extract(DocumentMetadata document, UUID operation, InputStream source);
}
