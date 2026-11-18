package com.siare.core.infrastructure.adapter.in.web;

import com.siare.core.application.port.out.*;
import com.siare.core.application.service.*;
import com.siare.core.domain.identity.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class IdentityController {
    private final SessionService sessions;
    private final AdministrationService administration;
    private final IdentityRepository identities;
    public IdentityController(SessionService sessions,AdministrationService administration,IdentityRepository identities) {
        this.sessions=sessions; this.administration=administration; this.identities=identities;
    }
    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
    private UUID sid(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("sid")); }
    public record RefreshRequest(@NotBlank @Size(max=100) String refreshToken) {
        @Override public String toString() { return "RefreshRequest[REDACTED]"; }
    }
    public record Assignment(@NotNull Role role,@NotNull UUID scopeId,@NotNull Boolean enabled,@NotNull @Min(0) Long version) {}
    public record ScopeRequest(@NotBlank @Size(max=100) String name) {}
    public record ParameterRequest(@NotNull Boolean enabled,@NotNull @Min(0) Long version) {}
    @GetMapping("/admin/parameters/public-registration")
    IdentityParameter parameter(@AuthenticationPrincipal Jwt jwt) {
        return administration.registrationParameter(actor(jwt));
    }
    @PatchMapping("/admin/parameters/public-registration")
    IdentityParameter parameter(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody ParameterRequest request) {
        return administration.registrationParameter(actor(jwt),request.enabled(),request.version());
    }
    @PostMapping("/auth/refresh")
    TokenPort.AccessToken refresh(@Valid @RequestBody RefreshRequest request) { return sessions.refresh(request.refreshToken()); }
    @PostMapping("/auth/logout")
    Map<String,String> logout(@AuthenticationPrincipal Jwt jwt) {
        sessions.logout(actor(jwt),sid(jwt)); return Map.of("message","Sesión cerrada.");
    }
    @GetMapping("/users/me/identity")
    UserAccess profile(@AuthenticationPrincipal Jwt jwt) { return identities.access(actor(jwt)); }
    @GetMapping("/users/me/sessions")
    List<UserSession> sessions(@AuthenticationPrincipal Jwt jwt) { return sessions.list(actor(jwt)); }
    @DeleteMapping("/users/me/sessions/{id}")
    Map<String,String> revoke(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id) {
        sessions.revoke(actor(jwt),id); return Map.of("message","Sesión revocada.");
    }
    @PostMapping("/users/me/sessions/revoke-others")
    Map<String,String> revokeOthers(@AuthenticationPrincipal Jwt jwt) {
        sessions.revokeOthers(actor(jwt),sid(jwt)); return Map.of("message","Otras sesiones cerradas.");
    }
    @PostMapping("/users/me/sessions/revoke-all")
    Map<String,String> revokeAll(@AuthenticationPrincipal Jwt jwt) {
        sessions.revokeAll(actor(jwt)); return Map.of("message","Todas las sesiones cerradas.");
    }
    @GetMapping("/admin/overview")
    Map<String,Object> overview(@AuthenticationPrincipal Jwt jwt) {
        var access=administration.authorize(actor(jwt),false);
        sessions.event(actor(jwt),"ADMIN_DASHBOARD","administration","SUCCESS",access.scopeId());
        return Map.of("identity",access,"scopes",administration.scopes(actor(jwt)));
    }
    @GetMapping("/admin/users")
    List<UserAccess> users(@AuthenticationPrincipal Jwt jwt,@RequestParam(defaultValue="50") int limit,@RequestParam(defaultValue="0") int offset) {
        return administration.users(actor(jwt),limit,offset);
    }
    @PatchMapping("/admin/users/{id}/access")
    UserAccess assign(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody Assignment request) {
        return administration.assign(actor(jwt),id,request.role(),request.scopeId(),request.enabled(),request.version());
    }
    @GetMapping("/admin/scopes")
    List<AdministrativeScope> scopes(@AuthenticationPrincipal Jwt jwt) { return administration.scopes(actor(jwt)); }
    @PostMapping("/admin/scopes")
    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    AdministrativeScope scope(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody ScopeRequest request) {
        return administration.createScope(actor(jwt),request.name());
    }
    @GetMapping("/admin/audit")
    List<AuditEvent> audit(@AuthenticationPrincipal Jwt jwt,@RequestParam(defaultValue="50") int limit,@RequestParam(defaultValue="0") int offset) {
        return administration.audit(actor(jwt),limit,offset);
    }
}
