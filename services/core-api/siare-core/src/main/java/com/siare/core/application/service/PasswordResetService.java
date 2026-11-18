package com.siare.core.application.service;

import com.siare.core.application.port.in.*;
import com.siare.core.application.port.out.*;
import com.siare.core.domain.account.*;
import com.siare.core.domain.identity.PasswordPolicy;
import java.security.SecureRandom;
import java.time.*;
import java.util.concurrent.Executor;

public final class PasswordResetService implements RequestPasswordResetUseCase, CompletePasswordResetUseCase {
    private final UserRepository users;
    private final IdentityRepository identities;
    private final PasswordResetRepository resets;
    private final MfaRepository mfa;
    private final PasswordPort passwords;
    private final PasswordScreeningPort screening;
    private final LoginAttemptPort attempts;
    private final TransactionPort tx;
    private final SessionService sessions;
    private final SecurityMailPort mail;
    private final Executor executor;
    private final Clock clock;
    private final SecureRandom random=new SecureRandom();
    public PasswordResetService(UserRepository users,IdentityRepository identities,PasswordResetRepository resets,MfaRepository mfa,
            PasswordPort passwords,PasswordScreeningPort screening,LoginAttemptPort attempts,TransactionPort tx,SessionService sessions,
            SecurityMailPort mail,Executor executor,Clock clock) {
        this.users=users; this.identities=identities; this.resets=resets; this.mfa=mfa; this.passwords=passwords; this.screening=screening;
        this.attempts=attempts; this.tx=tx; this.sessions=sessions; this.mail=mail; this.executor=executor; this.clock=clock;
    }
    @Override public void request(String email) {
        String normalized=AccountRules.email(email);
        try { attempts.acquire("password-reset-request:"+normalized); }
        catch(BusinessException ex) { if(ex.kind()==BusinessException.Kind.RATE_LIMITED) return; throw ex; }
        // The public response does not await account lookup or SMTP, including for missing accounts.
        try { executor.execute(() -> deliver(normalized)); }
        catch(java.util.concurrent.RejectedExecutionException ex) { sessions.event(null,"PASSWORD_RESET_QUEUE_FULL","identity","DENIED",null); }
    }
    private void deliver(String email) {
        var found=users.findByEmail(email); if(found.isEmpty()) return;
        var user=found.get(); String token=MfaService.opaque(random,32);
        try {
            boolean ready=tx.required(() -> {
                if(!identities.lockAccess(user.id()).enabled()) return false;
                resets.invalidate(user.id(),clock.instant());
                resets.insert(SessionService.fingerprint(token),user.id(),clock.instant().plusSeconds(900));
                sessions.event(user.id(),"PASSWORD_RESET_REQUEST","identity","SUCCESS",null); return true;
            });
            if(ready) {
                mail.passwordReset(user.email(),token);
                sessions.event(user.id(),"PASSWORD_RESET_DELIVERY","identity","SUCCESS",null);
            }
        } catch(Exception ex) { sessions.event(user.id(),"PASSWORD_RESET_DELIVERY","identity","FAILED",null); }
    }
    private BusinessException invalid() { return new BusinessException(BusinessException.Kind.UNAUTHORIZED,"El enlace no es válido, ha vencido o ya fue utilizado. Solicita otro."); }
    @Override public void complete(String token,String newPassword) {
        // Isolate token budgets; the existing global/minute ceiling still bounds random-token probes.
        attempts.acquire("password-reset-complete:"+SessionService.fingerprint(token==null?"":token));
        if(token==null || !token.matches("[A-Za-z0-9_-]{43}")) throw invalid();
        String hash=SessionService.fingerprint(token);
        var initial=resets.find(hash,false).orElseThrow(this::invalid);
        attempts.acquire("password-reset-token:"+initial.userId());
        String valid=PasswordPolicy.validate(newPassword);
        if(screening.compromised(valid)) throw new BusinessException(BusinessException.Kind.VALIDATION,"Esa contraseña es común o está comprometida. Elige otra frase.");
        // Expensive hashing is bounded by the existing Argon2 semaphore and request limits.
        String passwordHash=passwords.hash(valid);
        User changed=tx.required(() -> {
            var access=identities.lockAccess(initial.userId());
            var current=resets.find(hash,true).orElseThrow(this::invalid);
            if(!access.enabled() || current.consumedAt()!=null || !clock.instant().isBefore(current.expiresAt()) || !resets.consume(hash,clock.instant())) {
                sessions.event(initial.userId(),"PASSWORD_RESET_COMPLETE","identity","DENIED",null); return null;
            }
            var user=users.findById(initial.userId()).orElseThrow(this::invalid);
            var updated=users.save(new User(user.id(),user.name(),user.email(),passwordHash,user.createdAt()));
            resets.invalidate(user.id(),clock.instant()); mfa.invalidateChallenges(user.id(),clock.instant());
            // Pending enrollment derived from the old password is invalidated; active MFA is preserved.
            mfa.credential(user.id()).ifPresent(c -> mfa.save(new com.siare.core.domain.identity.MfaCredential(c.userId(),c.activeSecret(),null,null,c.lastUsedStep())));
            sessions.revokeAll(user.id()); sessions.event(user.id(),"PASSWORD_RESET_COMPLETE","identity","SUCCESS",null);
            return updated;
        });
        if(changed==null) throw invalid();
        try { executor.execute(() -> {
            try {
                mail.passwordChanged(changed.email());
                sessions.event(changed.id(),"PASSWORD_CHANGED_DELIVERY","identity","SUCCESS",null);
            }
            catch(Exception ex) { sessions.event(changed.id(),"PASSWORD_CHANGED_DELIVERY","identity","FAILED",null); }
        }); } catch(java.util.concurrent.RejectedExecutionException ex) { sessions.event(changed.id(),"PASSWORD_CHANGED_DELIVERY","identity","FAILED",null); }
    }
}
