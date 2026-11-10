package com.siare.core.application.port.in;
import com.siare.core.domain.document.DocumentMetadata;
import java.util.*;
public interface ListDocumentsUseCase { List<DocumentMetadata> list(UUID owner, UUID subject); }
