package com.siare.core.domain.document;

public final class DocumentException extends RuntimeException {
    private final String code;
    private final int status;
    public DocumentException(int status, String code, String message) {
        super(message); this.status = status; this.code = code;
    }
    public String code() { return code; }
    public int status() { return status; }
}
