package com.siare.core.infrastructure.adapter.out.persistence;

import com.siare.core.domain.account.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "users")
public class UserEntity {
    @Id @JdbcTypeCode(SqlTypes.CHAR) @Column(length = 36) UUID id;
    @Column(nullable = false, length = 100) String name;
    @Column(nullable = false, unique = true, length = 254) String email;
    @Column(name = "password_hash", nullable = false, length = 60) String passwordHash;
    @Column(name = "created_at", nullable = false) Instant createdAt;

    protected UserEntity() {}
    UserEntity(User user) {
        id = user.id(); name = user.name(); email = user.email();
        passwordHash = user.passwordHash(); createdAt = user.createdAt();
    }
    User toDomain() { return new User(id, name, email, passwordHash, createdAt); }
}
