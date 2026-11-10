package com.siare.core.infrastructure.adapter.out.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JpaSubjects extends JpaRepository<SubjectEntity, UUID> {
    List<SubjectEntity> findByUserIdOrderByCreatedAtDescIdAsc(UUID userId);
}
