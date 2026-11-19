package com.siare.core;

import java.sql.DriverManager;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class ActivityMigrationTests {
    @Test void v5UpgradesV4WithoutChangingExistingUserOrSubject() throws Exception {
        String url="jdbc:h2:mem:h3_upgrade_"+UUID.randomUUID()+";MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url,"sa","").target("4").load().migrate();
        String user=UUID.randomUUID().toString(),subject=UUID.randomUUID().toString();
        try(var connection=DriverManager.getConnection(url,"sa",""); var sql=connection.createStatement()) {
            sql.executeUpdate("INSERT INTO users(id,name,email,password_hash,created_at) VALUES ('"+user+"','Existing','existing@example.test','unchanged-hash',CURRENT_TIMESTAMP)");
            sql.executeUpdate("INSERT INTO subjects(id,user_id,name,archived,created_at,updated_at) VALUES ('"+subject+"','"+user+"','Existing subject',FALSE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
            var upgraded=Flyway.configure().dataSource(url,"sa","").target("5").load().migrate(); assertThat(upgraded.migrationsExecuted).isEqualTo(1);
            try(var row=sql.executeQuery("SELECT password_hash FROM users WHERE id='"+user+"'")) { assertThat(row.next()).isTrue(); assertThat(row.getString(1)).isEqualTo("unchanged-hash"); }
            try(var row=sql.executeQuery("SELECT name FROM subjects WHERE id='"+subject+"'")) { assertThat(row.next()).isTrue(); assertThat(row.getString(1)).isEqualTo("Existing subject"); }
            assertThat(Flyway.configure().dataSource(url,"sa","").target("5").load().validateWithResult().validationSuccessful).isTrue();
        }
    }
}
