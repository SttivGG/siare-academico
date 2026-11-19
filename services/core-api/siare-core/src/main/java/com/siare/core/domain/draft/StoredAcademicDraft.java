package com.siare.core.domain.draft;

import com.siare.core.domain.draft.AcademicDraft.*;
import java.time.Instant;
import java.util.*;

/** Private persistence aggregate. Does not retain extraction text or credentials. */
public record StoredAcademicDraft(UUID id, UUID owner, UUID subject, Selection selection,
        String extractionFingerprint, Response response, int revision, Instant createdAt,
        Instant updatedAt, Instant expiresAt, UUID activityId, UUID publicationKey,
        String publicationFingerprint) {
    @Override public String toString() { return "StoredAcademicDraft[id=" + id + ",revision=" + revision + "]"; }
    public StoredAcademicDraft edited(Bank bank, Instant now) {
        var r = response;
        return new StoredAcademicDraft(id, owner, subject, selection, extractionFingerprint,
                new Response(r.schemaVersion(), r.requestId(), r.documentId(), r.extractionVersion(), r.type(),
                        r.topic(), r.count(), r.status(), r.generatorVersion(), bank, r.warnings(), r.quality()),
                revision + 1, createdAt, now, expiresAt, null, null, null);
    }
}
