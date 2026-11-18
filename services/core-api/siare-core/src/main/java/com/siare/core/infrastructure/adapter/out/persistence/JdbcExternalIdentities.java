package com.siare.core.infrastructure.adapter.out.persistence;

import com.siare.core.application.port.out.ExternalIdentityRepository;
import com.siare.core.domain.identity.ExternalIdentity;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcExternalIdentities implements ExternalIdentityRepository {
    private final JdbcTemplate db;
    private final RowMapper<ExternalIdentity> row = (rs,n) -> new ExternalIdentity(UUID.fromString(rs.getString("id")),
            UUID.fromString(rs.getString("user_id")),rs.getString("provider"),rs.getString("issuer"),rs.getString("subject"),rs.getTimestamp("linked_at").toInstant());
    public JdbcExternalIdentities(JdbcTemplate db) { this.db=db; }
    @Override public void lockFederation() { db.queryForObject("SELECT id FROM federation_control WHERE id=1 FOR UPDATE",Integer.class); }
    @Override public Optional<ExternalIdentity> resolve(String issuer,String subject) {
        return db.query("SELECT * FROM external_identities WHERE issuer=? AND subject=?",row,issuer,subject).stream().findFirst();
    }
    @Override public List<ExternalIdentity> connected(UUID user) { return db.query("SELECT * FROM external_identities WHERE user_id=? ORDER BY linked_at,id",row,user.toString()); }
    @Override public void insert(ExternalIdentity e) {
        db.update("INSERT INTO external_identities(id,user_id,provider,issuer,subject,linked_at) VALUES (?,?,?,?,?,?)",
                e.id().toString(),e.userId().toString(),e.provider(),e.issuer(),e.subject(),java.sql.Timestamp.from(e.linkedAt()));
    }
    @Override public void delete(UUID user,UUID identity) { db.update("DELETE FROM external_identities WHERE user_id=? AND id=?",user.toString(),identity.toString()); }
}
