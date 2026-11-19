package com.siare.core.application.port.in;

import com.siare.core.domain.draft.AcademicDraft.*;
import com.siare.core.domain.activity.*;
import java.time.Instant;
import java.util.*;

public interface AcademicDraftUseCase {
    record View(UUID draftId, UUID subjectId, UUID documentId, String extractionVersion, ActivityFamily type,
                String topic, int count, int gridSize, int draftRevision, Instant expiresAt, String status,
                Bank draft, Quality quality, int qualityAppliesToRevision, List<String> warnings, String generatorVersion) {
        @Override public String toString() { return "PrivateDraftView[draftId=" + draftId + "]"; }
    }
    record Publication(SavedActivity activity, boolean replayed) {
        @Override public String toString() { return "DraftPublication[REDACTED]"; }
    }
    /** Internal application entry point; production generator remains disabled. No synthetic HTTP input. */
    View create(UUID owner, UUID subject, Selection selection);
    View get(UUID owner, UUID id);
    View revise(UUID owner, UUID id, int expectedRevision, Bank bank);
    Publication publish(UUID owner, UUID id, int expectedRevision, Boolean reviewConfirmed, UUID key);
}
