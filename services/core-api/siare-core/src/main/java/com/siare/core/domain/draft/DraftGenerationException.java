package com.siare.core.domain.draft;

/** Stable safe failures; provider messages and payloads never cross this boundary. */
public final class DraftGenerationException extends RuntimeException {
    private final int status;
    private final String code;
    private final Integer retryAfter;

    public DraftGenerationException(int status, String code) { this(status, code, null); }
    public DraftGenerationException(int status, String code, Integer retryAfter) {
        super("No se pudo preparar el borrador académico (" + code + ").");
        this.status = status; this.code = code; this.retryAfter = retryAfter;
    }
    public int status() { return status; }
    public String code() { return code; }
    public Integer retryAfter() { return retryAfter; }
    public static DraftGenerationException invalidContract() { return new DraftGenerationException(502, "GENERATOR_CONTRACT_INVALID"); }
}
