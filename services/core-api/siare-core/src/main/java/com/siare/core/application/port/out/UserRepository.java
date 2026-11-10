package com.siare.core.application.port.out;

import com.siare.core.domain.account.User;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository {
    Optional<User> findByEmail(String email);
    Optional<User> findById(UUID id);
    User save(User user);
}
