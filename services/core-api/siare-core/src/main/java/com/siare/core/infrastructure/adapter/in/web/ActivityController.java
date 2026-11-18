package com.siare.core.infrastructure.adapter.in.web;

import com.siare.core.application.port.in.ActivityUseCase;
import com.siare.core.domain.activity.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import com.siare.core.application.service.ActivityViews;
import static com.siare.core.application.service.ActivityViews.*;

@RestController
@RequestMapping("/api/v1")
public class ActivityController {
    private final ActivityUseCase activities;
    public ActivityController(ActivityUseCase activities) { this.activities=activities; }
    public record CreateRequest(@NotNull ActivityFamily type,UUID documentId,@NotBlank @Size(max=100) String topic,
                                ActivityBank bank,@Min(1) @Max(50) int count,@Min(5) @Max(25) int gridSize) {
        @Override public String toString() { return "ActivityCreate[REDACTED]"; }
    }
    public record SubmitRequest(@NotNull UUID idempotencyKey,@NotNull @Size(max=50) Map<@NotBlank @Size(max=64) String,@NotNull @Size(max=200) String> answers,
                                @NotNull @Min(0) @Max(86400000) Long durationMs) {
        @Override public String toString() { return "ActivitySubmission[REDACTED]"; }
    }
    @PostMapping("/subjects/{subjectId}/activities")
    ResponseEntity<ActivityView> create(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID subjectId,@Valid @RequestBody CreateRequest request) {
        var saved=activities.create(owner(jwt),subjectId,request.type(),request.documentId(),request.topic(),request.bank(),request.count(),request.gridSize());
        return ResponseEntity.created(URI.create("/api/v1/activities/"+saved.activityId())).cacheControl(CacheControl.noStore()).body(view(saved));
    }
    @GetMapping("/subjects/{subjectId}/activities")
    ResponseEntity<Page> list(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID subjectId,
            @RequestParam(defaultValue="20") int limit,@RequestParam(required=false) UUID cursor) {
        if(limit<1 || limit>100) throw ActivityException.validation("limit debe estar entre 1 y 100.");
        var rows=activities.list(owner(jwt),subjectId,cursor,limit==100?100:limit+1);
        // At the maximum page size, use a one-row lookahead through the same authorized use case.
        boolean more=rows.size()>limit;
        if(limit==100 && rows.size()==100) more=!activities.list(owner(jwt),subjectId,rows.getLast().activityId(),1).isEmpty();
        var page=rows.stream().limit(limit).toList();
        return privateResponse(new Page(page.stream().map(ActivityViews::summary).toList(),more?page.getLast().activityId().toString():null));
    }
    @GetMapping("/activities/{activityId}")
    ResponseEntity<ActivityView> get(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID activityId) { return privateResponse(view(activities.get(owner(jwt),activityId))); }
    @PostMapping("/activities/{activityId}/submissions")
    ResponseEntity<AttemptResult> submit(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID activityId,@Valid @RequestBody SubmitRequest request) {
        return privateResponse(activities.submit(owner(jwt),activityId,request.idempotencyKey(),request.answers(),request.durationMs()));
    }
    @GetMapping("/activities/{activityId}/submissions/{attemptId}")
    ResponseEntity<AttemptResult> result(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID activityId,@PathVariable UUID attemptId) {
        return privateResponse(activities.result(owner(jwt),activityId,attemptId));
    }
    private UUID owner(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
    private <T> ResponseEntity<T> privateResponse(T body) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body); }
}
