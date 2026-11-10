package com.siare.core.application.service;

import com.siare.core.application.port.in.AccountUseCase;
import com.siare.core.application.port.out.*;
import com.siare.core.domain.account.*;
import java.time.Clock;
import java.util.UUID;
import static com.siare.core.domain.account.BusinessException.Kind.*;

public final class AccountService implements AccountUseCase {
    private final UserRepository users;
    private final PasswordPort passwords;
    private final TokenPort tokens;
    private final Clock clock;
    private final String dummyHash;

    public AccountService(UserRepository users, PasswordPort passwords, TokenPort tokens, Clock clock) {
        this.users = users;
        this.passwords = passwords;
        this.tokens = tokens;
        this.clock = clock;
        this.dummyHash = passwords.hash(UUID.randomUUID().toString());
    }

    @Override public User register(String name, String email, String password) {
        String normalized = AccountRules.email(email);
        String validName = AccountRules.name(name, 100);
        AccountRules.password(password);
        if (users.findByEmail(normalized).isPresent()) {
            throw new BusinessException(DUPLICATE_EMAIL, "Ya existe una cuenta con ese correo.");
        }
        return users.save(new User(UUID.randomUUID(), validName, normalized, passwords.hash(password), clock.instant()));
    }

    @Override public TokenPort.AccessToken login(String email, String password) {
        String normalized = AccountRules.email(email);
        if (password == null || password.isBlank() || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
            throw new BusinessException(UNAUTHORIZED, "Correo o contraseña incorrectos.");
        }
        var user = users.findByEmail(normalized);
        boolean matches = passwords.matches(password, user.map(User::passwordHash).orElse(dummyHash));
        if (user.isEmpty() || !matches) throw new BusinessException(UNAUTHORIZED, "Correo o contraseña incorrectos.");
        return tokens.issue(user.get().id());
    }

    @Override public User me(UUID userId) {
        return users.findById(userId).orElseThrow(() -> new BusinessException(UNAUTHORIZED, "La sesión ya no es válida."));
    }
}
