package com.siare.core.domain.activity;
import java.time.Instant;
import java.util.*;
public record AttemptResult(UUID attemptId,UUID eventId,UUID studentId,UUID subjectId,UUID activityId,
        ActivityFamily activityType,double score,double percentage,int points,int total,long durationMs,
        Instant occurredAt,String feedback,List<QuestionFeedback> items) {
    public AttemptResult { items=List.copyOf(items); }
    public record QuestionFeedback(String id,boolean correct,String submitted,String expected,String rationale,String feedback) { }
    public AttemptEvent event() { return new AttemptEvent(1,eventId,attemptId,studentId,subjectId,activityId,activityType,
            "ATTEMPT_EVALUATED",score,durationMs,occurredAt,"core-api"); }
}
