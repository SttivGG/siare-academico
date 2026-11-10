package com.siare.core.application.port.out;

import com.siare.core.domain.subject.Subject;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SubjectRepository {
    Optional<Subject> findById(UUID id);
    List<Subject> findByUserId(UUID userId);
    Subject save(Subject subject);
}
