package com.siare.core.application.service;

import com.siare.core.application.port.in.*;
import com.siare.core.application.port.out.*;
import com.siare.core.domain.account.*;
import com.siare.core.domain.identity.*;
import java.util.*;

public final class AdministrationService implements AssignRoleUseCase, ManageAdministratorUseCase, ListAuditEventsUseCase {
    private final IdentityRepository identities;
    private final AuditPort audit;
    private final TransactionPort tx;
    private final SessionService sessions;
    private final PrivilegedAccessPolicy privileged;
    private final IdentityParameterPort parameters;
    public AdministrationService(IdentityRepository identities, AuditPort audit, TransactionPort tx, SessionService sessions, PrivilegedAccessPolicy privileged, IdentityParameterPort parameters) {
        this.identities=identities; this.audit=audit; this.tx=tx; this.sessions=sessions; this.privileged=privileged;
        this.parameters=parameters;
    }
    public IdentityParameter registrationParameter(UUID actor) {
        authorize(actor,true); sessions.event(actor,"PARAMETER_READ","public_registration_enabled","SUCCESS",null);
        return parameters.registration();
    }
    public IdentityParameter registrationParameter(UUID actor,boolean enabled,long version) {
        authorize(actor,true);
        return tx.required(() -> {
            identities.lockAccess(actor); authorize(actor,true);
            parameters.setRegistration(enabled,version);
            sessions.event(actor,"PARAMETER_CHANGE","public_registration_enabled:"+enabled,"SUCCESS",null);
            return parameters.registration();
        });
    }
    public UserAccess authorize(UUID actor, boolean superOnly) {
        var access=identities.access(actor);
        if(!access.enabled() || access.role()==Role.USER || (superOnly && access.role()!=Role.SUPERADMIN)) deny(actor,access.scopeId());
        if(!privileged.allowed(access)) {
            sessions.event(actor,"ADMIN_ACCESS","administration","DENIED",access.scopeId());
            throw new BusinessException(BusinessException.Kind.MFA_REQUIRED,"El acceso administrativo requiere una sesión MFA vigente.");
        }
        return access;
    }
    private void deny(UUID actor,UUID scope) {
        sessions.event(actor,"ADMIN_ACCESS","administration","DENIED",scope);
        throw new BusinessException(BusinessException.Kind.FORBIDDEN,"Acceso denegado.");
    }
    private void page(int limit,int offset) {
        if(limit<1 || limit>100 || offset<0 || offset>100000) throw new BusinessException(BusinessException.Kind.VALIDATION,"Paginación inválida: limit 1–100 y offset 0–100000.");
    }
    @Override public List<UserAccess> users(UUID actor,int limit,int offset) {
        page(limit,offset); var access=authorize(actor,false);
        sessions.event(actor,"ADMIN_USERS_READ","users","SUCCESS",access.scopeId());
        return identities.users(access.role()==Role.SUPERADMIN?null:access.scopeId(),limit,offset);
    }
    @Override public List<AdministrativeScope> scopes(UUID actor) {
        var access=authorize(actor,false);
        sessions.event(actor,"SCOPES_READ","scopes","SUCCESS",access.scopeId());
        return identities.scopes().stream().filter(s -> access.role()==Role.SUPERADMIN || s.id().equals(access.scopeId())).toList();
    }
    @Override public AdministrativeScope createScope(UUID actor,String name) {
        authorize(actor,true); String valid=AccountRules.name(name,100);
        return tx.required(() -> {
            authorize(actor,true);
            var scope=identities.createScope(valid);
            sessions.event(actor,"SCOPE_CREATE","scope:"+scope.id(),"SUCCESS",scope.id()); return scope;
        });
    }
    @Override public UserAccess assign(UUID actor,UUID target,Role role,UUID scope,boolean enabled,long expectedVersion) {
        authorize(actor,false);
        // Lock users in UUID order, also shared by session creation and credential upgrades.
        var result=tx.required(() -> {
            if(actor.toString().compareTo(target.toString())<=0) { identities.lockAccess(actor); identities.lockAccess(target); }
            else { identities.lockAccess(target); identities.lockAccess(actor); }
            var access=authorize(actor,false); var previous=identities.access(target);
            boolean denied=actor.equals(target) || previous.role()==Role.SUPERADMIN || role==Role.SUPERADMIN ||
                    (access.role()==Role.ADMIN && (previous.role()!=Role.USER || role!=Role.USER ||
                        !access.scopeId().equals(previous.scopeId()) || !access.scopeId().equals(scope)));
            if(denied) { sessions.event(actor,"ROLE_SCOPE_CHANGE","user:"+target,"DENIED",access.scopeId()); return null; }
            if(identities.scopes().stream().noneMatch(s -> s.id().equals(scope)))
                throw new BusinessException(BusinessException.Kind.NOT_FOUND,"Ámbito no encontrado.");
            if(previous.version()!=expectedVersion) throw new BusinessException(BusinessException.Kind.CONFLICT,"La asignación cambió. Recarga la página.");
            var updated=new UserAccess(target,role,scope,enabled,expectedVersion);
            identities.update(updated); sessions.revokeUserSessions(actor,target);
            sessions.event(actor,"ROLE_SCOPE_CHANGE","user:"+target+":"+previous.role()+"->"+role,"SUCCESS",scope);
            return identities.access(target);
        });
        if(result==null) throw new BusinessException(BusinessException.Kind.FORBIDDEN,"No puedes modificar esa asignación.");
        return result;
    }
    @Override public List<AuditEvent> audit(UUID actor,int limit,int offset) {
        page(limit,offset); var access=authorize(actor,true);
        sessions.event(actor,"AUDIT_READ","audit","SUCCESS",access.scopeId());
        return audit.list(limit,offset);
    }
}
