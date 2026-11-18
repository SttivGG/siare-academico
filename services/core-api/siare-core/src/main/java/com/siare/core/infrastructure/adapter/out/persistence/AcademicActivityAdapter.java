package com.siare.core.infrastructure.adapter.out.persistence;

import com.siare.core.application.port.out.*;
import com.siare.core.domain.activity.*;
import com.siare.core.application.service.ActivityViews;
import java.sql.Timestamp;
import java.util.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;

@Repository
public class AcademicActivityAdapter implements ActivityRepository {
    private final JpaAcademicActivities jpa;
    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final ActivityFactoryProvider factories;
    public AcademicActivityAdapter(JpaAcademicActivities jpa,JdbcTemplate db,ObjectMapper json,ActivityFactoryProvider factories) { this.jpa=jpa; this.db=db; this.json=json; this.factories=factories; }
    @Override public void insert(SavedActivity saved) {
        var entity=new AcademicActivityEntity(); entity.id=saved.activityId().toString(); entity.subjectId=saved.subjectId().toString();
        entity.documentId=saved.documentId()==null?null:saved.documentId().toString(); entity.family=saved.content().family().name();
        entity.topic=saved.topic(); entity.status=saved.status(); entity.createdAt=saved.createdAt();
        entity.publicContent=json.writeValueAsString(ActivityViews.content(saved.content()));
        // Restricted server snapshot holds the immutable evaluation key and evidence. Never expose this entity.
        entity.protectedSnapshot=json.writeValueAsString(saved.content()); jpa.saveAndFlush(entity);
    }
    @Override public Optional<SavedActivity> find(UUID id,boolean lock) { return (lock?jpa.lockById(id.toString()):jpa.findById(id.toString())).map(this::domain); }
    private SavedActivity domain(AcademicActivityEntity entity) {
        var type=factories.forFamily(ActivityFamily.valueOf(entity.family)).activityClass();
        Activity content=json.readValue(entity.protectedSnapshot,type);
        return new SavedActivity(UUID.fromString(entity.id),UUID.fromString(entity.subjectId),entity.documentId==null?null:UUID.fromString(entity.documentId),entity.topic,entity.createdAt,entity.status,content);
    }
    @Override public List<SavedActivity> list(UUID subject,UUID after,int limit) { return jpa.page(subject.toString(),after==null?null:after.toString(),PageRequest.of(0,limit)).stream().map(this::domain).toList(); }
    @Override public Optional<StoredAttempt> findAttempt(UUID activity,UUID student,UUID key) {
        return db.query("SELECT request_fingerprint,result_json FROM academic_attempts WHERE activity_id=? AND student_id=? AND idempotency_key=?",
                (rs,n)->new StoredAttempt(rs.getString(1),json.readValue(rs.getString(2),AttemptResult.class)),activity.toString(),student.toString(),key.toString()).stream().findFirst();
    }
    @Override public Optional<AttemptResult> result(UUID activity,UUID attempt) {
        return db.query("SELECT result_json FROM academic_attempts WHERE activity_id=? AND id=?",(rs,n)->json.readValue(rs.getString(1),AttemptResult.class),activity.toString(),attempt.toString()).stream().findFirst();
    }
    @Override public void saveAttempt(UUID key,String fingerprint,AttemptResult result) {
        db.update("INSERT INTO academic_attempts(id,activity_id,student_id,event_id,idempotency_key,request_fingerprint,score,duration_ms,occurred_at,result_json) VALUES (?,?,?,?,?,?,?,?,?,?)",
                result.attemptId().toString(),result.activityId().toString(),result.studentId().toString(),result.eventId().toString(),key.toString(),fingerprint,result.score(),result.durationMs(),Timestamp.from(result.occurredAt()),json.writeValueAsString(result));
        db.update("INSERT INTO academic_attempt_outbox(event_id,attempt_id,payload_json,available_at) VALUES (?,?,?,?)",
                result.eventId().toString(),result.attemptId().toString(),json.writeValueAsString(result.event()),Timestamp.from(result.occurredAt()));
    }
}
