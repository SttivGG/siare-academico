package com.siare.core.application.port.out;

import java.io.InputStream;

public interface DocumentStorage {
    String store(InputStream source, String filename, String contentType);
    InputStream open(String id);
    void delete(String id);
}
