package com.siare.core.infrastructure.adapter.out.persistence;

import com.siare.core.domain.subject.Subject;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "subjects")
public class SubjectEntity {
    @Id @JdbcTypeCode(SqlTypes.CHAR) @Column(length = 36) UUID id;
    @JdbcTypeCode(SqlTypes.CHAR) @Column(name = "user_id", nullable = false, length = 36) UUID userId;
    @Column(nullable = false, length = 120) String name;
    @Column(length = 2000) String description;
    @Column(nullable = false) boolean archived;
    @Column(name = "created_at", nullable = false) Instant createdAt;
    @Column(name = "updated_at", nullable = false) Instant updatedAt;

    protected SubjectEntity() {}
    SubjectEntity(Subject s) {
        id = s.id(); userId = s.userId(); name = s.name(); description = s.description();
        archived = s.archived(); createdAt = s.createdAt(); updatedAt = s.updatedAt();
    }
    Subject toDomain() { return new Subject(id, userId, name, description, archived, createdAt, updatedAt); }
}
