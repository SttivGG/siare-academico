package com.siare.core;

import com.siare.core.application.port.in.*;
import com.siare.core.application.port.out.*;
import com.siare.core.application.service.*;
import com.siare.core.domain.account.*;
import com.siare.core.domain.identity.*;
import com.siare.core.domain.identity.Role;
import com.siare.core.infrastructure.adapter.out.security.*;
import com.siare.core.infrastructure.adapter.out.security.OidcFlowStore.Flow;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.Arguments;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.boot.webmvc.test.autoconfigure.*;
import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import tools.jackson.databind.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:oidc-federation;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE")
@AutoConfigureMockMvc(print=MockMvcPrint.NONE)
@ActiveProfiles("test")
@Import(OidcFederationTests.Configuration.class)
class OidcFederationTests {
    static final String PASSWORD="Las identidades conservan los apuntes del bosque";
    static final ControlledOidcProvider PROVIDER;
    static { try { PROVIDER=new ControlledOidcProvider(); } catch(Exception ex) { throw new ExceptionInInitializerError(ex); } }
    static final class MemoryFlows extends OidcFlowStore {
        final Map<String,Flow> values=new ConcurrentHashMap<>();
        @Override public void put(Flow f) { values.put(f.state(),f); }
        @Override public Flow take(String state) { return values.remove(state); }
    }
    @TestConfiguration(proxyBeanMethods=false)
    static class Configuration {
        @Bean @Primary MemoryFlows memoryFlows() { return new MemoryFlows(); }
        @Bean @Primary OidcProviders controlledProviders(Environment env) {
            return new OidcProviders(env) {
                final Map<String,ClientRegistration> registrations=new ConcurrentHashMap<>();
                @Override public boolean enabled(String p) { return Set.of("google","gitlab").contains(p); }
                @Override public ClientRegistration registration(String p) { return registrations.computeIfAbsent(p,PROVIDER::registration); }
            };
        }
    }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate db;
    @Autowired MemoryFlows flows;
    @Autowired FederatedIdentityUseCase federation;
    @Autowired ExternalIdentityRepository external;
    @Autowired UserRepository users;
    @Autowired IdentityRepository identities;
    @Autowired SessionRepository repository;
    @Autowired SessionService sessions;
    @Autowired MfaService mfa;
    @Autowired TotpPort totp;
    @Autowired PasswordPort passwords;
    @Autowired TransactionPort tx;
    @BeforeEach void counters() { db.update("DELETE FROM login_attempts"); }
    @AfterAll static void close() { PROVIDER.close(); }
    record Attempt(String provider,String binding,String state,String code,String authorization) {}
    ResultActions postJson(String path,Object body,String token) throws Exception {
        var request=post("/api/v1/"+path).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        if(token!=null) request.header("Authorization","Bearer "+token); return mvc.perform(request);
    }
    Attempt start(String p,String subject,String email,String fault) throws Exception {
        String binding=MfaService.opaque(new java.security.SecureRandom(),32);
        var result=postJson("auth/oidc/start",Map.of("provider",p,"binding",binding),null).andExpect(status().isOk()).andReturn();
        String url=json.readTree(result.getResponse().getContentAsString()).get("authorizationUrl").asString();
        var params=ControlledOidcProvider.form(java.net.URI.create(url).getRawQuery());
        assertThat(params.get("code_challenge_method")).isEqualTo("S256"); assertThat(params.get("nonce")).isNotBlank();
        assertThat(Set.of(params.get("scope").split(" "))).containsExactlyInAnyOrder("openid","profile","email");
        assertThat(params.get("response_type")).isEqualTo("code");
        if(p.equals("google")) assertThat(params.get("prompt")).isEqualTo("select_account");
        else assertThat(params).doesNotContainKey("prompt");
        return new Attempt(p,binding,params.get("state"),PROVIDER.code(p,url,subject,email,fault),url);
    }
    ResultActions complete(Attempt a) throws Exception { return postJson("auth/oidc/complete",Map.of("provider",a.provider,"binding",a.binding,"state",a.state,"code",a.code),null); }
    JsonNode success(Attempt a) throws Exception { return json.readTree(complete(a).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()); }
    FederatedPrincipal principal(String provider) { return new FederatedPrincipal(provider,PROVIDER.issuer(provider),UUID.randomUUID().toString(),"Federado",UUID.randomUUID()+"@example.test",true); }
    User local(Role role) {
        UUID id=UUID.randomUUID(); var u=users.save(new User(id,"Local",id+"@example.test",passwords.hash(PASSWORD),Instant.now()));
        if(role!=Role.USER) { var a=identities.access(id); identities.update(new UserAccess(id,role,a.scopeId(),true,a.version())); } return u;
    }
    @ParameterizedTest @ValueSource(strings={"google","gitlab"})
    void validDiscoveryPkceJwksAndOidcCreatesOnlyUserAndRevocableSession(String p) throws Exception {
        String subject=UUID.randomUUID().toString(),email=UUID.randomUUID()+"@example.test";
        var data=success(start(p,subject,email,"")); var id=external.resolve(PROVIDER.issuer(p),subject).orElseThrow().userId();
        assertThat(identities.access(id).role()).isEqualTo(Role.USER);
        assertThat(users.findById(id).orElseThrow().passwordHash()).isEqualTo("!OIDC");
        assertThat(users.findById(id).orElseThrow().email()).isEqualTo(email);
        String access=data.get("accessToken").asString();
        mvc.perform(get("/api/v1/users/me").header("Authorization","Bearer "+access)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/admin/users").header("Authorization","Bearer "+access)).andExpect(status().isForbidden());
        var renewed=sessions.refresh(data.get("refreshToken").asString()); assertThat(renewed.accessToken()).isNotBlank();
        sessions.logout(id,renewed.sessionId());
        mvc.perform(get("/api/v1/users/me").header("Authorization","Bearer "+access)).andExpect(status().isUnauthorized());
        assertThatThrownBy(() -> sessions.refresh(renewed.refreshToken())).isInstanceOf(BusinessException.class);
    }
    static java.util.stream.Stream<Arguments> providerFaults() {
        return java.util.stream.Stream.of("google","gitlab").flatMap(p -> java.util.stream.Stream.of("nonce","signature","issuer","audience","expired","algorithm")
            .map(fault -> Arguments.of(p,fault)));
    }
    @ParameterizedTest @MethodSource("providerFaults")
    void cryptographicAndClaimFailuresAreRejectedAndStateCannotBeReplayed(String p,String fault) throws Exception {
        String subject=UUID.randomUUID().toString();
        var a=start(p,subject,UUID.randomUUID()+"@example.test",fault);
        complete(a).andExpect(status().isUnauthorized()); complete(a).andExpect(status().isUnauthorized());
        assertThat(external.resolve(PROVIDER.issuer(p),subject)).isEmpty();
    }
    @Test void tokenEndpointOutageHasAnAvailabilityCodeAndCannotBeReplayed() throws Exception {
        var a=start("google",UUID.randomUUID().toString(),UUID.randomUUID()+"@example.test","communication");
        complete(a).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("OIDC_TOKEN_ENDPOINT_UNAVAILABLE"));
        complete(a).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("OIDC_CONTEXT_INVALID"));
    }
    @Test void smallProviderClockDifferenceIsAcceptedButExpirationStillHasZeroTolerance() throws Exception {
        // Freeze the verifier clock behind the provider so a slow test cannot hide the regression.
        var clock=Clock.fixed(Instant.now().minusSeconds(5),ZoneOffset.UTC);
        var protocol=new OidcProtocol(clock); var registration=PROVIDER.registration("google");
        var random=new java.security.SecureRandom();
        var flow=new Flow("google","unused-binding-hash",MfaService.opaque(random,32),MfaService.opaque(random,32),
            MfaService.opaque(random,32),registration.getRedirectUri(),null,null,clock.instant().plusSeconds(300));
        String authorization=OidcProtocol.request(registration,flow).getAuthorizationRequestUri();
        String code=PROVIDER.code("google",authorization,UUID.randomUUID().toString(),UUID.randomUUID()+"@example.test","small_future");
        assertThat(protocol.authenticate(registration,flow,code,flow.state()).emailVerified()).isTrue();
        complete(start("google",UUID.randomUUID().toString(),UUID.randomUUID()+"@example.test","recently_expired"))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("OIDC_TOKEN_EXPIRED"));
    }
    @ParameterizedTest
    @CsvSource({"nonce,OIDC_NONCE_INVALID", "issuer,OIDC_ISSUER_INVALID", "audience,OIDC_AUDIENCE_INVALID",
        "expired,OIDC_TOKEN_EXPIRED", "future,OIDC_TOKEN_ISSUED_IN_FUTURE", "azp,OIDC_AZP_INVALID",
        "signature,OIDC_ID_TOKEN_INVALID", "missing_id_token,OIDC_ID_TOKEN_INVALID",
        "client_rejected,OIDC_TOKEN_CLIENT_REJECTED", "grant_rejected,OIDC_TOKEN_GRANT_REJECTED"})
    void diagnosticsIdentifyTheFailedStageWithoutProviderPayloads(String fault,String expected) throws Exception {
        var a=start("google",UUID.randomUUID().toString(),UUID.randomUUID()+"@example.test",fault);
        String reference=UUID.randomUUID().toString();
        var result=mvc.perform(post("/api/v1/auth/oidc/complete").contentType(MediaType.APPLICATION_JSON)
                .header("X-SIARE-OIDC-Diagnostic",reference)
                .content(json.writeValueAsString(Map.of("provider",a.provider,"binding",a.binding,"state",a.state,"code",a.code))))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(expected))
            .andExpect(header().string("X-SIARE-OIDC-Diagnostic",reference)).andReturn();
        String body=result.getResponse().getContentAsString();
        assertThat(body).doesNotContain(a.code,a.binding,a.state,"private-provider-description","controlled-token-do-not-log");
        complete(a).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("OIDC_CONTEXT_INVALID"));
    }
    @ParameterizedTest @ValueSource(strings={"google","gitlab"})
    void wrongStateBindingAndSuccessfulReplayAreRejected(String p) throws Exception {
        var a=start(p,UUID.randomUUID().toString(),UUID.randomUUID()+"@example.test","");
        complete(new Attempt(a.provider,a.binding,"X".repeat(43),a.code,a.authorization)).andExpect(status().isUnauthorized());
        success(a); complete(a).andExpect(status().isUnauthorized());
        var b=start(p,UUID.randomUUID().toString(),UUID.randomUUID()+"@example.test","");
        complete(new Attempt(b.provider,"Y".repeat(43),b.state,b.code,b.authorization)).andExpect(status().isUnauthorized());
        complete(b).andExpect(status().isUnauthorized());
    }
    @Test void expiredStateAndProviderMixupAreRejected() throws Exception {
        var a=start("google",UUID.randomUUID().toString(),UUID.randomUUID()+"@example.test",""); var f=flows.values.get(a.state);
        flows.values.put(a.state,new Flow(f.provider(),f.bindingHash(),f.nonce(),f.verifier(),f.state(),f.redirectUri(),null,null,Instant.now().minusSeconds(1)));
        complete(a).andExpect(status().isUnauthorized());
        var b=start("google",UUID.randomUUID().toString(),UUID.randomUUID()+"@example.test","");
        complete(new Attempt("gitlab",b.binding,b.state,b.code,b.authorization)).andExpect(status().isUnauthorized());
    }
    @Test void redirectCannotBeChosenByCallerAndCannotChangeDuringFlow() throws Exception {
        postJson("auth/oidc/start",Map.of("provider","google","binding","X".repeat(43),"redirectUri","https://evil.example"),null).andExpect(status().isBadRequest());
        var a=start("google",UUID.randomUUID().toString(),UUID.randomUUID()+"@example.test",""); var f=flows.values.get(a.state);
        flows.values.put(a.state,new Flow(f.provider(),f.bindingHash(),f.nonce(),f.verifier(),f.state(),"https://evil.example",null,null,f.expiresAt()));
        complete(a).andExpect(status().isUnauthorized());
    }
    @ParameterizedTest @ValueSource(strings={"google","gitlab"})
    void matchingEmailRequiresAuthenticatedLinkAndRetainsUuid(String p) throws Exception {
        var u=local(Role.USER); String subject=UUID.randomUUID().toString();
        complete(start(p,subject,u.email(),"")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("OIDC_EMAIL_LINK_REQUIRED"));
        assertThat(external.connected(u.id())).isEmpty();
        var s=sessions.open(u.id());
        String binding="L".repeat(43);
        postJson("users/me/identities/start",Map.of("provider",p,"binding",binding,"confirmed",false),s.accessToken()).andExpect(status().isBadRequest());
        var response=postJson("users/me/identities/start",Map.of("provider",p,"binding",binding,"confirmed",true),s.accessToken()).andExpect(status().isOk()).andReturn();
        String url=json.readTree(response.getResponse().getContentAsString()).get("authorizationUrl").asString();
        var state=ControlledOidcProvider.form(java.net.URI.create(url).getRawQuery()).get("state");
        var code=PROVIDER.code(p,url,subject,u.email(),"");
        var linked=postJson("auth/oidc/complete",Map.of("provider",p,"binding",binding,"state",state,"code",code),s.accessToken()).andExpect(status().isOk()).andReturn();
        assertThat(json.readTree(linked.getResponse().getContentAsString()).get("linked").asBoolean()).isTrue();
        assertThat(external.resolve(PROVIDER.issuer(p),subject).orElseThrow().userId()).isEqualTo(u.id());
        assertThat(success(start(p,subject,u.email(),"")).get("accessToken").asString()).isNotBlank();
        assertThat(db.queryForObject("SELECT COUNT(*) FROM audit_events WHERE actor_id=? AND operation='OIDC_LINK'",Integer.class,u.id().toString())).isEqualTo(1);
    }
    @Test void linkingCallbackRejectsRevokedOriginalSession() throws Exception {
        var u=local(Role.USER); var session=sessions.open(u.id()); var p=principal("google");
        sessions.logout(u.id(),session.sessionId());
        assertThatThrownBy(() -> federation.link(u.id(),session.sessionId(),p)).isInstanceOf(BusinessException.class);
        assertThat(external.connected(u.id())).isEmpty();
    }
    @Test void duplicateAndConcurrentLinkCannotTransferIdentity() throws Exception {
        var u=local(Role.USER); var other=local(Role.USER); var a=sessions.open(u.id()); var b=sessions.open(other.id()); var p=principal("google");
        var pool=Executors.newFixedThreadPool(2); var start=new CountDownLatch(1);
        try {
            var calls=List.of(pool.submit(() -> { start.await(); try { federation.link(u.id(),a.sessionId(),p); return true; } catch(BusinessException ex) { return false; } }),
                    pool.submit(() -> { start.await(); try { federation.link(other.id(),b.sessionId(),p); return true; } catch(BusinessException ex) { return false; } }));
            start.countDown(); int successes=0; for(var c:calls) if(c.get(10,TimeUnit.SECONDS)) successes++;
            assertThat(successes).isEqualTo(1); assertThat(external.connected(u.id()).size()+external.connected(other.id()).size()).isEqualTo(1);
        } finally { pool.shutdownNow(); }
    }
    @Test void concurrentFirstLoginsCreateOneUser() throws Exception {
        var p=principal("google"); var pool=Executors.newFixedThreadPool(2); var start=new CountDownLatch(1);
        try {
            var a=pool.submit(() -> { start.await(); return federation.login(p); }); var b=pool.submit(() -> { start.await(); return federation.login(p); }); start.countDown();
            assertThat(a.get(10,TimeUnit.SECONDS).sessionId()).isNotEqualTo(b.get(10,TimeUnit.SECONDS).sessionId());
            assertThat(db.queryForObject("SELECT COUNT(*) FROM users WHERE email=?",Integer.class,p.email())).isEqualTo(1);
            assertThat(db.queryForObject("SELECT COUNT(*) FROM external_identities WHERE issuer=? AND subject=?",Integer.class,p.issuer(),p.subject())).isEqualTo(1);
        } finally { pool.shutdownNow(); }
    }
    @Test void unlinkPreservesLastLoginMethodAndRevokesOtherSessions() {
        var p=principal("google"); var session=federation.login(p); var id=external.resolve(p.issuer(),p.subject()).orElseThrow();
        assertThatThrownBy(() -> federation.unlink(id.userId(),session.sessionId(),id.id())).isInstanceOf(BusinessException.class);
        federation.link(id.userId(),session.sessionId(),principal("gitlab")); var other=federation.login(p);
        federation.unlink(id.userId(),session.sessionId(),id.id());
        assertThat(external.connected(id.userId())).hasSize(1); assertThat(repository.find(other.sessionId()).orElseThrow().revokedAt()).isNotNull();
        var local=local(Role.USER); var s=sessions.open(local.id()); federation.link(local.id(),s.sessionId(),principal("google"));
        federation.unlink(local.id(),s.sessionId(),external.connected(local.id()).getFirst().id()); assertThat(external.connected(local.id())).isEmpty();
    }
    @Test void staleOrDisabledAccountCannotLinkAndDisabledAccountCannotLogin() {
        var u=local(Role.USER); var s=sessions.open(u.id()); var p=principal("google");
        federation.link(u.id(),s.sessionId(),p); db.update("UPDATE user_sessions SET created_at=? WHERE id=?",java.sql.Timestamp.from(Instant.now().minusSeconds(301)),s.sessionId().toString());
        assertThatThrownBy(() -> federation.link(u.id(),s.sessionId(),principal("gitlab"))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> federation.unlink(u.id(),s.sessionId(),external.connected(u.id()).getFirst().id())).isInstanceOf(BusinessException.class);
        var access=identities.access(u.id()); identities.update(new UserAccess(u.id(),Role.USER,access.scopeId(),false,access.version()));
        assertThatThrownBy(() -> federation.login(p)).isInstanceOf(BusinessException.class);
    }
    @ParameterizedTest @CsvSource({"google,ADMIN","google,SUPERADMIN","gitlab,ADMIN","gitlab,SUPERADMIN"})
    void administratorsReceiveNoCredentialsUntilOwnMfaIsVerified(String provider,String role) throws Exception {
        var u=local(Role.valueOf(role)); var p=principal(provider);
        tx.required(() -> { external.lockFederation(); external.insert(new ExternalIdentity(UUID.randomUUID(),u.id(),p.provider(),p.issuer(),p.subject(),Instant.now())); return null; });
        var challenge=federation.login(p); assertThat(challenge.mfaRequired()).isTrue(); assertThat(challenge.accessToken()).isNull(); assertThat(challenge.refreshToken()).isNull();
        assertThat(repository.list(u.id())).isEmpty();
        mvc.perform(get("/api/v1/admin/users").header("Authorization","Bearer "+challenge.challengeToken())).andExpect(status().isUnauthorized());
        var enrollment=mfa.enrollChallenge(challenge.challengeToken()); var seed=enrollment.otpauthUri().split("secret=")[1].split("&")[0];
        var code=((AesTotpAdapter)totp).code(seed,Instant.now().getEpochSecond()/30,6);
        var confirmation=mfa.confirmChallenge(challenge.challengeToken(),code);
        mvc.perform(get("/api/v1/admin/users").header("Authorization","Bearer "+confirmation.session().accessToken())).andExpect(status().isOk());
        assertThat(repository.find(confirmation.session().sessionId()).orElseThrow().mfa(Instant.now())).isTrue();
        assertThat(sessions.refresh(confirmation.session().refreshToken()).accessToken()).isNotBlank();
    }
    @Test void externalTokensAndUnverifiedGoogleEmailAreRejected() throws Exception {
        success(start("google",UUID.randomUUID().toString(),UUID.randomUUID()+"@example.test",""));
        for(var token:List.of(PROVIDER.lastExternalToken,"external-access-never-siare")) mvc.perform(get("/api/v1/users/me").header("Authorization","Bearer "+token)).andExpect(status().isUnauthorized());
        complete(start("google",UUID.randomUUID().toString(),UUID.randomUUID()+"@example.test","unverified")).andExpect(status().isForbidden());
    }
    @Test void unavailableTokenEndpointFailsClosed() throws Exception {
        complete(start("google",UUID.randomUUID().toString(),UUID.randomUUID()+"@example.test","communication")).andExpect(status().isServiceUnavailable());
    }
    @Test void federatedUserCanEnrollAndManageMfaWithRecentPrimaryAndCannotBypassFactor() throws Exception {
        var p=principal("google"); var session=federation.login(p); UUID user=external.resolve(p.issuer(),p.subject()).orElseThrow().userId();
        assertThat(repository.find(session.sessionId()).orElseThrow().authenticationLevel()).isEqualTo("OIDC");
        var result=postJson("users/me/mfa/enroll",Map.of(),session.accessToken()).andExpect(status().isOk()).andReturn();
        String seed=json.readTree(result.getResponse().getContentAsString()).get("otpauthUri").asString().split("secret=")[1].split("&")[0];
        String code=((AesTotpAdapter)totp).code(seed,Instant.now().getEpochSecond()/30,6);
        var confirmed=mfa.confirm(user,code);
        assertThat(federation.login(p).mfaRequired()).isTrue();
        postJson("users/me/mfa/disable",Map.of("code","incorrect"),confirmed.session().accessToken()).andExpect(status().isUnauthorized());
        postJson("users/me/mfa/disable",Map.of("code",confirmed.recoveryCodes().getFirst()),confirmed.session().accessToken()).andExpect(status().isOk());
        assertThat(mfa.status(user).state()).isEqualTo("DISABLED");
    }
    @Test void localUserStillNeedsPasswordAndClosedRegistrationRejectsFederatedCreation() throws Exception {
        var u=local(Role.USER); var s=sessions.open(u.id());
        postJson("users/me/mfa/enroll",Map.of(),s.accessToken()).andExpect(status().isUnauthorized());
        db.update("UPDATE identity_parameters SET enabled=FALSE WHERE name='public_registration_enabled'");
        try { assertThatThrownBy(() -> federation.login(principal("google"))).isInstanceOf(BusinessException.class); }
        finally { db.update("UPDATE identity_parameters SET enabled=TRUE WHERE name='public_registration_enabled'"); }
    }
    @Test void closedRegistrationStillDirectsExistingEmailToAuthenticatedLinkAndAllowsLinkedLogin() throws Exception {
        var u=local(Role.USER); var linked=principal("google"); federation.link(u.id(),sessions.open(u.id()).sessionId(),linked);
        long before=db.queryForObject("SELECT COUNT(*) FROM users",Long.class);
        db.update("UPDATE identity_parameters SET enabled=FALSE WHERE name='public_registration_enabled'");
        try {
            complete(start("google",UUID.randomUUID().toString(),u.email(),"")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("OIDC_EMAIL_LINK_REQUIRED"));
            complete(start("google",UUID.randomUUID().toString(),UUID.randomUUID()+"@example.test","")).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("OIDC_REGISTRATION_CLOSED"));
            assertThat(federation.login(linked).accessToken()).isNotBlank();
            assertThat(db.queryForObject("SELECT COUNT(*) FROM users",Long.class)).isEqualTo(before);
        } finally { db.update("UPDATE identity_parameters SET enabled=TRUE WHERE name='public_registration_enabled'"); }
    }
    @ParameterizedTest @CsvSource({"unverified,true","unverified,false",",true",",false"})
    void gitlabWithoutUsableVerifiedContactGetsTechnicalEmailAndCanLoginAgain(String fault,boolean includeEmail) throws Exception {
        String subject=UUID.randomUUID().toString();
        var data=success(start("gitlab",subject,includeEmail?UUID.randomUUID()+"@example.test":null,fault==null?"":fault));
        UUID user=external.resolve(PROVIDER.issuer("gitlab"),subject).orElseThrow().userId();
        if(!includeEmail || "unverified".equals(fault)) assertThat(users.findById(user).orElseThrow().email()).endsWith("@federated.invalid");
        else assertThat(users.findById(user).orElseThrow().email()).endsWith("@example.test");
        success(start("gitlab",subject,null,"unverified"));
        assertThat(external.resolve(PROVIDER.issuer("gitlab"),subject).orElseThrow().userId()).isEqualTo(user);
        assertThat(data.get("accessToken").asString()).isNotBlank();
    }
    @Test void subjectIsScopedByIssuerAndEmailChangesDoNotMoveTheIdentity() throws Exception {
        String subject=UUID.randomUUID().toString();
        success(start("google",subject,UUID.randomUUID()+"@example.test",""));
        success(start("gitlab",subject,UUID.randomUUID()+"@example.test",""));
        var google=external.resolve(PROVIDER.issuer("google"),subject).orElseThrow();
        var gitlab=external.resolve(PROVIDER.issuer("gitlab"),subject).orElseThrow();
        assertThat(google.userId()).isNotEqualTo(gitlab.userId());
        success(start("gitlab",subject,users.findById(google.userId()).orElseThrow().email(),""));
        assertThat(external.resolve(PROVIDER.issuer("gitlab"),subject).orElseThrow().userId()).isEqualTo(gitlab.userId());
    }
    @Test void retiredMicrosoftCannotStartOrCompleteAndHistoricalIdentityIsPreserved() throws Exception {
        var u=local(Role.USER); UUID id=UUID.randomUUID();
        tx.required(() -> { external.lockFederation(); external.insert(new ExternalIdentity(id,u.id(),"microsoft","https://retired.example.test",UUID.randomUUID().toString(),Instant.now())); return null; });
        postJson("auth/oidc/start",Map.of("provider","microsoft","binding","X".repeat(43)),null).andExpect(status().isBadRequest());
        postJson("auth/oidc/complete",Map.of("provider","microsoft","binding","X".repeat(43),"state","X".repeat(43),"code","unused"),null).andExpect(status().isBadRequest());
        assertThat(external.connected(u.id())).anyMatch(e -> e.id().equals(id) && e.provider().equals("microsoft"));
    }
    @Test void missingCredentialsDisableProvidersIndependentlyAndRejectUnsafeIssuerAndRedirect() {
        var env=new MockEnvironment(); var providers=new OidcProviders(env);
        assertThat(providers.status()).allMatch(p -> !p.enabled());
        assertThatThrownBy(() -> providers.registration("google")).isInstanceOf(BusinessException.class);
        env.setProperty("siare.oidc.google.enabled","true"); assertThat(providers.enabled("google")).isFalse();
        env.setProperty("siare.oidc.google.client-id","test"); env.setProperty("siare.oidc.google.client-secret","test");
        assertThat(providers.enabled("google")).isTrue(); assertThat(providers.enabled("gitlab")).isFalse();
        env.setProperty("siare.oidc.gitlab.enabled","true"); env.setProperty("siare.oidc.gitlab.client-id","test"); env.setProperty("siare.oidc.gitlab.client-secret","test");
        assertThat(providers.enabled("gitlab")).isTrue();
        env.setProperty("siare.oidc.gitlab.issuer","https://gitlab.example.test");
        assertThatThrownBy(() -> providers.registration("gitlab")).isInstanceOf(OidcFailure.class)
            .extracting(e -> ((OidcFailure)e).code().name()).isEqualTo("OIDC_CONFIGURATION_INVALID");
        assertThat(providers.callback("gitlab")).isEqualTo("http://127.0.0.1:3100/api/oidc/callback/gitlab");
        assertThat(providers.enabled("microsoft")).isFalse();
        env.setProperty("siare.oidc.google.redirect-uri","https://evil.example"); assertThatThrownBy(() -> providers.callback("google")).isInstanceOf(IllegalStateException.class);
        env.setProperty("siare.oidc.app-origin","http://public.example"); assertThatThrownBy(() -> providers.callback("google")).isInstanceOf(IllegalStateException.class);
    }
}
