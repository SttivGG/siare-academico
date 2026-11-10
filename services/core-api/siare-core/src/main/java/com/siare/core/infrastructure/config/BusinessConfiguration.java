package com.siare.core.infrastructure.config;

import com.siare.core.application.port.in.*;
import com.siare.core.application.port.out.*;
import com.siare.core.application.service.*;
import java.time.Clock;
import org.springframework.context.annotation.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@Configuration(proxyBeanMethods = false)
public class BusinessConfiguration {
    @Bean Clock clock() { return Clock.systemUTC(); }
    @Bean PasswordPort passwordPort() {
        var encoder = new BCryptPasswordEncoder(12);
        return new PasswordPort() {
            public String hash(String password) { return encoder.encode(password); }
            public boolean matches(String password, String hash) { return encoder.matches(password, hash); }
        };
    }
    @Bean AccountUseCase accountUseCase(UserRepository users, PasswordPort passwords, TokenPort tokens, Clock clock) {
        return new AccountService(users, passwords, tokens, clock);
    }
    @Bean SubjectUseCase subjectUseCase(SubjectRepository subjects, Clock clock) { return new SubjectService(subjects, clock); }
}
