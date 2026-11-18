package com.siare.core.infrastructure.adapter.in.web;

import com.siare.core.application.port.in.FederatedIdentityUseCase;
import com.siare.core.application.port.out.*;
import com.siare.core.application.service.*;
import com.siare.core.domain.account.BusinessException;
import com.siare.core.domain.identity.OidcFailure;
import static com.siare.core.domain.identity.OidcFailure.Code.*;
import com.siare.core.infrastructure.adapter.out.security.*;
import com.siare.core.infrastructure.adapter.out.security.OidcFlowStore.Flow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class OidcController {
    private static final org.slf4j.Logger LOG=org.slf4j.LoggerFactory.getLogger(OidcController.class);
    private final OidcProviders providers;
    private final OidcProtocol protocol;
    private final OidcFlowStore flows;
    private final FederatedIdentityUseCase identities;
    private final TransactionPort tx;
    private final LoginAttemptPort attempts;
    private final Clock clock;
    private final SecureRandom random=new SecureRandom();
    public OidcController(OidcProviders providers,OidcProtocol protocol,OidcFlowStore flows,FederatedIdentityUseCase identities,
            TransactionPort tx,LoginAttemptPort attempts,Clock clock) {
        this.providers=providers; this.protocol=protocol; this.flows=flows; this.identities=identities; this.tx=tx; this.attempts=attempts; this.clock=clock;
    }
    public record Start(@Pattern(regexp="google|gitlab") @NotNull String provider,@Pattern(regexp="[A-Za-z0-9_-]{43}") @NotNull String binding,Boolean confirmed) {
        @Override public String toString() { return "OidcStart[REDACTED]"; }
    }
    public record Complete(@Pattern(regexp="google|gitlab") @NotNull String provider,@Pattern(regexp="[A-Za-z0-9_-]{43}") @NotNull String binding,
            @Pattern(regexp="[A-Za-z0-9_-]{43}") @NotNull String state,@NotBlank @Size(max=4096) String code) {
        @Override public String toString() { return "OidcComplete[REDACTED]"; }
    }
    @GetMapping("/auth/oidc/providers") Object providers() { return providers.status(); }
    @ExceptionHandler({org.springframework.web.client.RestClientException.class,org.springframework.data.redis.RedisConnectionFailureException.class})
    ResponseEntity<ApiError> unavailable(Exception ex,jakarta.servlet.http.HttpServletRequest request) {
        var code=ex instanceof org.springframework.data.redis.RedisConnectionFailureException ? OIDC_STORE_UNAVAILABLE : OIDC_TOKEN_ENDPOINT_UNAVAILABLE;
        return failure(503,code.name(),"No se pudo contactar al proveedor o al almacén temporal. Vuelve a iniciar el flujo.",request);
    }
    @ExceptionHandler(BusinessException.class)
    ResponseEntity<ApiError> rejected(BusinessException ex,jakarta.servlet.http.HttpServletRequest request) {
        int status=switch(ex.kind()) {
            case VALIDATION -> 400; case UNAUTHORIZED -> 401; case FORBIDDEN, MFA_REQUIRED -> 403;
            case NOT_FOUND -> 404; case CONFLICT, DUPLICATE_EMAIL -> 409; case RATE_LIMITED -> 429;
        };
        String code=ex instanceof OidcFailure failure ? failure.code().name() : ex.kind()==BusinessException.Kind.RATE_LIMITED ? "OIDC_RATE_LIMITED" : OIDC_ACCOUNT_REJECTED.name();
        if(Set.of(OIDC_DISCOVERY_FAILED.name(),OIDC_STORE_UNAVAILABLE.name(),OIDC_TOKEN_ENDPOINT_UNAVAILABLE.name()).contains(code)) status=503;
        return failure(status,code,ex.getMessage(),request);
    }
    @ExceptionHandler({IllegalStateException.class,org.springframework.dao.DataAccessException.class})
    ResponseEntity<ApiError> internal(Exception ex,jakarta.servlet.http.HttpServletRequest request) {
        LOG.warn("OIDC internal failureType={}",ex.getClass().getSimpleName());
        return failure(500,OIDC_INTERNAL_ERROR.name(),"No se pudo completar la conexión externa.",request);
    }
    private ResponseEntity<ApiError> failure(int status,String code,String message,jakarta.servlet.http.HttpServletRequest request) {
        String id=request.getHeader("X-SIARE-OIDC-Diagnostic");
        if(id==null || !id.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")) id=UUID.randomUUID().toString();
        Object route=request.getAttribute(org.springframework.web.servlet.HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        // Only fixed codes, route templates and an independent random reference. No exception/payload logging.
        Object stage=request.getAttribute("siare.oidc.stage");
        LOG.warn("OIDC diagnostic={} route={} stage={} code={} status={}",id,route,stage,code,status);
        return ResponseEntity.status(status).header("Cache-Control","no-store").header("X-SIARE-OIDC-Diagnostic",id)
                .body(ApiError.of(status,code,message));
    }
    @PostMapping("/auth/oidc/start") Object login(@Valid @RequestBody Start body) { return start(body,null); }
    @PostMapping("/users/me/identities/start") Object link(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Start body) {
        if(!Boolean.TRUE.equals(body.confirmed())) throw new BusinessException(BusinessException.Kind.VALIDATION,"Confirma la vinculación de la identidad.");
        tx.required(() -> { identities.requireRecent(UUID.fromString(jwt.getSubject()),UUID.fromString(jwt.getClaimAsString("sid"))); return null; });
        return start(body,jwt);
    }
    private Object start(Start body,Jwt jwt) {
        attempts.acquire("oidc-start:"+SessionService.fingerprint(body.binding()));
        var registration=providers.registration(body.provider());
        var f=new Flow(body.provider(),SessionService.fingerprint(body.binding()),MfaService.opaque(random,32),MfaService.opaque(random,32),
                MfaService.opaque(random,32),registration.getRedirectUri(),jwt==null?null:UUID.fromString(jwt.getSubject()),
                jwt==null?null:UUID.fromString(jwt.getClaimAsString("sid")),clock.instant().plusSeconds(300));
        flows.put(f);
        return Map.of("authorizationUrl",OidcProtocol.request(registration,f).getAuthorizationRequestUri());
    }
    @PostMapping("/auth/oidc/complete") Object complete(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Complete body,jakarta.servlet.http.HttpServletRequest request) {
        request.setAttribute("siare.oidc.stage","context");
        attempts.acquire("oidc-complete:"+SessionService.fingerprint(body.binding()));
        var f=flows.take(body.state()); // Atomic consume even for failed callbacks; retries must start a new flow.
        if(f==null || !f.provider().equals(body.provider()) || !clock.instant().isBefore(f.expiresAt())
                || !MessageDigest.isEqual(f.bindingHash().getBytes(java.nio.charset.StandardCharsets.US_ASCII),SessionService.fingerprint(body.binding()).getBytes(java.nio.charset.StandardCharsets.US_ASCII)))
            throw new OidcFailure(BusinessException.Kind.UNAUTHORIZED,OIDC_CONTEXT_INVALID,"El inicio de sesión venció o no corresponde a este navegador. Inténtalo de nuevo.");
        request.setAttribute("siare.oidc.stage","provider_configuration");
        var r=providers.registration(f.provider());
        if(!r.getRedirectUri().equals(f.redirectUri())) throw new OidcFailure(BusinessException.Kind.UNAUTHORIZED,OIDC_REDIRECT_CHANGED,"El callback cambió. Inicia el flujo de nuevo.");
        if(f.user()!=null && (jwt==null || !f.user().toString().equals(jwt.getSubject()) || !f.session().toString().equals(jwt.getClaimAsString("sid"))))
            throw new OidcFailure(BusinessException.Kind.UNAUTHORIZED,OIDC_LINK_SESSION_CHANGED,"La sesión de vinculación cambió. Inicia el flujo de nuevo.");
        try {
            request.setAttribute("siare.oidc.stage","token_and_id_token");
            var principal=protocol.authenticate(r,f,body.code(),body.state());
            request.setAttribute("siare.oidc.stage","identity_resolution");
            if(f.user()!=null) { identities.link(f.user(),f.session(),principal); return Map.of("linked",true); }
            return identities.login(principal);
        } catch(OAuth2AuthenticationException ex) {
            var code=switch(ex.getError().getErrorCode()) {
                case "invalid_nonce" -> OIDC_NONCE_INVALID;
                case "invalid_state_parameter" -> OIDC_CONTEXT_INVALID;
                default -> OIDC_ID_TOKEN_INVALID;
            };
            throw new OidcFailure(BusinessException.Kind.UNAUTHORIZED,code,"No se pudo verificar la identidad externa. Inicia el flujo de nuevo.");
        }
    }
    @GetMapping("/users/me/identities") Object connected(@AuthenticationPrincipal Jwt jwt) {
        return identities.connected(UUID.fromString(jwt.getSubject())).stream().map(e -> Map.of("id",e.id(),"provider",e.provider(),"linkedAt",e.linkedAt())).toList();
    }
    @DeleteMapping("/users/me/identities/{id}") ResponseEntity<Void> unlink(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id) {
        identities.unlink(UUID.fromString(jwt.getSubject()),UUID.fromString(jwt.getClaimAsString("sid")),id);
        return ResponseEntity.noContent().build();
    }
}
