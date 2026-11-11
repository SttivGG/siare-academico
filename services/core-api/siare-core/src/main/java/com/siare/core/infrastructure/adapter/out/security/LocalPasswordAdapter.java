package com.siare.core.infrastructure.adapter.out.security;

import com.siare.core.application.port.out.PasswordPort;
import com.siare.core.domain.account.BusinessException;
import com.siare.core.domain.identity.PasswordPolicy;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Semaphore;
import java.util.function.Supplier;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public final class LocalPasswordAdapter implements PasswordPort {
    private final Argon2PasswordEncoder argon;
    private final BCryptPasswordEncoder bcrypt=new BCryptPasswordEncoder();
    private final Semaphore capacity=new Semaphore(2);
    public LocalPasswordAdapter(int memoryKiB,int iterations,int parallelism) {
        if(memoryKiB<19456 || memoryKiB>65536 || iterations<2 || iterations>6 || parallelism<1 || parallelism>4)
            throw new IllegalArgumentException("Parámetros Argon2id fuera del presupuesto de memoria.");
        argon=new Argon2PasswordEncoder(16,32,parallelism,memoryKiB,iterations);
    }
    private <T> T bounded(Supplier<T> work) {
        if(!capacity.tryAcquire()) throw new BusinessException(BusinessException.Kind.RATE_LIMITED,"Demasiados intentos. Espera y vuelve a intentarlo.");
        try { return work.get(); } finally { capacity.release(); }
    }
    @Override public String hash(String password) { PasswordPolicy.bound(password); return bounded(() -> argon.encode(PasswordPolicy.normalize(password))); }
    @Override public boolean matches(String password,String hash) {
        return bounded(() -> {
            if(hash.startsWith("$2")) return password.getBytes(StandardCharsets.UTF_8).length<=72 && bcrypt.matches(password,hash);
            return hash.startsWith("$argon2id$") && argon.matches(PasswordPolicy.normalize(password),hash);
        });
    }
    @Override public boolean needsUpgrade(String hash) { return !hash.startsWith("$argon2id$") || argon.upgradeEncoding(hash); }
}
