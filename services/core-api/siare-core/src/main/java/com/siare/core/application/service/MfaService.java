package com.siare.core.application.service;

import com.siare.core.application.port.in.*;
import com.siare.core.application.port.out.*;
import com.siare.core.application.port.out.TokenPort.AccessToken;
import com.siare.core.domain.account.*;
import com.siare.core.domain.identity.*;
import java.security.SecureRandom;
import java.time.*;
import java.util.*;
import java.util.function.Function;

public final class MfaService implements EnrollMfaUseCase, ConfirmMfaUseCase, VerifyMfaUseCase, RecoverMfaUseCase {
    private final MfaRepository mfa;
    private final TotpPort totp;
    private final UserRepository users;
    private final IdentityRepository identities;
    private final PasswordPort passwords;
    private final LoginAttemptPort attempts;
    private final TransactionPort tx;
    private final SessionService sessions;
    private final Clock clock;
    private final SecureRandom random=new SecureRandom();
    public MfaService(MfaRepository mfa,TotpPort totp,UserRepository users,IdentityRepository identities,PasswordPort passwords,
                      LoginAttemptPort attempts,TransactionPort tx,SessionService sessions,Clock clock) {
        this.mfa=mfa; this.totp=totp; this.users=users; this.identities=identities; this.passwords=passwords;
        this.attempts=attempts; this.tx=tx; this.sessions=sessions; this.clock=clock;
    }
    public static String opaque(SecureRandom random,int bytes) {
        byte[] value=new byte[bytes]; random.nextBytes(value); return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }
    private MfaCredential credential(UUID user) { return mfa.credential(user).orElse(new MfaCredential(user,null,null,null,-1)); }
    /** Called only after password verification under the same user_access lock. No JWT is issued here. */
    public AccessToken afterPassword(UUID user) {
        var access=identities.lockAccess(user); sessions.requireEnabled(access);
        var c=credential(user);
        if(access.role()==Role.USER && !c.enabled()) return sessions.open(user);
        mfa.invalidateChallenges(user,clock.instant());
        String challenge=opaque(random,32); var expiry=clock.instant().plusSeconds(300);
        mfa.insertChallenge(SessionService.fingerprint(challenge),user,expiry);
        sessions.event(user,"MFA_CHALLENGE","identity","PENDING",access.scopeId());
        return AccessToken.challenge(challenge,expiry,!c.enabled());
    }
    private BusinessException invalid() { return new BusinessException(BusinessException.Kind.UNAUTHORIZED,"El código o desafío no es válido, ha vencido o ya fue utilizado."); }
    private void reserve(UUID user) {
        try { attempts.acquire("mfa:"+user); }
        catch(BusinessException ex) {
            if(ex.kind()==BusinessException.Kind.RATE_LIMITED) failed(user,"MFA_RATE_LIMITED");
            throw ex;
        }
    }
    private void enabled(UUID user) { sessions.requireEnabled(identities.lockAccess(user)); }
    private void password(UUID user,String password) {
        if(password==null || password.length()>2048 || !passwords.matches(password,users.findById(user).orElseThrow(this::invalid).passwordHash())) throw invalid();
    }
    private boolean factor(MfaCredential c,String code,boolean allowRecovery) {
        if(!c.enabled()) return false;
        long step=totp.verify(totp.decrypt(c.userId(),c.activeSecret()),code,clock.instant(),c.lastUsedStep());
        if(step>=0) { mfa.save(new MfaCredential(c.userId(),c.activeSecret(),c.pendingSecret(),c.pendingExpiresAt(),step)); return true; }
        if(allowRecovery && code!=null && code.matches("[A-Za-z0-9_-]{22}") && mfa.consumeRecovery(c.userId(),recoveryHash(c.userId(),code),clock.instant())) {
            sessions.event(c.userId(),"MFA_RECOVERY_USED","identity","SUCCESS",null); return true;
        }
        return false;
    }
    private String recoveryHash(UUID user,String code) { return SessionService.fingerprint(user+":"+code); }
    private List<String> recovery(UUID user) {
        List<String> codes=new ArrayList<>(); for(int i=0;i<10;i++) codes.add(opaque(random,16));
        mfa.replaceRecovery(user,codes.stream().map(c -> recoveryHash(user,c)).toList()); return List.copyOf(codes);
    }
    private void failed(UUID user,String operation) { sessions.event(user,operation,"identity","DENIED",null); }
    private Enrollment pending(UUID user) {
        var c=credential(user); String seed=totp.generateSecret(); var expiry=clock.instant().plusSeconds(600);
        mfa.save(new MfaCredential(user,c.activeSecret(),totp.encrypt(user,seed),expiry,c.lastUsedStep()));
        sessions.event(user,"MFA_ENROLL","identity","PENDING",null);
        return new Enrollment(totp.uri(users.findById(user).orElseThrow(this::invalid).email(),seed),expiry);
    }
    @Override public Enrollment enroll(UUID actor,String password,String code) {
        reserve(actor);
        var result=tx.required(() -> {
            enabled(actor); var c=credential(actor);
            try { password(actor,password); } catch(BusinessException ex) { failed(actor,"MFA_REAUTH"); return null; }
            if(c.enabled() && !factor(c,code,true)) { failed(actor,"MFA_REAUTH"); return null; }
            return pending(actor);
        });
        if(result==null) throw invalid(); return result;
    }
    private <T> T challenge(String token,Function<MfaRepository.Challenge,T> work) {
        if(token==null || !token.matches("[A-Za-z0-9_-]{43}")) throw invalid();
        String hash=SessionService.fingerprint(token);
        var initial=mfa.challenge(hash,false).orElseThrow(this::invalid); reserve(initial.userId());
        T result=tx.required(() -> {
            // Global lock order: user_access -> challenge -> credential -> session/refresh.
            enabled(initial.userId()); var c=mfa.challenge(hash,true).orElseThrow(this::invalid);
            if(!c.active(clock.instant())) { failed(c.userId(),"MFA_CHALLENGE_EXPIRED"); return null; }
            mfa.attempt(hash); return work.apply(c);
        });
        // Failures commit attempt counters, consumed steps and audit before returning 401.
        if(result==null) throw invalid(); return result;
    }
    @Override public Enrollment enrollChallenge(String token) {
        return challenge(token,c -> {
            if(credential(c.userId()).enabled()) { failed(c.userId(),"MFA_ENROLL"); return null; }
            return pending(c.userId());
        });
    }
    private Confirmation activate(UUID user,String code) {
        var c=credential(user);
        if(!c.pending(clock.instant())) { failed(user,"MFA_CONFIRM"); return null; }
        long step=totp.verify(totp.decrypt(user,c.pendingSecret()),code,clock.instant(),-1);
        if(step<0) { failed(user,"MFA_CONFIRM"); return null; }
        mfa.save(new MfaCredential(user,c.pendingSecret(),null,null,step));
        List<String> codes=recovery(user);
        sessions.revokeAll(user); mfa.invalidateChallenges(user,clock.instant());
        sessions.event(user,"MFA_CONFIRMED","identity","SUCCESS",null);
        return new Confirmation(codes,sessions.openMfa(user));
    }
    @Override public Confirmation confirm(UUID actor,String code) {
        reserve(actor); var result=tx.required(() -> { enabled(actor); return activate(actor,code); });
        if(result==null) throw invalid(); return result;
    }
    @Override public Confirmation confirmChallenge(String token,String code) {
        return challenge(token,c -> {
            if(credential(c.userId()).enabled()) return null;
            return activate(c.userId(),code);
        });
    }
    private AccessToken finish(String token,String code,boolean recovery) {
        return challenge(token,c -> {
            var credential=credential(c.userId());
            boolean accepted=recovery
                    ? credential.enabled() && code!=null && code.matches("[A-Za-z0-9_-]{22}") && mfa.consumeRecovery(c.userId(),recoveryHash(c.userId(),code),clock.instant())
                    : factor(credential,code,false);
            if(!accepted) { failed(c.userId(),recovery?"MFA_RECOVERY_USED":"MFA_VERIFY"); return null; }
            mfa.invalidateChallenges(c.userId(),clock.instant());
            if(recovery) sessions.revokeAll(c.userId());
            sessions.event(c.userId(),recovery?"MFA_RECOVERY_USED":"MFA_VERIFY","identity","SUCCESS",null);
            return sessions.openMfa(c.userId());
        });
    }
    @Override public AccessToken verify(String challenge,String code) { return finish(challenge,code,false); }
    @Override public AccessToken recover(String challenge,String code) { return finish(challenge,code,true); }
    @Override public List<String> regenerate(UUID actor,String password,String code) {
        reserve(actor);
        var result=tx.required(() -> {
            enabled(actor);
            try { password(actor,password); } catch(BusinessException ex) { failed(actor,"MFA_REAUTH"); return null; }
            if(!factor(credential(actor),code,true)) { failed(actor,"MFA_REAUTH"); return null; }
            var codes=recovery(actor); mfa.invalidateChallenges(actor,clock.instant());
            sessions.revokeAll(actor);
            sessions.event(actor,"MFA_RECOVERY_REGENERATED","identity","SUCCESS",null); return codes;
        });
        if(result==null) throw invalid(); return result;
    }
    @Override public void disable(UUID actor,String password,String code) {
        reserve(actor);
        boolean result=tx.required(() -> {
            enabled(actor);
            if(identities.access(actor).role()!=Role.USER) throw new BusinessException(BusinessException.Kind.FORBIDDEN,"MFA es obligatorio para administradores; puedes reemplazar el factor.");
            try { password(actor,password); } catch(BusinessException ex) { failed(actor,"MFA_REAUTH"); return false; }
            if(!factor(credential(actor),code,true)) { failed(actor,"MFA_REAUTH"); return false; }
            mfa.save(new MfaCredential(actor,null,null,null,-1)); mfa.replaceRecovery(actor,List.of());
            mfa.invalidateChallenges(actor,clock.instant()); sessions.revokeAll(actor);
            sessions.event(actor,"MFA_DISABLED","identity","SUCCESS",null); return true;
        });
        if(!result) throw invalid();
    }
    public record Status(String state,boolean pendingReplacement,int recoveryCodesRemaining,boolean required) {}
    public Status status(UUID actor) {
        return tx.required(() -> {
            enabled(actor); var c=credential(actor);
            return new Status(c.enabled()?"ENABLED":c.pending(clock.instant())?"PENDING":"DISABLED",c.enabled() && c.pending(clock.instant()),
                    mfa.remainingRecovery(actor),identities.access(actor).role()!=Role.USER);
        });
    }
}
