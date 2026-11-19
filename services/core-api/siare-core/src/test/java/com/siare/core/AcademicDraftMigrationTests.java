package com.siare.core;

import java.sql.*;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

/** V1-V5 integrity, data preservation and explicit native MySQL backup/restore stages. */
class AcademicDraftMigrationTests {
    @Test void v6PreservesV5UsersSubjectsAndSessionsAndValidatesHistory() throws Exception {
        String mysql = System.getenv("H5D_TEST_MYSQL_URL"), phase = System.getenv("H5D_MIGRATION_PHASE");
        boolean real = mysql != null && !mysql.isBlank();
        String url = "jdbc:h2:mem:h5d_upgrade_" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1";
        String user = "sa", password = "";
        if (real) {
            if (!mysql.matches("jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/siare_h5d_test\\?.*")) throw new IllegalStateException("Requires isolated loopback MySQL");
            url = mysql.replace("/siare_h5d_test?", "/siare_h5d_migration_test?");
            user = System.getenv("H5D_TEST_MYSQL_USER"); password = System.getenv("H5D_TEST_MYSQL_PASSWORD");
        }
        if (!"upgrade".equals(phase) && !"restore".equals(phase)) {
            Flyway.configure().dataSource(url, user, password).target("5").load().migrate();
            try (var c = DriverManager.getConnection(url, user, password); var sql = c.createStatement()) {
                sql.executeUpdate("INSERT INTO users(id,name,email,password_hash,created_at) VALUES ('00000000-0000-4000-8000-000000000111','Preserved','preserved@example.test','preserved-test-hash',CURRENT_TIMESTAMP)");
                sql.executeUpdate("INSERT INTO subjects(id,user_id,name,archived,created_at,updated_at) VALUES ('00000000-0000-4000-8000-000000000112','00000000-0000-4000-8000-000000000111','Preserved subject',FALSE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
                sql.executeUpdate("INSERT INTO user_sessions(id,user_id,created_at,last_seen_at,idle_expires_at,absolute_expires_at) VALUES ('00000000-0000-4000-8000-000000000113','00000000-0000-4000-8000-000000000111',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
            }
        }
        try (var c = DriverManager.getConnection(url, user, password); var sql = c.createStatement()) {
            if (!"baseline".equals(phase) && !"restore".equals(phase)) {
                var result = Flyway.configure().dataSource(url, user, password).load().migrate(); assertThat(result.migrationsExecuted).isEqualTo(1);
                assertThat(Flyway.configure().dataSource(url, user, password).load().validateWithResult().validationSuccessful).isTrue();
                try (var r = sql.executeQuery("SELECT COUNT(*) FROM academic_drafts")) { r.next(); assertThat(r.getInt(1)).isZero(); }
            } else {
                assertThat(Flyway.configure().dataSource(url, user, password).target("5").load().validateWithResult().validationSuccessful).isTrue();
                try (var r = sql.executeQuery("SELECT COUNT(*) FROM flyway_schema_history WHERE version='6'")) { r.next(); assertThat(r.getInt(1)).isZero(); }
            }
            try (var r = sql.executeQuery("SELECT password_hash FROM users WHERE id='00000000-0000-4000-8000-000000000111'")) { assertThat(r.next()).isTrue(); assertThat(r.getString(1)).isEqualTo("preserved-test-hash"); }
            try (var r = sql.executeQuery("SELECT name FROM subjects WHERE id='00000000-0000-4000-8000-000000000112'")) { assertThat(r.next()).isTrue(); assertThat(r.getString(1)).isEqualTo("Preserved subject"); }
            try (var r = sql.executeQuery("SELECT COUNT(*) FROM user_sessions WHERE id='00000000-0000-4000-8000-000000000113' AND revoked_at IS NULL AND version=0")) { r.next(); assertThat(r.getInt(1)).isEqualTo(1); }
        }
    }
}
