package com.siare.core.infrastructure.adapter.out.persistence;
import com.siare.core.application.port.out.AttemptOutbox;
import com.siare.core.domain.activity.AttemptEvent;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;
@Repository
public class JdbcAttemptOutbox implements AttemptOutbox {
    private final JdbcTemplate db;
    private final ObjectMapper json;
    public JdbcAttemptOutbox(JdbcTemplate db,ObjectMapper json) { this.db=db; this.json=json; }
    @Override public List<Delivery> claim(Instant now,int limit) {
        var events=db.query("SELECT event_id FROM academic_attempt_outbox WHERE status='PENDING' AND available_at<=? AND (lease_until IS NULL OR lease_until<=?) ORDER BY available_at,event_id LIMIT ?",
                (rs,n)->rs.getString(1),Timestamp.from(now),Timestamp.from(now),limit);
        var claimed=new ArrayList<Delivery>();
        for(String event:events) {
            UUID lease=UUID.randomUUID();
            int updated=db.update("UPDATE academic_attempt_outbox SET lease_token=?,lease_until=?,delivery_attempts=delivery_attempts+1 WHERE event_id=? AND status='PENDING' AND available_at<=? AND (lease_until IS NULL OR lease_until<=?)",
                    lease.toString(),Timestamp.from(now.plusSeconds(120)),event,Timestamp.from(now),Timestamp.from(now));
            if(updated==1) claimed.addAll(db.query("SELECT payload_json,delivery_attempts FROM academic_attempt_outbox WHERE event_id=? AND lease_token=?",
                    (rs,n)->new Delivery(json.readValue(rs.getString(1),AttemptEvent.class),lease,rs.getInt(2)),event,lease.toString()));
        }
        return claimed;
    }
    @Override public void delivered(Delivery delivery,Instant now) {
        db.update("UPDATE academic_attempt_outbox SET status='DELIVERED',delivered_at=?,lease_token=NULL,lease_until=NULL WHERE event_id=? AND lease_token=?",
                Timestamp.from(now),delivery.event().eventId().toString(),delivery.leaseToken().toString());
    }
    @Override public void retry(Delivery delivery,Instant availableAt) {
        db.update("UPDATE academic_attempt_outbox SET available_at=?,lease_token=NULL,lease_until=NULL WHERE event_id=? AND lease_token=? AND status='PENDING'",
                Timestamp.from(availableAt),delivery.event().eventId().toString(),delivery.leaseToken().toString());
    }
}
