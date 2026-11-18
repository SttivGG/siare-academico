package com.siare.core.application.port.out;

import com.siare.core.domain.document.DocumentType;
import java.io.InputStream;

public interface DocumentValidator {
    void validate(InputStream source, DocumentType type);
}
