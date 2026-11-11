package com.siare.core.application.port.out;
import com.siare.core.domain.identity.IdentityParameter;
public interface IdentityParameterPort {
    IdentityParameter registration();
    void setRegistration(boolean enabled,long version);
}
