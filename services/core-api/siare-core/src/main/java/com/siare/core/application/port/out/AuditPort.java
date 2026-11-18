package com.siare.core.application.port.out;

import com.siare.core.domain.identity.AuditEvent;
import java.util.List;

public interface AuditPort {
    void append(AuditEvent event);
    List<AuditEvent> list(int limit, int offset);
}
