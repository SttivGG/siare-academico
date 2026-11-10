package com.siare.core.application.port.in;

import com.siare.core.domain.subject.Subject;
import java.util.List;
import java.util.UUID;

public interface SubjectUseCase {
    Subject create(UUID owner, String name, String description);
    List<Subject> list(UUID owner);
    Subject get(UUID owner, UUID id);
    Subject update(UUID owner, UUID id, String name, String description, boolean descriptionPresent);
    Subject archive(UUID owner, UUID id);
}
