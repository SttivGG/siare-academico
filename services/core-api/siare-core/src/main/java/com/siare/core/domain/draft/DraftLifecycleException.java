package com.siare.core.domain.draft;

import java.util.UUID;

public final class DraftLifecycleException extends RuntimeException {
    private final int status;
    private final String code;
    private final UUID activityId;
    public DraftLifecycleException(int status, String code) { this(status, code, null); }
    public DraftLifecycleException(int status, String code, UUID activityId) {
        super("No se pudo completar la operación del borrador (" + code + ").");
        this.status = status; this.code = code; this.activityId = activityId;
    }
    public int status() { return status; }
    public String code() { return code; }
    public UUID activityId() { return activityId; }
}
