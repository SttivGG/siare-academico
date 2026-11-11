package com.siare.core;

import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.assertj.core.api.Assertions.assertThat;

class IdentityMigrationTests {
    @Test void v3PreservesV2SessionsRolesRefreshAndAuditWithoutTouchingExistingMigrations() {
        var data=new DriverManagerDataSource("jdbc:h2:mem:mfa-migration-"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE","sa","");
        var db=new JdbcTemplate(data);
        Flyway.configure().dataSource(data).locations("classpath:db/migration").target("2").load().migrate();
        String user=UUID.randomUUID().toString(),session=UUID.randomUUID().toString(),audit=UUID.randomUUID().toString();
        String hash=com.siare.core.application.service.SessionService.fingerprint(UUID.randomUUID().toString());
        db.update("INSERT INTO users(id,name,email,password_hash,created_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)",user,"Anterior MFA",UUID.randomUUID()+"@example.test","legacy-test-hash");
        db.update("INSERT INTO user_access(user_id,role_name,scope_id) VALUES (?,'ADMIN',?)",user,com.siare.core.domain.identity.AdministrativeScope.COMMUNITY.toString());
        db.update("INSERT INTO user_sessions(id,user_id,created_at,last_seen_at,idle_expires_at,absolute_expires_at) VALUES (?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",session,user);
        db.update("INSERT INTO refresh_tokens(token_hash,session_id,created_at) VALUES (?,?,CURRENT_TIMESTAMP)",hash,session);
        db.update("INSERT INTO audit_events(id,actor_id,operation,resource,occurred_at,outcome) VALUES (?,?,'PREVIOUS_EVENT','identity',CURRENT_TIMESTAMP,'SUCCESS')",audit,user);
        var queries=java.util.List.of("SELECT * FROM users","SELECT * FROM user_access","SELECT * FROM refresh_tokens","SELECT * FROM audit_events",
                "SELECT id,user_id,created_at,last_seen_at,idle_expires_at,absolute_expires_at,revoked_at,version FROM user_sessions");
        var before=queries.stream().map(db::queryForList).toList();
        var flyway=Flyway.configure().dataSource(data).locations("classpath:db/migration").load(); flyway.migrate(); flyway.validate();
        assertThat(queries.stream().map(db::queryForList).toList()).isEqualTo(before);
        assertThat(db.queryForObject("SELECT authentication_level FROM user_sessions WHERE id=?",String.class,session)).isEqualTo("PASSWORD");
        assertThat(db.queryForObject("SELECT mfa_verified_at FROM user_sessions WHERE id=?",java.sql.Timestamp.class,session)).isNull();
        assertThat(flyway.migrate().migrationsExecuted).isZero();
    }
    @Test void migratesV1UsersAndSubjectsWithoutReplacingCredentialsOrIdentifiers() {
        var data=new DriverManagerDataSource("jdbc:h2:mem:migration-"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE","sa","");
        var db=new JdbcTemplate(data);
        Flyway.configure().dataSource(data).locations("classpath:db/migration").target("1").load().migrate();
        var user=UUID.randomUUID().toString(); var subject=UUID.randomUUID().toString();
        String credential=new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(4).encode("Legacy1234");
        db.update("INSERT INTO users(id,name,email,password_hash,created_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)",user,"Anterior","previous@example.test",credential);
        db.update("INSERT INTO subjects(id,user_id,name,created_at,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",subject,user,"Materia anterior");
        var flyway=Flyway.configure().dataSource(data).locations("classpath:db/migration").load();
        flyway.migrate(); flyway.validate();
        assertThat(db.queryForObject("SELECT password_hash FROM users WHERE id=?",String.class,user)).isEqualTo(credential);
        assertThat(db.queryForObject("SELECT user_id FROM subjects WHERE id=?",String.class,subject)).isEqualTo(user);
        assertThat(db.queryForObject("SELECT role_name FROM user_access WHERE user_id=?",String.class,user)).isEqualTo("USER");
        assertThat(flyway.migrate().migrationsExecuted).isZero();
    }
}
