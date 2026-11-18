package com.siare.core.application.port.out;

import com.siare.core.domain.identity.ExternalIdentity;
import java.util.*;

public interface ExternalIdentityRepository {
    void lockFederation();
    Optional<ExternalIdentity> resolve(String issuer, String subject);
    List<ExternalIdentity> connected(UUID userId);
    void insert(ExternalIdentity identity);
    void delete(UUID userId, UUID identityId);
}
