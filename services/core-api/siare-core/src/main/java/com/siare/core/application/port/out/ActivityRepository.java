package com.siare.core.application.port.out;
import com.siare.core.domain.activity.*;
import java.util.*;
public interface ActivityRepository {
    void insert(SavedActivity activity);
    Optional<SavedActivity> find(UUID id,boolean lock);
    List<SavedActivity> list(UUID subjectId,UUID after,int limit);
    Optional<StoredAttempt> findAttempt(UUID activityId,UUID studentId,UUID idempotencyKey);
    Optional<AttemptResult> result(UUID activityId,UUID attemptId);
    /** Called in the same transaction as the activity lock; attempt and event are atomic. */
    void saveAttempt(UUID idempotencyKey,String fingerprint,AttemptResult result);
    record StoredAttempt(String fingerprint,AttemptResult result) { }
}
