package com.siare.core.infrastructure.adapter.out.persistence;

import com.siare.core.application.port.out.AcademicDraftRepository;
import com.siare.core.domain.activity.ActivityFamily;
import com.siare.core.domain.draft.*;
import com.siare.core.domain.draft.AcademicDraft.*;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;

/** Restricted server snapshots follow H3 storage rules; never serialize this adapter or SQL rows. */
@Repository
public class JdbcAcademicDraftRepository implements AcademicDraftRepository {
    private final JdbcTemplate db;
    private final ObjectMapper json;
    public JdbcAcademicDraftRepository(JdbcTemplate db, ObjectMapper json) { this.db = db; this.json = json; }
    @Override public void insert(StoredAcademicDraft d) {
        var s = d.selection();
        db.update("INSERT INTO academic_drafts(id,owner_id,subject_id,document_id,family,topic,item_count,grid_size,extraction_version,extraction_fingerprint,fragment_indexes_json,private_response_json,generator_version,validation_json,revision,status,created_at,updated_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'AWAITING_REVIEW',?,?,?)",
                d.id().toString(), d.owner().toString(), d.subject().toString(), s.documentId().toString(), s.type().name(), s.topic(),
                s.count(), s.gridSize(), s.extractionVersion(), d.extractionFingerprint(), json.writeValueAsString(s.fragmentIndexes()),
                json.writeValueAsString(d.response()), d.response().generatorVersion(), validations(d.revision()), d.revision(),
                Timestamp.from(d.createdAt()), Timestamp.from(d.updatedAt()), Timestamp.from(d.expiresAt()));
    }
    @Override public Optional<StoredAcademicDraft> find(UUID id, boolean lock) {
        return db.query("SELECT * FROM academic_drafts WHERE id=?" + (lock ? " FOR UPDATE" : ""), this::read, id.toString()).stream().findFirst();
    }
    @Override public boolean lockActiveSubject(UUID owner, UUID subject) {
        var rows = db.query("SELECT archived FROM subjects WHERE id=? AND user_id=? FOR UPDATE",
                (rs, n) -> !rs.getBoolean(1), subject.toString(), owner.toString());
        return !rows.isEmpty() && rows.getFirst();
    }
    @Override public boolean updateRevision(StoredAcademicDraft d, int expected) {
        return db.update("UPDATE academic_drafts SET private_response_json=?,validation_json=?,revision=?,updated_at=? WHERE id=? AND revision=? AND status='AWAITING_REVIEW'",
                json.writeValueAsString(d.response()), validations(d.revision()), d.revision(), Timestamp.from(d.updatedAt()), d.id().toString(), expected) == 1;
    }
    @Override public boolean markPublished(UUID id, int revision, UUID key, String fingerprint, UUID activity, Instant now) {
        return db.update("UPDATE academic_drafts SET status='PUBLISHED',review_confirmed=TRUE,published_activity_id=?,publication_key=?,publication_fingerprint=?,updated_at=? WHERE id=? AND revision=? AND status='AWAITING_REVIEW'",
                activity.toString(), key.toString(), fingerprint, Timestamp.from(now), id.toString(), revision) == 1;
    }
    private String validations(int revision) {
        return json.writeValueAsString(Map.of("revision", revision, "structure", true, "literalEvidence", true, "answerInQuote", true));
    }
    private StoredAcademicDraft read(ResultSet r, int row) throws SQLException {
        var indexes = Arrays.asList(json.readValue(r.getString("fragment_indexes_json"), Integer[].class));
        var selection = new Selection(uuid(r, "document_id"), r.getString("extraction_version"), ActivityFamily.valueOf(r.getString("family")),
                r.getString("topic"), r.getInt("item_count"), r.getInt("grid_size"), indexes);
        return new StoredAcademicDraft(uuid(r, "id"), uuid(r, "owner_id"), uuid(r, "subject_id"), selection,
                r.getString("extraction_fingerprint"), json.readValue(r.getString("private_response_json"), Response.class), r.getInt("revision"),
                r.getTimestamp("created_at").toInstant(), r.getTimestamp("updated_at").toInstant(), r.getTimestamp("expires_at").toInstant(),
                uuid(r, "published_activity_id"), uuid(r, "publication_key"), r.getString("publication_fingerprint"));
    }
    private UUID uuid(ResultSet r, String column) throws SQLException { String value = r.getString(column); return value == null ? null : UUID.fromString(value); }
}
