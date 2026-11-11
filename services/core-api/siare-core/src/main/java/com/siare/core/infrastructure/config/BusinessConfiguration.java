package com.siare.core.infrastructure.config;

import com.siare.core.application.port.in.*;
import com.siare.core.application.port.out.*;
import com.siare.core.application.service.*;
import java.time.Clock;
import org.springframework.context.annotation.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import com.siare.core.infrastructure.adapter.out.security.*;
import java.time.Duration;

@Configuration(proxyBeanMethods = false)
public class BusinessConfiguration {
    @Bean Clock clock() { return Clock.systemUTC(); }
    @Bean PasswordPort passwordPort(@Value("${siare.password.memory-kib:19456}") int memory,
            @Value("${siare.password.iterations:2}") int iterations,@Value("${siare.password.parallelism:1}") int parallelism) {
        return new LocalPasswordAdapter(memory,iterations,parallelism);
    }
    @Bean PasswordScreeningPort passwordScreening(@Value("${siare.password.blocklist-file:}") String file) throws java.io.IOException { return new LocalPasswordScreening(file); }
    @Bean PrivilegedAccessPolicy privilegedAccessPolicy(SessionRepository sessions,MfaRepository mfa,Clock clock) { return new SessionMfaPolicy(sessions,mfa,clock); }
    @Bean @Profile("!test") TotpPort totpPort(@Value("${siare.mfa.key-file:/run/siare-mfa/totp.key}") String file) { return new AesTotpAdapter(file); }
    @Bean MfaService mfaService(MfaRepository mfa,TotpPort totp,UserRepository users,IdentityRepository identities,PasswordPort passwords,
            LoginAttemptPort attempts,TransactionPort tx,SessionService sessions,Clock clock) {
        return new MfaService(mfa,totp,users,identities,passwords,attempts,tx,sessions,clock);
    }
    @Bean(destroyMethod="shutdown") java.util.concurrent.ExecutorService securityMailExecutor() {
        return new java.util.concurrent.ThreadPoolExecutor(1,1,0,java.util.concurrent.TimeUnit.SECONDS,
                new java.util.concurrent.ArrayBlockingQueue<>(32),new java.util.concurrent.ThreadPoolExecutor.AbortPolicy());
    }
    @Bean SecurityMailPort securityMail(@Value("${siare.mail.host:}") String host,@Value("${siare.mail.port:587}") int port,
            @Value("${siare.mail.username:}") String username,@Value("${siare.mail.password:}") String password,
            @Value("${siare.mail.from:}") String from,@Value("${siare.mail.origin:http://127.0.0.1:3100}") String origin) {
        return new SmtpSecurityMail(host,port,username,password,from,origin);
    }
    @Bean PasswordResetService passwordResetService(UserRepository users,IdentityRepository identities,PasswordResetRepository resets,MfaRepository mfa,
            PasswordPort passwords,PasswordScreeningPort screening,LoginAttemptPort attempts,TransactionPort tx,SessionService sessions,
            SecurityMailPort mail,java.util.concurrent.ExecutorService securityMailExecutor,Clock clock) {
        return new PasswordResetService(users,identities,resets,mfa,passwords,screening,attempts,tx,sessions,mail,securityMailExecutor,clock);
    }
    @Bean LoginAttemptPort loginAttempts(JdbcTemplate db,TransactionPort tx,Clock clock,
            @Value("${siare.login.per-account:5}") int perAccount,@Value("${siare.login.global-per-minute:120}") int global) {
        return new JdbcLoginAttempts(db,tx,clock,perAccount,global);
    }
    @Bean SessionService sessionService(SessionRepository sessions,IdentityRepository identities,TransactionPort tx,TokenPort tokens,
            AuditPort audit,PrivilegedAccessPolicy privileged,Clock clock,@Value("${siare.session.idle:PT30M}") Duration idle,
            @Value("${siare.session.absolute:P7D}") Duration absolute,@Value("${siare.session.maximum:5}") int maximum) {
        return new SessionService(sessions,identities,tx,tokens,audit,privileged,clock,idle,absolute,maximum);
    }
    @Bean AdministrationService administrationService(IdentityRepository identities,AuditPort audit,TransactionPort tx,SessionService sessions,PrivilegedAccessPolicy privileged,IdentityParameterPort parameters) {
        return new AdministrationService(identities,audit,tx,sessions,privileged,parameters);
    }
    @Bean AccountUseCase accountUseCase(UserRepository users,PasswordPort passwords,SessionService sessions,Clock clock,
            PasswordScreeningPort screening,LoginAttemptPort attempts,TransactionPort tx,IdentityRepository identities,IdentityParameterPort parameters,MfaService mfa) {
        return new AccountService(users,passwords,sessions,clock,screening,attempts,tx,identities,parameters,mfa);
    }
    @Bean SubjectUseCase subjectUseCase(SubjectRepository subjects, Clock clock) { return new SubjectService(subjects, clock); }
}
