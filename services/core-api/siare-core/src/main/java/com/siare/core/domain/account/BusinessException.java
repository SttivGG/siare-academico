package com.siare.core.domain.account;

public class BusinessException extends RuntimeException {
    public enum Kind { VALIDATION, DUPLICATE_EMAIL, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED, MFA_REQUIRED }
    private final Kind kind;

    public BusinessException(Kind kind, String message) {
        super(message);
        this.kind = kind;
    }

    public Kind kind() { return kind; }
}
