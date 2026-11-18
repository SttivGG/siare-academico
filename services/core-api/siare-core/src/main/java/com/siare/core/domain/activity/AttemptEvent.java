package com.siare.core.domain.activity;
import java.time.Instant;
import java.util.UUID;
public record AttemptEvent(int schemaVersion,UUID eventId,UUID attemptId,UUID studentId,UUID subjectId,UUID activityId,
        ActivityFamily activityType,String eventType,double score,long durationMs,Instant occurredAt,String source) { }
