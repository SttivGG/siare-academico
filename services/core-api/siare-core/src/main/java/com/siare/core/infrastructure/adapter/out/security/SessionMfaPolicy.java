package com.siare.core.infrastructure.adapter.out.security;

import com.siare.core.application.port.out.*;
import com.siare.core.domain.identity.*;
import java.time.Clock;
import java.util.UUID;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

public final class SessionMfaPolicy implements PrivilegedAccessPolicy {
    private final SessionRepository sessions;
    private final MfaRepository mfa;
    private final Clock clock;
    public SessionMfaPolicy(SessionRepository sessions,MfaRepository mfa,Clock clock) { this.sessions=sessions; this.mfa=mfa; this.clock=clock; }
    @Override public boolean allowed(UserAccess actor) {
        var authentication=SecurityContextHolder.getContext().getAuthentication();
        if(authentication==null || !(authentication.getPrincipal() instanceof Jwt jwt) || !actor.userId().toString().equals(jwt.getSubject())) return false;
        try { return sessions.find(UUID.fromString(jwt.getClaimAsString("sid"))).filter(s -> allowed(actor,s)).isPresent(); }
        catch(IllegalArgumentException | NullPointerException ex) { return false; }
    }
    @Override public boolean allowed(UserAccess actor,UserSession session) {
        var now=clock.instant();
        return actor.enabled() && session.userId().equals(actor.userId()) && session.active(now) && session.mfa(now)
                && mfa.credential(actor.userId()).filter(MfaCredential::enabled).isPresent();
    }
}
