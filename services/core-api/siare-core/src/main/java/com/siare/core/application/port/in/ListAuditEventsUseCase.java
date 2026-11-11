package com.siare.core.application.port.in;
import com.siare.core.domain.identity.AuditEvent;
import java.util.*;
public interface ListAuditEventsUseCase { List<AuditEvent> audit(UUID actor, int limit, int offset); }
