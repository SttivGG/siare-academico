package com.siare.core;

import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.assertj.core.api.Assertions.*;

class OidcMigrationTests {
    @Test void v4PreservesAllV3TablesAndAddsExactIdentityUniqueness() {
        var source=new DriverManagerDataSource("jdbc:h2:mem:oidc-migration-"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1","sa",""); var db=new JdbcTemplate(source);
        Flyway.configure().dataSource(source).locations("classpath:db/migration").target("3").load().migrate();
        String user=UUID.randomUUID().toString();
        db.update("INSERT INTO users VALUES (?,?,?,?,CURRENT_TIMESTAMP)",user,"Anterior","previous@example.test","unchanged-test-hash");
        db.update("INSERT INTO user_access(user_id,scope_id) VALUES (?,?)",user,com.siare.core.domain.identity.AdministrativeScope.COMMUNITY.toString());
        var tables=List.of("users","subjects","user_access","user_sessions","refresh_tokens","audit_events","mfa_credentials","mfa_challenges","mfa_recovery_codes","password_reset_tokens");
        var before=tables.stream().map(t -> db.queryForList("SELECT * FROM "+t)).toList();
        var flyway=Flyway.configure().dataSource(source).locations("classpath:db/migration").load(); flyway.migrate(); flyway.validate();
        assertThat(tables.stream().map(t -> db.queryForList("SELECT * FROM "+t)).toList()).isEqualTo(before);
        db.update("INSERT INTO external_identities VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)",UUID.randomUUID().toString(),user,"google","https://issuer.test","CaseSensitive");
        db.update("INSERT INTO external_identities VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)",UUID.randomUUID().toString(),user,"google","https://issuer.test","casesensitive");
        assertThatThrownBy(() -> db.update("INSERT INTO external_identities VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)",UUID.randomUUID().toString(),user,"google","https://issuer.test","CaseSensitive")).isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
        assertThat(flyway.migrate().migrationsExecuted).isZero();
    }
}
