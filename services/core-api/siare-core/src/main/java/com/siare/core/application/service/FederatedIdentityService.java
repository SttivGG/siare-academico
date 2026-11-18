package com.siare.core.application.service;

import com.siare.core.application.port.in.FederatedIdentityUseCase;
import com.siare.core.application.port.out.*;
import com.siare.core.application.port.out.TokenPort.AccessToken;
import com.siare.core.domain.account.*;
import com.siare.core.domain.identity.*;
import java.time.*;
import java.util.*;
import static com.siare.core.domain.account.BusinessException.Kind.*;
import static com.siare.core.domain.identity.OidcFailure.Code.*;

public final class FederatedIdentityService implements FederatedIdentityUseCase {
    private final ExternalIdentityRepository external;
    private final UserRepository users;
    private final IdentityRepository identities;
    private final SessionRepository repository;
    private final IdentityParameterPort parameters;
    private final TransactionPort tx;
    private final SessionService sessions;
    private final MfaService mfa;
    private final Clock clock;
    private final ExternalProviderPolicy providers;
    public FederatedIdentityService(ExternalIdentityRepository external,UserRepository users,IdentityRepository identities,
            SessionRepository repository,IdentityParameterPort parameters,TransactionPort tx,SessionService sessions,MfaService mfa,Clock clock,ExternalProviderPolicy providers) {
        this.external=external; this.users=users; this.identities=identities; this.repository=repository;
        this.parameters=parameters; this.tx=tx; this.sessions=sessions; this.mfa=mfa; this.clock=clock; this.providers=providers;
    }
    private void validate(FederatedPrincipal p) {
        if(!Set.of("google","gitlab").contains(p.provider()) || p.issuer()==null || p.issuer().length()>512 || p.subject()==null || p.subject().isBlank()
                || p.subject().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>255) throw new BusinessException(UNAUTHORIZED,"Identidad externa inválida.");
    }
    @Override public AccessToken login(FederatedPrincipal p) {
        validate(p);
        return tx.required(() -> {
            external.lockFederation();
            var identity=external.resolve(p.issuer(),p.subject());
            UUID user;
            if(identity.isPresent()) {
                if(!identity.get().provider().equals(p.provider())) throw new BusinessException(UNAUTHORIZED,"Proveedor incorrecto.");
                user=identity.get().userId();
            } else {
                String email=null;
                if(p.email()!=null) {
                    try { email=AccountRules.email(p.email()); } catch(BusinessException ignored) { /* Not a usable contact address. */ }
                }
                if(p.provider().equals("google") && (email==null || !p.emailVerified())) throw new OidcFailure(FORBIDDEN,OIDC_EMAIL_UNVERIFIED,"Google debe confirmar tu correo electrónico.");
                if(email!=null && users.findByEmail(email).isPresent()) throw new OidcFailure(CONFLICT,OIDC_EMAIL_LINK_REQUIRED,"Inicia sesión en tu cuenta SIARE y vincula el proveedor desde Seguridad.");
                if(!parameters.registration().enabled()) throw new OidcFailure(FORBIDDEN,OIDC_REGISTRATION_CLOSED,"El registro público está cerrado. Vincula una cuenta existente.");
                user=UUID.randomUUID();
                // An absent/invalid/unverified provider email must never become a recovery address.
                if(email==null || !p.emailVerified()) email=user+"@federated.invalid";
                String name=p.name()==null || p.name().isBlank()?"Usuario SIARE":p.name().strip();
                if(name.length()>100) name=name.substring(0,100);
                try { users.save(new User(user,name,email,"!OIDC",clock.instant())); }
                catch(BusinessException ex) {
                    if(ex.kind()==DUPLICATE_EMAIL) throw new OidcFailure(CONFLICT,OIDC_EMAIL_LINK_REQUIRED,"Inicia sesión en tu cuenta SIARE y vincula el proveedor desde Seguridad.");
                    throw ex;
                }
                external.insert(new ExternalIdentity(UUID.randomUUID(),user,p.provider(),p.issuer(),p.subject(),clock.instant()));
                sessions.event(user,"OIDC_REGISTER","identity","SUCCESS",null);
            }
            // Same primary-authentication gate as passwords: enabled state, TOTP and administrative MFA.
            var result=mfa.afterPrimaryAuthentication(user);
            sessions.event(user,"OIDC_LOGIN","identity",result.mfaRequired()?"PENDING":"SUCCESS",null);
            return result;
        });
    }
    @Override public void requireRecent(UUID user,UUID session) {
        var access=identities.lockAccess(user); sessions.requireEnabled(access);
        var s=repository.find(session).orElseThrow(() -> new BusinessException(UNAUTHORIZED,"Inicia sesión de nuevo."));
        if(!s.userId().equals(user) || !s.active(clock.instant()) || s.createdAt().isBefore(clock.instant().minusSeconds(300))
                || (access.role()!=Role.USER && !s.mfa(clock.instant())))
            throw new BusinessException(FORBIDDEN,"Vuelve a iniciar sesión antes de cambiar tus identidades conectadas (máximo cinco minutos).");
    }
    @Override public void link(UUID user,UUID session,FederatedPrincipal p) {
        validate(p);
        tx.required(() -> {
            external.lockFederation(); requireRecent(user,session);
            var existing=external.resolve(p.issuer(),p.subject());
            if(existing.isPresent()) throw new OidcFailure(CONFLICT,OIDC_IDENTITY_ALREADY_LINKED,"La identidad ya está vinculada. No se modificó ninguna cuenta.");
            if(external.connected(user).size()>=10) throw new BusinessException(CONFLICT,"Se alcanzó el límite de identidades conectadas.");
            external.insert(new ExternalIdentity(UUID.randomUUID(),user,p.provider(),p.issuer(),p.subject(),clock.instant()));
            sessions.event(user,"OIDC_LINK","identity","SUCCESS",null); return null;
        });
    }
    @Override public List<ExternalIdentity> connected(UUID user) { return external.connected(user); }
    @Override public void unlink(UUID user,UUID session,UUID identity) {
        tx.required(() -> {
            external.lockFederation(); requireRecent(user,session);
            var connected=external.connected(user);
            if(connected.stream().noneMatch(e -> e.id().equals(identity))) throw new BusinessException(NOT_FOUND,"Identidad no encontrada.");
            var hash=users.findById(user).orElseThrow().passwordHash();
            boolean password=hash.startsWith("$argon2id$") || hash.startsWith("$2");
            if(!password && connected.stream().noneMatch(e -> !e.id().equals(identity) && providers.enabled(e.provider())))
                throw new BusinessException(CONFLICT,"Conserva al menos una vía de acceso disponible. Vincula otro proveedor habilitado antes de desconectar este.");
            external.delete(user,identity); sessions.event(user,"OIDC_UNLINK","identity:"+identity,"SUCCESS",null);
            sessions.revokeOthers(user,session); return null;
        });
    }
}
