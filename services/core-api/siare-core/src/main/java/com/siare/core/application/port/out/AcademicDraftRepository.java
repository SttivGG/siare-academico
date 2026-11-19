package com.siare.core.application.port.out;

import com.siare.core.domain.draft.StoredAcademicDraft;
import java.time.Instant;
import java.util.*;

public interface AcademicDraftRepository {
    void insert(StoredAcademicDraft draft);
    Optional<StoredAcademicDraft> find(UUID id, boolean lock);
    /** Current locking read: prevents subject archival/ownership changes until commit. */
    boolean lockActiveSubject(UUID owner, UUID subject);
    boolean updateRevision(StoredAcademicDraft edited, int expectedRevision);
    boolean markPublished(UUID id, int revision, UUID key, String fingerprint, UUID activity, Instant now);
}
