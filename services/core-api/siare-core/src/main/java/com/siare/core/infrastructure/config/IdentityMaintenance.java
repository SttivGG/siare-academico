package com.siare.core.infrastructure.config;

import java.sql.Timestamp;
import java.time.*;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.*;

/** Retains audit forever; removes only expired credential records after the retention window. */
@Configuration(proxyBeanMethods=false)
@EnableScheduling
public class IdentityMaintenance {
    private final JdbcTemplate db;
    private final Clock clock;
    public IdentityMaintenance(JdbcTemplate db,Clock clock) { this.db=db; this.clock=clock; }
    @Scheduled(initialDelayString="PT1H",fixedDelayString="PT1H")
    public void pruneExpiredCredentials() {
        db.update("DELETE FROM user_sessions WHERE absolute_expires_at < ?",Timestamp.from(clock.instant().minus(Duration.ofDays(30))));
        db.update("DELETE FROM login_attempts WHERE window_start < ?",Timestamp.from(clock.instant().minus(Duration.ofDays(1))));
        db.update("DELETE FROM mfa_challenges WHERE expires_at < ?",Timestamp.from(clock.instant().minus(Duration.ofDays(1))));
        db.update("DELETE FROM password_reset_tokens WHERE expires_at < ?",Timestamp.from(clock.instant().minus(Duration.ofDays(1))));
    }
}
