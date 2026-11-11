package com.siare.core.infrastructure.adapter.out.persistence;

import com.siare.core.application.port.out.UserRepository;
import com.siare.core.domain.account.*;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;

@Repository
public class UserPersistenceAdapter implements UserRepository {
    private final JpaUsers users;
    private final org.springframework.jdbc.core.JdbcTemplate db;
    public UserPersistenceAdapter(JpaUsers users, org.springframework.jdbc.core.JdbcTemplate db) { this.users = users; this.db=db; }
    @Override public Optional<User> findByEmail(String email) { return users.findByEmail(email).map(UserEntity::toDomain); }
    @Override public Optional<User> findById(UUID id) { return users.findById(id).map(UserEntity::toDomain); }
    @Override @org.springframework.transaction.annotation.Transactional public User save(User user) {
        try {
            var saved=users.saveAndFlush(new UserEntity(user)).toDomain();
            db.update("INSERT INTO user_access(user_id,scope_id) SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM user_access WHERE user_id=?)",
                    user.id().toString(),com.siare.core.domain.identity.AdministrativeScope.COMMUNITY.toString(),user.id().toString());
            return saved;
        }
        catch (DataIntegrityViolationException ex) {
            // The unique constraint is authoritative even for concurrent registrations.
            throw new BusinessException(BusinessException.Kind.DUPLICATE_EMAIL, "Ya existe una cuenta con ese correo.");
        }
    }
}
