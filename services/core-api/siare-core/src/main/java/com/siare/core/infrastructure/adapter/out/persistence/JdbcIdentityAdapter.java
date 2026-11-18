package com.siare.core.infrastructure.adapter.out.persistence;

import com.siare.core.application.port.out.*;
import com.siare.core.domain.account.BusinessException;
import com.siare.core.domain.identity.*;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import java.util.function.Supplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Repository
public class JdbcIdentityAdapter implements IdentityRepository, SessionRepository, AuditPort, TransactionPort, IdentityParameterPort {
    private final JdbcTemplate db;
    private final TransactionTemplate transactions;
    public JdbcIdentityAdapter(JdbcTemplate db, PlatformTransactionManager manager) {
        this.db = db; transactions = new TransactionTemplate(manager);
    }
    @Override public <T> T required(Supplier<T> work) { return transactions.execute(status -> work.get()); }
    @Override public IdentityParameter registration() {
        return db.queryForObject("SELECT * FROM identity_parameters WHERE name='public_registration_enabled'",(rs,n) ->
                new IdentityParameter(rs.getString("name"),rs.getBoolean("enabled"),rs.getLong("version")));
    }
    @Override public void setRegistration(boolean enabled,long version) {
        if(db.update("UPDATE identity_parameters SET enabled=?,version=version+1 WHERE name='public_registration_enabled' AND version=?",enabled,version)!=1)
            throw new BusinessException(BusinessException.Kind.CONFLICT,"El parámetro cambió. Recarga la página.");
    }
    private String id(UUID id) { return id == null ? null : id.toString(); }
    private Timestamp time(Instant time) { return time == null ? null : Timestamp.from(time); }
    private Instant instant(ResultSet rs, String column) throws SQLException {
        var value = rs.getTimestamp(column); return value == null ? null : value.toInstant();
    }
    private UserAccess accessRow(ResultSet rs, int n) throws SQLException {
        return new UserAccess(UUID.fromString(rs.getString("user_id")), Role.valueOf(rs.getString("role_name")),
                UUID.fromString(rs.getString("scope_id")), rs.getBoolean("enabled"), rs.getLong("version"));
    }
    private UserSession sessionRow(ResultSet rs, int n) throws SQLException {
        return new UserSession(UUID.fromString(rs.getString("id")), UUID.fromString(rs.getString("user_id")),
                instant(rs,"created_at"), instant(rs,"last_seen_at"), instant(rs,"idle_expires_at"),
                instant(rs,"absolute_expires_at"), instant(rs,"revoked_at"), rs.getLong("version"),rs.getString("authentication_level"),instant(rs,"mfa_verified_at"),instant(rs,"mfa_expires_at"));
    }
    private UserAccess getAccess(UUID userId, boolean lock) {
        return db.query("SELECT * FROM user_access WHERE user_id=?" + (lock ? " FOR UPDATE" : ""), this::accessRow, id(userId))
                .stream().findFirst().orElseThrow(() -> new BusinessException(BusinessException.Kind.UNAUTHORIZED, "La cuenta no está disponible."));
    }
    @Override public UserAccess access(UUID userId) { return getAccess(userId, false); }
    @Override public UserAccess lockAccess(UUID userId) { return getAccess(userId, true); }
    @Override public void update(UserAccess access) {
        int changed = db.update("UPDATE user_access SET role_name=?, scope_id=?, enabled=?, version=version+1 WHERE user_id=? AND version=?",
                access.role().name(), id(access.scopeId()), access.enabled(), id(access.userId()), access.version());
        if (changed != 1) throw new BusinessException(BusinessException.Kind.CONFLICT, "La asignación cambió. Recarga la página.");
    }
    @Override public List<UserAccess> users(UUID scopeId, int limit, int offset) {
        return scopeId == null ? db.query("SELECT * FROM user_access ORDER BY user_id LIMIT ? OFFSET ?", this::accessRow, limit, offset)
                : db.query("SELECT * FROM user_access WHERE scope_id=? ORDER BY user_id LIMIT ? OFFSET ?", this::accessRow, id(scopeId), limit, offset);
    }
    @Override public List<AdministrativeScope> scopes() {
        return db.query("SELECT * FROM administrative_scopes ORDER BY name", (rs,n) ->
                new AdministrativeScope(UUID.fromString(rs.getString("id")), rs.getString("name"), rs.getLong("version")));
    }
    @Override public AdministrativeScope createScope(String name) {
        var scope = new AdministrativeScope(UUID.randomUUID(), name, 0);
        try { db.update("INSERT INTO administrative_scopes(id,name) VALUES (?,?)", id(scope.id()), name); }
        catch (org.springframework.dao.DuplicateKeyException ex) { throw new BusinessException(BusinessException.Kind.CONFLICT, "Ya existe un ámbito con ese nombre."); }
        return scope;
    }
    @Override public void lockBootstrap() { db.queryForObject("SELECT id FROM identity_control WHERE id=1 FOR UPDATE", Integer.class); }
    @Override public boolean bootstrapped() { return Boolean.TRUE.equals(db.queryForObject("SELECT bootstrapped FROM identity_control WHERE id=1", Boolean.class)); }
    @Override public void finishBootstrap() { db.update("UPDATE identity_control SET bootstrapped=TRUE WHERE id=1"); }
    @Override public void insert(UserSession s) {
        db.update("INSERT INTO user_sessions(id,user_id,created_at,last_seen_at,idle_expires_at,absolute_expires_at,version,authentication_level,mfa_verified_at,mfa_expires_at) VALUES (?,?,?,?,?,?,0,?,?,?)",
                id(s.id()), id(s.userId()), time(s.createdAt()), time(s.lastSeenAt()), time(s.idleExpiresAt()), time(s.absoluteExpiresAt()),s.authenticationLevel(),time(s.mfaVerifiedAt()),time(s.mfaExpiresAt()));
    }
    @Override public Optional<UserSession> find(UUID sessionId) {
        return db.query("SELECT * FROM user_sessions WHERE id=?", this::sessionRow, id(sessionId)).stream().findFirst();
    }
    @Override public UserSession lockSession(UUID sessionId) {
        return db.query("SELECT * FROM user_sessions WHERE id=? FOR UPDATE", this::sessionRow, id(sessionId)).stream().findFirst()
                .orElseThrow(() -> new BusinessException(BusinessException.Kind.UNAUTHORIZED, "La sesión ha expirado."));
    }
    @Override public List<UserSession> list(UUID userId) {
        return db.query("SELECT * FROM user_sessions WHERE user_id=? ORDER BY created_at,id", this::sessionRow, id(userId));
    }
    @Override public void touch(UUID sessionId, Instant now, Instant expiry) {
        db.update("UPDATE user_sessions SET last_seen_at=?,idle_expires_at=?,version=version+1 WHERE id=? AND revoked_at IS NULL", time(now), time(expiry), id(sessionId));
    }
    @Override public void revoke(UUID sessionId, Instant now) {
        db.update("UPDATE user_sessions SET revoked_at=?,version=version+1 WHERE id=? AND revoked_at IS NULL", time(now), id(sessionId));
    }
    @Override public Optional<RefreshRecord> refresh(String hash) {
        // A locking read is essential under MySQL REPEATABLE READ: re-read the latest consumed_at.
        return db.query("SELECT * FROM refresh_tokens WHERE token_hash=? FOR UPDATE", (rs,n) ->
                new RefreshRecord(rs.getString("token_hash"), UUID.fromString(rs.getString("session_id")), instant(rs,"consumed_at")), hash).stream().findFirst();
    }
    @Override public Optional<RefreshRecord> lookupRefresh(String hash) {
        return db.query("SELECT * FROM refresh_tokens WHERE token_hash=?",(rs,n) ->
                new RefreshRecord(rs.getString("token_hash"),UUID.fromString(rs.getString("session_id")),instant(rs,"consumed_at")),hash).stream().findFirst();
    }
    @Override public void insertRefresh(String hash, UUID sessionId, Instant now) {
        db.update("INSERT INTO refresh_tokens(token_hash,session_id,created_at) VALUES (?,?,?)", hash, id(sessionId), time(now));
    }
    @Override public void consume(String hash, Instant now) {
        if (db.update("UPDATE refresh_tokens SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL", time(now), hash) != 1)
            throw new BusinessException(BusinessException.Kind.CONFLICT, "La renovación ya fue utilizada.");
    }
    @Override public void append(AuditEvent e) {
        db.update("INSERT INTO audit_events(id,actor_id,operation,resource,occurred_at,outcome,scope_id) VALUES (?,?,?,?,?,?,?)",
                id(e.id()), id(e.actorId()), e.operation(), e.resource(), time(e.occurredAt()), e.outcome(), id(e.scopeId()));
    }
    @Override public List<AuditEvent> list(int limit, int offset) {
        return db.query("SELECT * FROM audit_events ORDER BY occurred_at DESC,id DESC LIMIT ? OFFSET ?", (rs,n) ->
                new AuditEvent(UUID.fromString(rs.getString("id")), rs.getString("actor_id") == null ? null : UUID.fromString(rs.getString("actor_id")),
                        rs.getString("operation"), rs.getString("resource"), instant(rs,"occurred_at"), rs.getString("outcome"),
                        rs.getString("scope_id") == null ? null : UUID.fromString(rs.getString("scope_id"))), limit, offset);
    }
}
