package com.siare.core.application.service;

import com.siare.core.application.port.in.*;
import com.siare.core.application.port.out.*;
import com.siare.core.application.port.out.TokenPort.AccessToken;
import com.siare.core.domain.account.BusinessException;
import com.siare.core.domain.identity.*;
import java.security.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;

public final class SessionService implements RefreshSessionUseCase, RevokeSessionUseCase, LogoutUseCase {
    private final SessionRepository sessions;
    private final IdentityRepository identities;
    private final TransactionPort tx;
    private final TokenPort tokens;
    private final AuditPort audit;
    private final PrivilegedAccessPolicy privileged;
    private final Clock clock;
    private final Duration idle, absolute;
    private final int maximum;
    private final SecureRandom random = new SecureRandom();
    public SessionService(SessionRepository sessions, IdentityRepository identities, TransactionPort tx, TokenPort tokens,
            AuditPort audit, PrivilegedAccessPolicy privileged, Clock clock, Duration idle, Duration absolute, int maximum) {
        if (idle.compareTo(Duration.ofMinutes(1)) < 0 || absolute.compareTo(idle) < 0 || absolute.compareTo(Duration.ofDays(30)) > 0 || maximum < 1 || maximum > 20)
            throw new IllegalArgumentException("Política de sesiones inválida.");
        this.sessions=sessions; this.identities=identities; this.tx=tx; this.tokens=tokens; this.audit=audit;
        this.privileged=privileged; this.clock=clock; this.idle=idle; this.absolute=absolute; this.maximum=maximum;
    }
    public static String fingerprint(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
    public void requireEnabled(UserAccess access) {
        if (!access.enabled()) throw unauthorized();
    }
    public AccessToken open(UUID userId) {
        return open(userId,false,"PASSWORD");
    }
    /** Application-internal: invoked exclusively after an atomic factor verification. */
    AccessToken openMfa(UUID userId) { return open(userId,true,"MFA"); }
    AccessToken openFederated(UUID userId) { return open(userId,false,"OIDC"); }
    public void requireRecentPrimary(UUID userId,UUID sessionId) {
        var s=sessions.find(sessionId).orElseThrow(this::unauthorized);
        if(!s.userId().equals(userId) || !validate(userId,sessionId) || s.createdAt().isBefore(clock.instant().minusSeconds(300))
                || !Set.of("OIDC","MFA").contains(s.authenticationLevel())) throw new BusinessException(BusinessException.Kind.FORBIDDEN,"Vuelve a iniciar sesión con tu proveedor antes de cambiar MFA (máximo cinco minutos).");
    }
    private AccessToken open(UUID userId,boolean mfa,String level) {
        return tx.required(() -> {
            var access=identities.lockAccess(userId); requireEnabled(access);
            if(access.role()!=Role.USER && !mfa) throw new BusinessException(BusinessException.Kind.MFA_REQUIRED,"Se requiere verificar MFA.");
            // MySQL TIMESTAMP(6) rounds nanos; truncation avoids a persisted verification in the future.
            var now=clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
            var active=sessions.list(userId).stream().filter(s -> s.active(now)).toList();
            for (int i=0; i<=active.size()-maximum; i++) revokeInternal(userId,active.get(i).id(),"SESSION_LIMIT");
            var s=new UserSession(UUID.randomUUID(),userId,now,now,now.plus(idle),now.plus(absolute),null,0,
                    level,mfa?now:null,mfa?now.plus(Duration.ofHours(12)):null);
            sessions.insert(s);
            return issue(s);
        });
    }
    private AccessToken issue(UserSession session) {
        byte[] bytes=new byte[32]; random.nextBytes(bytes);
        String refresh=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        sessions.insertRefresh(fingerprint(refresh),session.id(),clock.instant());
        var expiry=session.mfaExpiresAt()!=null && session.mfaExpiresAt().isBefore(session.absoluteExpiresAt())?session.mfaExpiresAt():session.absoluteExpiresAt();
        var access=tokens.issue(session.userId(),session.id(),expiry);
        return new AccessToken(access.accessToken(),access.tokenType(),access.expiresAt(),refresh,expiry,session.id());
    }
    @Override public AccessToken refresh(String refreshToken) {
        if (refreshToken==null || !refreshToken.matches("[A-Za-z0-9_-]{43}")) throw unauthorized();
        String hash=fingerprint(refreshToken);
        // Invalid/reused outcomes are returned, then raised AFTER commit so revocation survives 401.
        AccessToken result=tx.required(() -> {
            var record=sessions.lookupRefresh(hash).orElse(null);
            if(record==null) return null;
            var initial=sessions.find(record.sessionId()).orElse(null);
            if(initial==null) return null;
            var access=identities.lockAccess(initial.userId());
            var session=sessions.lockSession(record.sessionId());
            record=sessions.refresh(hash).orElseThrow();
            if(record.consumedAt()!=null) {
                revokeInternal(session.userId(),session.id(),"REFRESH_REUSE");
                return null;
            }
            if(!session.active(clock.instant()) || !access.enabled() || (session.mfaExpiresAt()!=null && !session.mfa(clock.instant())) || (access.role()!=Role.USER && !privileged.allowed(access,session))) return null;
            sessions.consume(hash,clock.instant());
            sessions.touch(session.id(),clock.instant(),idleExpiry(session));
            return issue(session);
        });
        if(result==null) throw unauthorized();
        return result;
    }
    private Instant idleExpiry(UserSession s) {
        var candidate=clock.instant().plus(idle);
        return candidate.isBefore(s.absoluteExpiresAt())?candidate:s.absoluteExpiresAt();
    }
    /** Invoked after cryptographic JWT validation, using DB authority on every request. */
    public boolean validate(UUID userId, UUID sessionId) {
        return tx.required(() -> {
            var access=identities.lockAccess(userId);
            var session=sessions.find(sessionId).orElse(null);
            if(session==null || !session.userId().equals(userId) || !session.active(clock.instant()) || !access.enabled()) return false;
            if(session.mfaExpiresAt()!=null && !session.mfa(clock.instant())) return false;
            if(access.role()!=Role.USER && !privileged.allowed(access,session)) {
                event(userId,"PRIVILEGED_ACCESS","identity","DENIED",access.scopeId()); return false;
            }
            sessions.touch(session.id(),clock.instant(),idleExpiry(session));
            return true;
        });
    }
    public List<UserSession> list(UUID actor) { return sessions.list(actor).stream().filter(s -> s.active(clock.instant())).toList(); }
    @Override public void logout(UUID actor, UUID sessionId) { revoke(actor,sessionId); }
    @Override public void revoke(UUID actor, UUID sessionId) {
        boolean found=tx.required(() -> {
            identities.lockAccess(actor);
            var s=sessions.find(sessionId).orElse(null);
            if(s==null || !s.userId().equals(actor)) {
                event(actor,"SESSION_REVOKE", "session", "DENIED",null); return false;
            }
            revokeInternal(actor,sessionId,"SESSION_REVOKE"); return true;
        });
        if(!found) throw new BusinessException(BusinessException.Kind.NOT_FOUND,"Sesión no encontrada.");
    }
    @Override public void revokeOthers(UUID actor, UUID current) { revokeMany(actor,current); }
    @Override public void revokeAll(UUID actor) { revokeMany(actor,null); }
    public void revokeUserSessions(UUID actor, UUID userId) {
        tx.required(() -> {
            identities.lockAccess(userId);
            sessions.list(userId).stream().filter(s -> s.revokedAt()==null)
                    .forEach(s -> revokeInternal(actor,s.id(),"SESSION_REVOKE")); return null;
        });
    }
    private void revokeMany(UUID actor, UUID keep) {
        tx.required(() -> {
            identities.lockAccess(actor);
            sessions.list(actor).stream().filter(s -> s.revokedAt()==null && !s.id().equals(keep))
                    .forEach(s -> revokeInternal(actor,s.id(),"SESSION_REVOKE")); return null;
        });
    }
    private void revokeInternal(UUID actor, UUID session, String operation) {
        sessions.revoke(session,clock.instant()); event(actor,operation,"session:"+session,"SUCCESS",null);
    }
    public void event(UUID actor,String operation,String resource,String outcome,UUID scope) {
        audit.append(new AuditEvent(UUID.randomUUID(),actor,operation,resource,clock.instant(),outcome,scope));
    }
    private BusinessException unauthorized() { return new BusinessException(BusinessException.Kind.UNAUTHORIZED,"La sesión ha expirado o fue revocada. Inicia sesión de nuevo."); }
}
