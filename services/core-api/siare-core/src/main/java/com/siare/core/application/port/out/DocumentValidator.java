package com.siare.core.application.port.out;

import com.siare.core.domain.document.DocumentType;
import java.io.InputStream;

public interface DocumentValidator {
    void validate(InputStream source, DocumentType type);
    /** Admission to private storage is not permission to download or process a document. */
    default void validateForStorage(InputStream source, DocumentType type) { validate(source, type); }
}
