package com.siare.core.domain.activity;
import java.time.Instant;
import java.util.UUID;
public record SavedActivity(UUID activityId,UUID subjectId,UUID documentId,String topic,Instant createdAt,String status,Activity content) { }
