package com.siare.core.infrastructure.adapter.in.web;

import com.fasterxml.jackson.annotation.JsonSetter;
import com.siare.core.application.port.in.SubjectUseCase;
import com.siare.core.domain.account.BusinessException;
import com.siare.core.domain.subject.Subject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.time.Instant;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/subjects")
public class SubjectController {
    private final SubjectUseCase subjects;
    public SubjectController(SubjectUseCase subjects) { this.subjects = subjects; }

    public record CreateRequest(@NotBlank @Size(max = 120) String name, @Size(max = 2000) String description) {}
    public static final class PatchRequest {
        @Size(max = 120) private String name;
        @Size(max = 2000) private String description;
        private boolean namePresent;
        private boolean descriptionPresent;
        public String getName() { return name; }
        public String getDescription() { return description; }
        @JsonSetter public void setName(String name) { this.name = name; this.namePresent = true; }
        @JsonSetter public void setDescription(String description) { this.description = description; this.descriptionPresent = true; }
    }
    public record SubjectResponse(UUID id, String name, String description, boolean archived,
                                  Instant createdAt, Instant updatedAt) {
        static SubjectResponse from(Subject s) {
            return new SubjectResponse(s.id(), s.name(), s.description(), s.archived(), s.createdAt(), s.updatedAt());
        }
    }

    private UUID owner(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }

    @PostMapping
    ResponseEntity<SubjectResponse> create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateRequest request) {
        var subject = subjects.create(owner(jwt), request.name(), request.description());
        return ResponseEntity.created(URI.create("/api/v1/subjects/" + subject.id())).body(SubjectResponse.from(subject));
    }
    @GetMapping
    List<SubjectResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return subjects.list(owner(jwt)).stream().map(SubjectResponse::from).toList();
    }
    @GetMapping("/{id}")
    SubjectResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) { return SubjectResponse.from(subjects.get(owner(jwt), id)); }

    @PatchMapping("/{id}")
    SubjectResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody PatchRequest request) {
        if ((!request.namePresent && !request.descriptionPresent) || (request.namePresent && request.name == null)) {
            throw new BusinessException(BusinessException.Kind.VALIDATION, "Indica un nombre válido o una descripción para actualizar.");
        }
        return SubjectResponse.from(subjects.update(owner(jwt), id, request.name, request.description, request.descriptionPresent));
    }
    @PatchMapping("/{id}/archive")
    SubjectResponse archive(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return SubjectResponse.from(subjects.archive(owner(jwt), id));
    }
}
