package com.siare.core;

import com.siare.core.application.port.in.FederatedIdentityUseCase;
import com.siare.core.application.service.*;
import com.siare.core.infrastructure.adapter.out.security.*;
import com.siare.core.infrastructure.adapter.out.security.OidcFlowStore.Flow;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.*;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.*;

/** Explicit integration run only: MySQL/Redis in the existing SIARE data network. */
@Tag("real-stores")
@SpringBootTest
@ActiveProfiles("test")
class OidcRealStoresTests {
    @DynamicPropertySource static void realStores(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url",() -> "jdbc:mysql://mysql:3306/"+System.getenv("MYSQL_DATABASE")+"?allowPublicKeyRetrieval=true&sslMode=DISABLED");
        properties.add("spring.datasource.username",() -> System.getenv("MYSQL_USER"));
        properties.add("spring.datasource.password",() -> System.getenv("MYSQL_PASSWORD"));
        properties.add("spring.datasource.driver-class-name",() -> "com.mysql.cj.jdbc.Driver");
    }
    @Autowired OidcFlowStore flows;
    @Autowired OidcProtocol protocol;
    @Autowired StringRedisTemplate redis;
    @Autowired JdbcTemplate db;
    @Autowired FederatedIdentityUseCase identities;
    @Autowired ObjectMapper json;
    @ParameterizedTest @ValueSource(strings={"google","gitlab"})
    void controlledOidcUsesActualRedisAndMysqlAndExportsOnlyDummySiareSessionForRestartCheck(String providerName) throws Exception {
        try(var provider=new ControlledOidcProvider()) {
            String state=MfaService.opaque(new java.security.SecureRandom(),32),binding=MfaService.opaque(new java.security.SecureRandom(),32);
            var registration=provider.registration(providerName);
            var f=new Flow(providerName,SessionService.fingerprint(binding),MfaService.opaque(new java.security.SecureRandom(),32),MfaService.opaque(new java.security.SecureRandom(),32),state,registration.getRedirectUri(),null,null,Instant.now().plusSeconds(300));
            flows.put(f);
            String key="siare:oidc:flow:"+SessionService.fingerprint(state);
            assertThat(redis.getExpire(key)).isBetween(1L,300L);
            var consumed=flows.take(state); assertThat(consumed).isEqualTo(f); assertThat(flows.take(state)).isNull();
            flows.put(f);
            var pool=java.util.concurrent.Executors.newFixedThreadPool(2);
            try {
                var a=pool.submit(() -> flows.take(state)); var b=pool.submit(() -> flows.take(state));
                long winners=java.util.stream.Stream.of(a.get(10,java.util.concurrent.TimeUnit.SECONDS),b.get(10,java.util.concurrent.TimeUnit.SECONDS)).filter(Objects::nonNull).count();
                assertThat(winners).isEqualTo(1);
            } finally { pool.shutdownNow(); }
            String email="oidc-live-"+UUID.randomUUID()+"@example.test",subject=UUID.randomUUID().toString();
            String code=provider.code(providerName,OidcProtocol.request(registration,f).getAuthorizationRequestUri(),subject,email,"");
            var principal=protocol.authenticate(registration,consumed,code,state); var session=identities.login(principal);
            var user=db.queryForObject("SELECT user_id FROM external_identities WHERE issuer=? AND subject=?",String.class,principal.issuer(),subject);
            assertThat(db.queryForObject("SELECT role_name FROM user_access WHERE user_id=?",String.class,user)).isEqualTo("USER");
            assertThat(db.queryForObject("SELECT authentication_level FROM user_sessions WHERE id=?",String.class,session.sessionId().toString())).isEqualTo("OIDC");
            var logins=java.util.concurrent.Executors.newFixedThreadPool(2);
            try {
                var a=logins.submit(() -> identities.login(principal)); var b=logins.submit(() -> identities.login(principal));
                assertThat(a.get(10,java.util.concurrent.TimeUnit.SECONDS).sessionId()).isNotEqualTo(b.get(10,java.util.concurrent.TimeUnit.SECONDS).sessionId());
                assertThat(db.queryForObject("SELECT COUNT(*) FROM users WHERE email=?",Integer.class,email)).isEqualTo(1);
                assertThat(db.queryForObject("SELECT COUNT(*) FROM external_identities WHERE issuer=? AND subject=?",Integer.class,principal.issuer(),subject)).isEqualTo(1);
            } finally { logins.shutdownNow(); }
            String evidence=System.getenv("H2B2_SESSION_EVIDENCE");
            if(evidence!=null) java.nio.file.Files.writeString(java.nio.file.Path.of(evidence),json.writeValueAsString(Map.of("session",Map.of("refreshToken",session.refreshToken(),"sessionId",session.sessionId()),"user",user)));
        }
    }
}
