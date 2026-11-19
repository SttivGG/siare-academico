package com.siare.core.infrastructure.adapter.in.web;

import com.siare.core.application.port.in.AcademicDraftUseCase;
import com.siare.core.application.service.ActivityViews;
import com.siare.core.domain.draft.AcademicDraft.Bank;
import com.siare.core.domain.draft.DraftLifecycleException;
import com.siare.core.infrastructure.adapter.out.generation.DraftJsonContract;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/activity-drafts")
public class AcademicDraftController {
    private final AcademicDraftUseCase drafts;
    private final DraftJsonContract contract = new DraftJsonContract();
    public AcademicDraftController(AcademicDraftUseCase drafts) { this.drafts = drafts; }
    public record Revision(@NotNull @Min(1) @Max(2147483646) Integer draftRevision, @NotNull Bank draft) {
        @Override public String toString() { return "DraftRevision[REDACTED]"; }
    }
    public record Publish(@NotNull @Min(1) @Max(2147483646) Integer draftRevision, Boolean reviewConfirmed,
                          @NotNull @Pattern(regexp="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}") String idempotencyKey) {
        @Override public String toString() { return "DraftPublish[REDACTED]"; }
    }
    @GetMapping("/{draftId}")
    ResponseEntity<AcademicDraftUseCase.View> get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID draftId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(drafts.get(owner(jwt), draftId));
    }
    @PutMapping(value="/{draftId}", consumes=MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<AcademicDraftUseCase.View> revise(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID draftId,
            HttpServletRequest http) throws java.io.IOException {
        var request = contract.publicRequest(body(http), "ReviseDraftRequest", Revision.class);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(drafts.revise(owner(jwt), draftId, request.draftRevision(), request.draft()));
    }
    @PostMapping(value="/{draftId}/publish", consumes=MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<ActivityViews.ActivityView> publish(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID draftId,
            HttpServletRequest http) throws java.io.IOException {
        var request = contract.publicRequest(body(http), "PublishDraftRequest", Publish.class);
        if (!Boolean.TRUE.equals(request.reviewConfirmed())) throw new DraftLifecycleException(400, "REVIEW_REQUIRED");
        var result = drafts.publish(owner(jwt), draftId, request.draftRevision(), request.reviewConfirmed(), UUID.fromString(request.idempotencyKey()));
        return ResponseEntity.status(result.replayed() ? 200 : 201).location(URI.create("/api/v1/activities/" + result.activity().activityId()))
                .cacheControl(CacheControl.noStore()).body(ActivityViews.view(result.activity()));
    }
    private UUID owner(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
    private byte[] body(HttpServletRequest request) throws java.io.IOException {
        return request.getInputStream().readNBytes(DraftJsonContract.RESPONSE_BYTES + 1);
    }
}
