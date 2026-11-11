package com.siare.core.application.service;

import com.siare.core.application.port.in.AccountUseCase;
import com.siare.core.application.port.out.*;
import com.siare.core.domain.account.*;
import java.time.Clock;
import java.util.UUID;
import com.siare.core.domain.identity.PasswordPolicy;
import static com.siare.core.domain.account.BusinessException.Kind.*;

public final class AccountService implements AccountUseCase {
    private final UserRepository users;
    private final PasswordPort passwords;
    private final SessionService sessions;
    private final PasswordScreeningPort screening;
    private final LoginAttemptPort attempts;
    private final TransactionPort tx;
    private final IdentityRepository identities;
    private final IdentityParameterPort parameters;
    private final Clock clock;
    private final String dummyHash;
    private final MfaService mfa;

    public AccountService(UserRepository users, PasswordPort passwords, SessionService sessions, Clock clock,
                          PasswordScreeningPort screening, LoginAttemptPort attempts, TransactionPort tx, IdentityRepository identities, IdentityParameterPort parameters,MfaService mfa) {
        this.users = users;
        this.passwords = passwords;
        this.sessions = sessions; this.screening=screening; this.attempts=attempts; this.tx=tx; this.identities=identities;
        this.parameters=parameters;
        this.mfa=mfa;
        this.clock = clock;
        this.dummyHash = passwords.hash(UUID.randomUUID().toString());
    }

    @Override public User register(String name, String email, String password) {
        if(!parameters.registration().enabled()) throw new BusinessException(FORBIDDEN,"El registro público está temporalmente cerrado.");
        String normalized = AccountRules.email(email);
        String validName = AccountRules.name(name, 100);
        String validPassword=PasswordPolicy.validate(password);
        attempts.acquire("register:"+normalized);
        if(screening.compromised(validPassword)) throw new BusinessException(VALIDATION,"Esa contraseña es común o está comprometida. Elige otra frase.");
        if (users.findByEmail(normalized).isPresent()) {
            throw new BusinessException(DUPLICATE_EMAIL, "Ya existe una cuenta con ese correo.");
        }
        return users.save(new User(UUID.randomUUID(), validName, normalized, passwords.hash(validPassword), clock.instant()));
    }

    @Override public TokenPort.AccessToken login(String email, String password) {
        String normalized = AccountRules.email(email);
        if (password == null || password.isEmpty() || password.length()>2048 || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 4096) {
            throw new BusinessException(UNAUTHORIZED, "Correo o contraseña incorrectos.");
        }
        attempts.acquire(normalized);
        var user = users.findByEmail(normalized);
        boolean matches = passwords.matches(password, user.map(User::passwordHash).orElse(dummyHash));
        if (user.isEmpty() || !matches) throw new BusinessException(UNAUTHORIZED, "Correo o contraseña incorrectos.");
        var authenticated=user.get();
        sessions.requireEnabled(identities.access(authenticated.id()));
        return tx.required(() -> {
            identities.lockAccess(authenticated.id());
            var current=users.findById(authenticated.id()).orElseThrow();
            if(!current.passwordHash().equals(authenticated.passwordHash())) throw new BusinessException(UNAUTHORIZED,"La cuenta cambió. Inicia sesión de nuevo.");
            if(passwords.needsUpgrade(current.passwordHash()))
                users.save(new User(current.id(),current.name(),current.email(),passwords.hash(password),current.createdAt()));
            return mfa.afterPassword(current.id());
        });
    }

    @Override public User me(UUID userId) {
        return users.findById(userId).orElseThrow(() -> new BusinessException(UNAUTHORIZED, "La sesión ya no es válida."));
    }
}
