package com.siare.core.infrastructure.adapter.out.learning;

/**Error seguro del adaptador HTTP generativo: conserva estado y código sin exponer payload.*/
public final class GenerativeServiceException extends RuntimeException {
    private final int status;
    private final String code;

    public GenerativeServiceException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public int status() { return status; }
    public String code() { return code; }
}
