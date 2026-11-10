package com.siare.core.infrastructure.adapter.in.web;

import com.siare.core.application.port.in.AccountUseCase;
import com.siare.core.application.port.out.TokenPort.AccessToken;
import com.siare.core.domain.account.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class AccountController {
    private final AccountUseCase accounts;
    public AccountController(AccountUseCase accounts) { this.accounts = accounts; }

    public record RegisterRequest(@NotBlank @Size(max = 100) String name,
                                  @NotBlank @Size(max = 254) String email,
                                  @NotBlank @Size(min = 10, max = 72) String password) {
        @Override public String toString() { return "RegisterRequest[REDACTED]"; }
    }
    public record LoginRequest(@NotBlank @Size(max = 254) String email,
                               @NotBlank @Size(max = 72) String password) {
        @Override public String toString() { return "LoginRequest[REDACTED]"; }
    }
    public record UserResponse(UUID id, String name, String email, Instant createdAt) {
        static UserResponse from(User user) { return new UserResponse(user.id(), user.name(), user.email(), user.createdAt()); }
    }

    @PostMapping("/auth/register")
    ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        var user = accounts.register(request.name(), request.email(), request.password());
        return ResponseEntity.created(URI.create("/api/v1/users/me")).body(UserResponse.from(user));
    }

    @PostMapping("/auth/login")
    ResponseEntity<AccessToken> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok().header("Cache-Control", "no-store")
                .body(accounts.login(request.email(), request.password()));
    }

    @GetMapping("/users/me")
    ResponseEntity<UserResponse> me(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok().header("Cache-Control", "no-store")
                .body(UserResponse.from(accounts.me(UUID.fromString(jwt.getSubject()))));
    }
}
