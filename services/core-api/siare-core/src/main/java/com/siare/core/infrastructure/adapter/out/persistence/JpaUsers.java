package com.siare.core.infrastructure.adapter.out.persistence;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JpaUsers extends JpaRepository<UserEntity, UUID> {
    Optional<UserEntity> findByEmail(String email);
}
