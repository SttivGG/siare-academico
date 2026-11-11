package com.siare.core.infrastructure.adapter.in.web;

import com.siare.core.application.port.in.*;
import com.siare.core.application.port.out.TokenPort.AccessToken;
import com.siare.core.application.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class RecoveryController {
    private final MfaService mfa;
    private final PasswordResetService resets;
    public RecoveryController(MfaService mfa,PasswordResetService resets) { this.mfa=mfa; this.resets=resets; }
    public record Reauthentication(@NotBlank @Size(max=2048) String password,@Size(max=32) String code) {
        @Override public String toString() { return "Reauthentication[REDACTED]"; }
    }
    public record Code(@NotBlank @Size(max=32) String code) {
        @Override public String toString() { return "Code[REDACTED]"; }
    }
    public record ChallengeRequest(@NotBlank @Size(max=100) String challengeToken,@Size(max=32) String code) {
        @Override public String toString() { return "ChallengeRequest[REDACTED]"; }
    }
    public record ResetRequest(@NotBlank @Email @Size(max=254) String email) {
        @Override public String toString() { return "ResetRequest[REDACTED]"; }
    }
    public record CompleteReset(@NotBlank @Size(max=100) String token,@NotBlank @Size(max=2048) String password) {
        @Override public String toString() { return "CompleteReset[REDACTED]"; }
    }
    public record RecoveryCodes(List<String> recoveryCodes) {
        @Override public String toString() { return "RecoveryCodes[REDACTED]"; }
    }
    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
    private Map<String,String> success() { return Map.of("message","Operación completada. Inicia sesión de nuevo si se cerraron tus sesiones."); }
    @GetMapping("/users/me/mfa")
    MfaService.Status status(@AuthenticationPrincipal Jwt jwt) { return mfa.status(actor(jwt)); }
    @PostMapping("/users/me/mfa/enroll")
    EnrollMfaUseCase.Enrollment enroll(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Reauthentication r) { return mfa.enroll(actor(jwt),r.password(),r.code()); }
    @PostMapping("/users/me/mfa/confirm")
    ConfirmMfaUseCase.Confirmation confirm(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Code r) { return mfa.confirm(actor(jwt),r.code()); }
    @PostMapping("/users/me/mfa/disable")
    Map<String,String> disable(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Reauthentication r) { mfa.disable(actor(jwt),r.password(),r.code()); return success(); }
    @PostMapping("/users/me/mfa/recovery-codes")
    RecoveryCodes codes(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Reauthentication r) { return new RecoveryCodes(mfa.regenerate(actor(jwt),r.password(),r.code())); }
    @PostMapping("/auth/mfa/enroll")
    EnrollMfaUseCase.Enrollment enrollChallenge(@Valid @RequestBody ChallengeRequest r) { return mfa.enrollChallenge(r.challengeToken()); }
    @PostMapping("/auth/mfa/confirm")
    ConfirmMfaUseCase.Confirmation confirmChallenge(@Valid @RequestBody ChallengeRequest r) { return mfa.confirmChallenge(r.challengeToken(),r.code()); }
    @PostMapping("/auth/mfa/verify")
    AccessToken verify(@Valid @RequestBody ChallengeRequest r) { return mfa.verify(r.challengeToken(),r.code()); }
    @PostMapping("/auth/mfa/recover")
    AccessToken recover(@Valid @RequestBody ChallengeRequest r) { return mfa.recover(r.challengeToken(),r.code()); }
    @PostMapping("/auth/password-reset/request") @ResponseStatus(HttpStatus.ACCEPTED)
    Map<String,String> request(@Valid @RequestBody ResetRequest r) {
        resets.request(r.email()); return Map.of("message","Si la cuenta está disponible, recibirás instrucciones en su correo registrado.");
    }
    @PostMapping("/auth/password-reset/complete")
    Map<String,String> complete(@Valid @RequestBody CompleteReset r) { resets.complete(r.token(),r.password()); return success(); }
}
