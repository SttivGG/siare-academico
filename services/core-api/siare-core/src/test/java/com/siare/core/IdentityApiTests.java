package com.siare.core;

import com.siare.core.application.port.out.*;
import com.siare.core.application.service.*;
import com.siare.core.domain.account.*;
import com.siare.core.domain.identity.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.*;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import tools.jackson.databind.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(print=MockMvcPrint.NONE)
@ActiveProfiles("test")
class IdentityApiTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate db;
    @Autowired UserRepository users;
    @Autowired PasswordPort passwords;
    @Autowired IdentityRepository identities;
    @Autowired SessionRepository repository;
    @Autowired AuditPort audit;
    @Autowired TransactionPort tx;
    @Autowired TokenPort tokens;
    @Autowired SessionService sessions;
    @Autowired IdentityParameterPort parameters;
    static final String PHRASE="Mis apuntes viajan por el bosque azul";
    @BeforeEach void counters() { db.update("DELETE FROM login_attempts"); }
    private User user(String hash) {
        var id=UUID.randomUUID(); return users.save(new User(id,"Prueba H2A",id+"@example.test",hash,Instant.now()));
    }
    private User user() { return user(passwords.hash(PHRASE)); }
    private ResultActions postJson(String path,Object body) throws Exception {
        return mvc.perform(post("/api/v1/"+path).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }
    private JsonNode login(User user,String password) throws Exception {
        return json.readTree(postJson("auth/login",Map.of("email",user.email(),"password",password)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
    private JsonNode refresh(String refresh) throws Exception {
        return json.readTree(postJson("auth/refresh",Map.of("refreshToken",refresh)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
    @Test void registrationRejectsRoleInjectionAndAlwaysAssignsUser() throws Exception {
        var email=UUID.randomUUID()+"@example.test";
        var body=new HashMap<String,Object>(Map.of("name","Estudiante","email",email,"password",PHRASE));
        body.put("role","SUPERADMIN"); postJson("auth/register",body).andExpect(status().isBadRequest());
        body.remove("role");
        var response=postJson("auth/register",body).andExpect(status().isCreated()).andReturn();
        var id=UUID.fromString(json.readTree(response.getResponse().getContentAsString()).get("id").asText());
        assertThat(identities.access(id).role()).isEqualTo(Role.USER);
        assertThat(identities.access(id).scopeId()).isEqualTo(AdministrativeScope.COMMUNITY);
    }
    @Test void passwordPolicyAcceptsLongUnicodeAndBlocksWeakCommonAndOversizedPasswords() throws Exception {
        for(var password:List.of("short","1234567890123456","passwordpassword", "a".repeat(1025)))
            postJson("auth/register",Map.of("name","Prueba","email",UUID.randomUUID()+"@example.test","password",password)).andExpect(status().isBadRequest());
        var longPhrase="Un café con mis apuntes y árboles ".repeat(8);
        var created=postJson("auth/register",Map.of("name","Prueba","email",UUID.randomUUID()+"@example.test","password",longPhrase))
                .andExpect(status().isCreated()).andReturn();
        var account=users.findById(UUID.fromString(json.readTree(created.getResponse().getContentAsString()).get("id").asText())).orElseThrow();
        login(account,java.text.Normalizer.normalize(longPhrase,java.text.Normalizer.Form.NFD));
    }
    @Test void legacyBcryptLoginPreservesUuidAndMigratesWithoutApplyingNewLengthPolicy() throws Exception {
        String legacy="Vieja-1234";
        var account=user(new BCryptPasswordEncoder(12).encode(legacy));
        var before=account.id();
        login(account,legacy);
        var after=users.findById(before).orElseThrow();
        assertThat(after.id()).isEqualTo(before);
        assertThat(after.passwordHash()).startsWith("$argon2id$");
        assertThat(passwords.matches(legacy,after.passwordHash())).isTrue();
    }
    @Test void excessiveAttemptsAreBlockedBeforePasswordVerification() throws Exception {
        var user=user();
        for(int i=0;i<5;i++) postJson("auth/login",Map.of("email",user.email(),"password","incorrecta")).andExpect(status().isUnauthorized());
        postJson("auth/login",Map.of("email",user.email(),"password",PHRASE)).andExpect(status().isTooManyRequests());
    }
    @Test void refreshRotationReuseDetectionAndLogoutInvalidateSignedJwt() throws Exception {
        var user=user(); var first=login(user,PHRASE);
        assertThat(first.get("refreshToken").asText()).hasSize(43);
        var second=refresh(first.get("refreshToken").asText());
        assertThat(second.get("refreshToken").asText()).isNotEqualTo(first.get("refreshToken").asText());
        assertThat(db.queryForObject("SELECT COUNT(*) FROM refresh_tokens WHERE token_hash=?",Integer.class,
                SessionService.fingerprint(second.get("refreshToken").asText()))).isEqualTo(1);
        postJson("auth/refresh",Map.of("refreshToken",first.get("refreshToken").asText())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/users/me").header("Authorization","Bearer "+second.get("accessToken").asText())).andExpect(status().isUnauthorized());
        postJson("auth/refresh",Map.of("refreshToken",second.get("refreshToken").asText())).andExpect(status().isUnauthorized());
        assertThat(db.queryForObject("SELECT COUNT(*) FROM audit_events WHERE actor_id=? AND operation='REFRESH_REUSE'",Integer.class,user.id().toString())).isEqualTo(1);
        var other=login(user,PHRASE);
        mvc.perform(post("/api/v1/auth/logout").header("Authorization","Bearer "+other.get("accessToken").asText())).andExpect(status().isOk());
        mvc.perform(get("/api/v1/users/me").header("Authorization","Bearer "+other.get("accessToken").asText())).andExpect(status().isUnauthorized());
    }
    @Test void sessionOwnershipAndRevokeOthersAreEnforcedInBackend() throws Exception {
        var user=user(); var one=sessions.open(user.id()); var two=sessions.open(user.id()); var stranger=sessions.open(user().id());
        mvc.perform(delete("/api/v1/users/me/sessions/"+stranger.sessionId()).header("Authorization","Bearer "+one.accessToken())).andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/users/me/sessions/revoke-others").header("Authorization","Bearer "+one.accessToken())).andExpect(status().isOk());
        mvc.perform(get("/api/v1/users/me").header("Authorization","Bearer "+two.accessToken())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/users/me").header("Authorization","Bearer "+one.accessToken())).andExpect(status().isOk());
        mvc.perform(post("/api/v1/users/me/sessions/revoke-all").header("Authorization","Bearer "+one.accessToken())).andExpect(status().isOk());
        mvc.perform(get("/api/v1/users/me").header("Authorization","Bearer "+one.accessToken())).andExpect(status().isUnauthorized());
    }
    @Test void inactivityAbsoluteExpiryAndSessionCapAreFinite() {
        var user=user(); var now=Instant.now();
        var atStart=new SessionService(repository,identities,tx,tokens,audit,a -> false,Clock.fixed(now,ZoneOffset.UTC),Duration.ofMinutes(30),Duration.ofHours(1),2);
        atStart.open(user.id()); atStart.open(user.id()); atStart.open(user.id());
        assertThat(repository.list(user.id()).stream().filter(s -> s.active(now)).count()).isEqualTo(2);
        assertThat(repository.list(user.id()).stream().filter(s -> s.revokedAt()!=null).count()).isEqualTo(1);
        var last=atStart.open(user.id());
        var idleExpired=new SessionService(repository,identities,tx,tokens,audit,a -> false,Clock.fixed(now.plusSeconds(1801),ZoneOffset.UTC),Duration.ofMinutes(30),Duration.ofHours(1),2);
        assertThatThrownBy(() -> idleExpired.refresh(last.refreshToken())).isInstanceOf(BusinessException.class);
        assertThat(idleExpired.validate(user.id(),last.sessionId())).isFalse();
        var at25=new SessionService(repository,identities,tx,tokens,audit,a -> false,Clock.fixed(now.plusSeconds(1500),ZoneOffset.UTC),Duration.ofMinutes(30),Duration.ofHours(1),2);
        var fresh=at25.refresh(last.refreshToken());
        var at50=new SessionService(repository,identities,tx,tokens,audit,a -> false,Clock.fixed(now.plusSeconds(3000),ZoneOffset.UTC),Duration.ofMinutes(30),Duration.ofHours(1),2);
        var finalRefresh=at50.refresh(fresh.refreshToken());
        var absoluteExpired=new SessionService(repository,identities,tx,tokens,audit,a -> false,Clock.fixed(now.plusSeconds(3601),ZoneOffset.UTC),Duration.ofMinutes(30),Duration.ofHours(1),2);
        assertThatThrownBy(() -> absoluteExpired.refresh(finalRefresh.refreshToken())).isInstanceOf(BusinessException.class);
    }
    @Test void concurrentRefreshCannotLeaveTwoValidSuccessors() throws Exception {
        var first=sessions.open(user().id()); var barrier=new CyclicBarrier(2);
        try(var executor=Executors.newFixedThreadPool(2)) {
            Callable<Integer> attempt=() -> { barrier.await(5,TimeUnit.SECONDS);
                return postJson("auth/refresh",Map.of("refreshToken",first.refreshToken())).andReturn().getResponse().getStatus(); };
            var a=executor.submit(attempt); var b=executor.submit(attempt);
            assertThat(List.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,401);
        }
        assertThat(repository.find(first.sessionId()).orElseThrow().revokedAt()).isNotNull();
    }
    @Test void administrativeApiDeniesUsersAndPrivilegedLoginRemainsFailClosed() throws Exception {
        var user=user(); var auth=sessions.open(user.id());
        for(var path:List.of("admin/overview","admin/users","admin/scopes","admin/audit"))
            mvc.perform(get("/api/v1/"+path).header("Authorization","Bearer "+auth.accessToken())).andExpect(status().isForbidden());
        for(var role:List.of(Role.ADMIN,Role.SUPERADMIN)) {
            var privilegedUser=user(); var access=identities.access(privilegedUser.id());
            identities.update(new UserAccess(access.userId(),role,access.scopeId(),true,access.version()));
            postJson("auth/login",Map.of("email",privilegedUser.email(),"password",PHRASE)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.mfaRequired").value(true)).andExpect(jsonPath("$.enrollmentRequired").value(true))
                    .andExpect(jsonPath("$.accessToken").isEmpty()).andExpect(jsonPath("$.refreshToken").isEmpty());
            assertThat(repository.list(privilegedUser.id())).isEmpty();
        }
        assertThat(db.queryForObject("SELECT COUNT(*) FROM audit_events WHERE actor_id=? AND outcome='DENIED'",Integer.class,user.id().toString())).isGreaterThanOrEqualTo(4);
    }
    @Test void controlledPolicyExercisesAdminBoundariesAndSuperadminPermissions() {
        // The permissive policy exists ONLY in this local object, never in the Spring runtime.
        var service=new AdministrationService(identities,audit,tx,sessions,a -> true,parameters);
        var root=user(); var admin=user(); var target=user(); var foreign=user();
        var scope=identities.createScope("Ámbito "+UUID.randomUUID());
        for(var entry:Map.of(root.id(),Role.SUPERADMIN,admin.id(),Role.ADMIN).entrySet()) {
            var access=identities.access(entry.getKey()); identities.update(new UserAccess(access.userId(),entry.getValue(),access.scopeId(),true,access.version()));
        }
        var foreignAccess=identities.access(foreign.id()); identities.update(new UserAccess(foreign.id(),Role.USER,scope.id(),true,foreignAccess.version()));
        assertThat(service.users(admin.id(),100,0)).allMatch(a -> a.scopeId().equals(AdministrativeScope.COMMUNITY));
        assertThatThrownBy(() -> service.assign(admin.id(),foreign.id(),Role.USER,scope.id(),false,1)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.assign(admin.id(),target.id(),Role.SUPERADMIN,AdministrativeScope.COMMUNITY,true,0)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.audit(admin.id(),20,0)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.assign(admin.id(),root.id(),Role.USER,AdministrativeScope.COMMUNITY,true,1)).isInstanceOf(BusinessException.class);
        var sameScopeUser=user();
        var ownScopeResult=service.assign(admin.id(),sameScopeUser.id(),Role.USER,AdministrativeScope.COMMUNITY,false,0);
        assertThat(ownScopeResult.enabled()).isFalse();
        assertThat(ownScopeResult.scopeId()).isEqualTo(AdministrativeScope.COMMUNITY);
        assertThatThrownBy(() -> service.registrationParameter(admin.id())).isInstanceOf(BusinessException.class);
        var parameter=service.registrationParameter(root.id());
        var updated=service.registrationParameter(root.id(),false,parameter.version());
        assertThat(updated.enabled()).isFalse();
        service.registrationParameter(root.id(),true,updated.version());
        var active=sessions.open(target.id());
        var result=service.assign(root.id(),target.id(),Role.ADMIN,scope.id(),true,0);
        assertThat(result.role()).isEqualTo(Role.ADMIN); assertThat(result.scopeId()).isEqualTo(scope.id());
        assertThat(repository.find(active.sessionId()).orElseThrow().revokedAt()).isNotNull();
        assertThat(service.audit(root.id(),100,0)).anyMatch(e -> e.operation().equals("ROLE_SCOPE_CHANGE") && e.outcome().equals("SUCCESS"));
        assertThatThrownBy(() -> service.assign(root.id(),target.id(),Role.USER,scope.id(),true,0)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.assign(root.id(),root.id(),Role.USER,scope.id(),true,1)).isInstanceOf(BusinessException.class);
    }
}
