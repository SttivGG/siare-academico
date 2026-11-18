package com.siare.core.application.port.out;

public interface LoginAttemptPort {
    /** Reserves an attempt before running an expensive password hash. */
    void acquire(String normalizedEmail);
}
