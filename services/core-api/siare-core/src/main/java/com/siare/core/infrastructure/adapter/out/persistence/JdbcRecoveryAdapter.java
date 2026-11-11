package com.siare.core.infrastructure.adapter.out.persistence;

import com.siare.core.application.port.out.*;
import com.siare.core.domain.identity.MfaCredential;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcRecoveryAdapter implements MfaRepository, PasswordResetRepository {
    private final JdbcTemplate db;
    public JdbcRecoveryAdapter(JdbcTemplate db) { this.db=db; }
    private Timestamp time(Instant value) { return value==null?null:Timestamp.from(value); }
    private Instant instant(ResultSet rs,String column) throws SQLException { var t=rs.getTimestamp(column); return t==null?null:t.toInstant(); }
    @Override public Optional<MfaCredential> credential(UUID user) {
        // Callers that mutate hold user_access FOR UPDATE; current read avoids stale RR snapshots.
        return db.query("SELECT * FROM mfa_credentials WHERE user_id=? FOR UPDATE",(rs,n) -> new MfaCredential(user,
                rs.getString("active_secret"),rs.getString("pending_secret"),instant(rs,"pending_expires_at"),rs.getLong("last_used_step")),user.toString()).stream().findFirst();
    }
    @Override public void save(MfaCredential c) {
        int changed=db.update("UPDATE mfa_credentials SET active_secret=?,pending_secret=?,pending_expires_at=?,last_used_step=? WHERE user_id=?",
                c.activeSecret(),c.pendingSecret(),time(c.pendingExpiresAt()),c.lastUsedStep(),c.userId().toString());
        if(changed==0) db.update("INSERT INTO mfa_credentials(user_id,active_secret,pending_secret,pending_expires_at,last_used_step) VALUES (?,?,?,?,?)",
                c.userId().toString(),c.activeSecret(),c.pendingSecret(),time(c.pendingExpiresAt()),c.lastUsedStep());
    }
    @Override public void insertChallenge(String hash,UUID user,Instant expiry) {
        db.update("INSERT INTO mfa_challenges(token_hash,user_id,expires_at) VALUES (?,?,?)",hash,user.toString(),time(expiry));
    }
    @Override public Optional<Challenge> challenge(String hash,boolean lock) {
        return db.query("SELECT * FROM mfa_challenges WHERE token_hash=?"+(lock?" FOR UPDATE":""),(rs,n) ->
                new Challenge(hash,UUID.fromString(rs.getString("user_id")),instant(rs,"expires_at"),rs.getInt("attempts"),instant(rs,"consumed_at")),hash).stream().findFirst();
    }
    @Override public void attempt(String hash) { db.update("UPDATE mfa_challenges SET attempts=attempts+1 WHERE token_hash=?",hash); }
    @Override public void consumeChallenge(String hash,Instant now) { db.update("UPDATE mfa_challenges SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL",time(now),hash); }
    @Override public void invalidateChallenges(UUID user,Instant now) { db.update("UPDATE mfa_challenges SET consumed_at=? WHERE user_id=? AND consumed_at IS NULL",time(now),user.toString()); }
    @Override public void replaceRecovery(UUID user,List<String> hashes) {
        db.update("DELETE FROM mfa_recovery_codes WHERE user_id=?",user.toString());
        for(String hash:hashes) db.update("INSERT INTO mfa_recovery_codes(code_hash,user_id) VALUES (?,?)",hash,user.toString());
    }
    @Override public boolean consumeRecovery(UUID user,String hash,Instant now) {
        return db.update("UPDATE mfa_recovery_codes SET consumed_at=? WHERE user_id=? AND code_hash=? AND consumed_at IS NULL",time(now),user.toString(),hash)==1;
    }
    @Override public int remainingRecovery(UUID user) { return db.queryForObject("SELECT COUNT(*) FROM mfa_recovery_codes WHERE user_id=? AND consumed_at IS NULL",Integer.class,user.toString()); }
    @Override public void insert(String hash,UUID user,Instant expiry) { db.update("INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES (?,?,?)",hash,user.toString(),time(expiry)); }
    @Override public Optional<ResetToken> find(String hash,boolean lock) {
        return db.query("SELECT * FROM password_reset_tokens WHERE token_hash=?"+(lock?" FOR UPDATE":""),(rs,n) ->
                new ResetToken(hash,UUID.fromString(rs.getString("user_id")),instant(rs,"expires_at"),instant(rs,"consumed_at")),hash).stream().findFirst();
    }
    @Override public boolean consume(String hash,Instant now) { return db.update("UPDATE password_reset_tokens SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL",time(now),hash)==1; }
    @Override public void invalidate(UUID user,Instant now) { db.update("UPDATE password_reset_tokens SET consumed_at=? WHERE user_id=? AND consumed_at IS NULL",time(now),user.toString()); }
}
