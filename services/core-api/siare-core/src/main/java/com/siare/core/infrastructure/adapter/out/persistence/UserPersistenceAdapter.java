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
    public UserPersistenceAdapter(JpaUsers users) { this.users = users; }
    @Override public Optional<User> findByEmail(String email) { return users.findByEmail(email).map(UserEntity::toDomain); }
    @Override public Optional<User> findById(UUID id) { return users.findById(id).map(UserEntity::toDomain); }
    @Override public User save(User user) {
        try { return users.saveAndFlush(new UserEntity(user)).toDomain(); }
        catch (DataIntegrityViolationException ex) {
            // The unique constraint is authoritative even for concurrent registrations.
            throw new BusinessException(BusinessException.Kind.DUPLICATE_EMAIL, "Ya existe una cuenta con ese correo.");
        }
    }
}
