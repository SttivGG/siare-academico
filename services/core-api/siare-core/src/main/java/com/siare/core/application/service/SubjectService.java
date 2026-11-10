package com.siare.core.application.service;

import com.siare.core.application.port.in.SubjectUseCase;
import com.siare.core.application.port.out.SubjectRepository;
import com.siare.core.domain.subject.Subject;
import com.siare.core.domain.account.BusinessException;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import static com.siare.core.domain.account.BusinessException.Kind.NOT_FOUND;

public final class SubjectService implements SubjectUseCase {
    private final SubjectRepository subjects;
    private final Clock clock;

    public SubjectService(SubjectRepository subjects, Clock clock) { this.subjects = subjects; this.clock = clock; }

    @Override public Subject create(UUID owner, String name, String description) {
        var now = clock.instant();
        return subjects.save(new Subject(UUID.randomUUID(), owner, name, description, false, now, now));
    }

    @Override public List<Subject> list(UUID owner) { return subjects.findByUserId(owner); }

    @Override public Subject get(UUID owner, UUID id) {
        var subject = subjects.findById(id).orElseThrow(() -> new BusinessException(NOT_FOUND, "Materia no encontrada."));
        subject.requireOwner(owner);
        return subject;
    }

    @Override public Subject update(UUID owner, UUID id, String name, String description, boolean descriptionPresent) {
        var subject = get(owner, id);
        return subjects.save(subject.update(name == null ? subject.name() : name,
                descriptionPresent ? description : subject.description(), clock.instant()));
    }

    @Override public Subject archive(UUID owner, UUID id) { return subjects.save(get(owner, id).archive(clock.instant())); }
}
