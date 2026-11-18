package com.siare.core.domain.activity;

public final class ActivityException extends RuntimeException {
    private final int status;
    private final String code;
    public ActivityException(int status, String code, String message) { super(message); this.status=status; this.code=code; }
    public int status() { return status; }
    public String code() { return code; }
    public static ActivityException validation(String message) { return new ActivityException(400,"VALIDATION",message); }
    public static ActivityException insufficient() { return new ActivityException(422,"INSUFFICIENT_CONTENT","Aporta un banco estructurado revisado o un documento READY con contenido estructurado suficiente."); }
}
