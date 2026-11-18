package com.siare.core.application.port.out;

import com.siare.core.domain.identity.UserAccess;

/** Authority is the persisted session and factor, never a client-provided MFA flag. */
public interface PrivilegedAccessPolicy {
    boolean allowed(UserAccess actor);
    default boolean allowed(UserAccess actor,com.siare.core.domain.identity.UserSession session) { return allowed(actor); }
}
