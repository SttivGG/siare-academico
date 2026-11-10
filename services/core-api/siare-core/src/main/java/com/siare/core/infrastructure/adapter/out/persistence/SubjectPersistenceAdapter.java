package com.siare.core.infrastructure.adapter.out.persistence;

import com.siare.core.application.port.out.SubjectRepository;
import com.siare.core.domain.subject.Subject;
import java.util.*;
import org.springframework.stereotype.Repository;

@Repository
public class SubjectPersistenceAdapter implements SubjectRepository {
    private final JpaSubjects subjects;
    public SubjectPersistenceAdapter(JpaSubjects subjects) { this.subjects = subjects; }
    @Override public Optional<Subject> findById(UUID id) { return subjects.findById(id).map(SubjectEntity::toDomain); }
    @Override public List<Subject> findByUserId(UUID userId) {
        return subjects.findByUserIdOrderByCreatedAtDescIdAsc(userId).stream().map(SubjectEntity::toDomain).toList();
    }
    @Override public Subject save(Subject subject) { return subjects.saveAndFlush(new SubjectEntity(subject)).toDomain(); }
}
