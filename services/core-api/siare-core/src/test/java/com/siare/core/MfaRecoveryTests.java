package com.siare.core;

import com.siare.core.application.port.in.*;
import com.siare.core.application.port.out.*;
import com.siare.core.application.service.*;
import com.siare.core.domain.account.*;
import com.siare.core.domain.identity.*;
import com.siare.core.domain.identity.Role;
import com.siare.core.infrastructure.adapter.out.security.AesTotpAdapter;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.boot.webmvc.test.autoconfigure.*;
import org.springframework.context.annotation.*;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(print=MockMvcPrint.NONE)
@ActiveProfiles("test")
@Import(MfaRecoveryTests.Configuration.class)
class MfaRecoveryTests {
    static final String PASSWORD="Mis factores protegen los apuntes del bosque";
    static class TestClock extends Clock {
        volatile Instant now=Instant.now();
        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
        void advance(long seconds) { now=now.plusSeconds(seconds); }
    }
    static class CapturedMail implements SecurityMailPort {
        record Message(String recipient,String token) { @Override public String toString() { return "Message[REDACTED]"; } }
        final BlockingQueue<Message> requests=new LinkedBlockingQueue<>();
        final BlockingQueue<String> notifications=new LinkedBlockingQueue<>();
        @Override public void passwordReset(String recipient,String token) { requests.add(new Message(recipient,token)); }
        @Override public void passwordChanged(String recipient) { notifications.add(recipient); }
    }
    @TestConfiguration(proxyBeanMethods=false)
    static class Configuration {
        @Bean @Primary TestClock testClock() { return new TestClock(); }
        @Bean @Primary CapturedMail capturedMail() { return new CapturedMail(); }
    }
    @Autowired MfaService mfa;
    @Autowired PasswordResetService resets;
    @Autowired AccountUseCase accounts;
    @Autowired UserRepository users;
    @Autowired IdentityRepository identities;
    @Autowired SessionRepository repository;
    @Autowired MfaRepository factors;
    @Autowired PasswordPort passwords;
    @Autowired TotpPort totp;
    @Autowired TestClock clock;
    @Autowired CapturedMail mail;
    @Autowired SessionService sessions;
    @Autowired JdbcTemplate db;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired ExecutorService securityMailExecutor;
    @BeforeEach void resetCounters() throws Exception {
        securityMailExecutor.submit(() -> {}).get(10,TimeUnit.SECONDS);
        clock.now=Instant.now(); db.update("DELETE FROM login_attempts"); mail.requests.clear(); mail.notifications.clear();
    }
    private User user(Role role) {
        var id=UUID.randomUUID(); var u=users.save(new User(id,"Prueba MFA",id+"@example.test",passwords.hash(PASSWORD),clock.instant()));
        if(role!=Role.USER) { var a=identities.access(id); identities.update(new UserAccess(id,role,a.scopeId(),true,a.version())); }
        return u;
    }
    private String seed(EnrollMfaUseCase.Enrollment e) { return e.otpauthUri().split("secret=")[1].split("&")[0]; }
    private String code(String seed) { return ((AesTotpAdapter)totp).code(seed,clock.instant().getEpochSecond()/30,6); }
    private record Enrolled(User user,String seed,ConfirmMfaUseCase.Confirmation result) {}
    private Enrolled enroll(Role role) {
        var user=user(role);
        if(role==Role.USER) {
            var e=mfa.enroll(user.id(),PASSWORD,null);
            return new Enrolled(user,seed(e),mfa.confirm(user.id(),code(seed(e))));
        }
        var challenge=accounts.login(user.email(),PASSWORD);
        var e=mfa.enrollChallenge(challenge.challengeToken());
        return new Enrolled(user,seed(e),mfa.confirmChallenge(challenge.challengeToken(),code(seed(e))));
    }
    private ResultActions postJson(String path,Object body,String token) throws Exception {
        var request=post("/api/v1/"+path).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        if(token!=null) request.header("Authorization","Bearer "+token);
        return mvc.perform(request);
    }
    private void invalid(Runnable work) { assertThatThrownBy(work::run).isInstanceOf(BusinessException.class); }
    @Test void pendingEnrollmentDoesNotEnableMfaAndIsEncryptedAndNeverReturnedByStatus() throws Exception {
        var user=user(Role.USER); var e=mfa.enroll(user.id(),PASSWORD,null);
        var c=factors.credential(user.id()).orElseThrow();
        assertThat(c.activeSecret()).isNull(); assertThat(c.pendingSecret()).startsWith("v1.").doesNotContain(seed(e));
        assertThat(totp.decrypt(user.id(),c.pendingSecret())).isEqualTo(seed(e));
        assertThat(mfa.status(user.id()).state()).isEqualTo("PENDING");
        assertThat(json.writeValueAsString(mfa.status(user.id()))).doesNotContain(seed(e),"Secret","otpauth");
        invalid(() -> mfa.confirm(user.id(),"abcdef")); assertThat(mfa.status(user.id()).state()).isEqualTo("PENDING");
        clock.advance(601); invalid(() -> mfa.confirm(user.id(),code(seed(e)))); assertThat(mfa.status(user.id()).state()).isEqualTo("DISABLED");
    }
    @Test void validActivationIssuesMfaSessionAndTenHashedRecoveryCodesAndRevokesOldSessions() {
        var user=user(Role.USER); var old=sessions.open(user.id()); var e=mfa.enroll(user.id(),PASSWORD,null);
        var confirmed=mfa.confirm(user.id(),code(seed(e)));
        assertThat(confirmed.recoveryCodes()).hasSize(10).doesNotHaveDuplicates();
        assertThat(repository.find(confirmed.session().sessionId()).orElseThrow().authenticationLevel()).isEqualTo("MFA");
        assertThat(repository.find(old.sessionId()).orElseThrow().revokedAt()).isNotNull();
        assertThat(factors.credential(user.id()).orElseThrow().pendingSecret()).isNull();
        var hashes=db.queryForList("SELECT code_hash FROM mfa_recovery_codes WHERE user_id=?",String.class,user.id().toString());
        assertThat(hashes).hasSize(10).allMatch(h -> h.matches("[a-f0-9]{64}"));
        assertThat(hashes).doesNotContainAnyElementsOf(confirmed.recoveryCodes());
    }
    @Test void incorrectExpiredAndReplayedTotpAreRejected() {
        var e=enroll(Role.USER); var challenge=accounts.login(e.user.email(),PASSWORD).challengeToken();
        db.update("DELETE FROM login_attempts");
        invalid(() -> mfa.verify(challenge,code(e.seed)));
        invalid(() -> mfa.verify(challenge,"abcdef"));
        String old=code(e.seed); clock.advance(90); invalid(() -> mfa.verify(challenge,old));
        var verified=mfa.verify(challenge,code(e.seed)); assertThat(verified.accessToken()).isNotBlank();
        invalid(() -> mfa.verify(challenge,code(e.seed)));
    }
    @Test void challengeExpiresAndNeverCreatesSessionBeforeSecondFactor() {
        var e=enroll(Role.ADMIN); var challenge=accounts.login(e.user.email(),PASSWORD);
        assertThat(challenge.accessToken()).isNull(); assertThat(challenge.refreshToken()).isNull();
        clock.advance(301); invalid(() -> mfa.verify(challenge.challengeToken(),code(e.seed)));
    }
    @Test void smallWindowAcceptsAdjacentStepButRecordsItToPreventReuse() {
        var e=enroll(Role.USER); clock.advance(30);
        var challenge=accounts.login(e.user.email(),PASSWORD).challengeToken();
        var future=((AesTotpAdapter)totp).code(e.seed,clock.instant().getEpochSecond()/30+1,6);
        assertThat(mfa.verify(challenge,future).accessToken()).isNotNull();
        var another=accounts.login(e.user.email(),PASSWORD).challengeToken(); clock.advance(30);
        invalid(() -> mfa.verify(another,code(e.seed)));
    }
    @Test void excessiveAttemptsRemainBlockedEvenWithNewChallenge() {
        var e=enroll(Role.USER); var challenge=accounts.login(e.user.email(),PASSWORD).challengeToken();
        db.update("DELETE FROM login_attempts");
        for(int i=0;i<5;i++) invalid(() -> mfa.verify(challenge,"wrong"));
        assertThatThrownBy(() -> mfa.verify(challenge,code(e.seed))).isInstanceOfSatisfying(BusinessException.class,ex -> assertThat(ex.kind()).isEqualTo(BusinessException.Kind.RATE_LIMITED));
        var next=accounts.login(e.user.email(),PASSWORD).challengeToken();
        assertThatThrownBy(() -> mfa.verify(next,code(e.seed))).isInstanceOfSatisfying(BusinessException.class,ex -> assertThat(ex.kind()).isEqualTo(BusinessException.Kind.RATE_LIMITED));
        assertThat(db.queryForObject("SELECT attempts FROM mfa_challenges WHERE token_hash=?",Integer.class,SessionService.fingerprint(challenge))).isEqualTo(5);
    }
    @Test void adminAndSuperadminWithoutFactorReceiveOnlyLimitedChallengeAndCannotRefresh() throws Exception {
        for(var role:List.of(Role.ADMIN,Role.SUPERADMIN)) {
            var user=user(role); var result=accounts.login(user.email(),PASSWORD);
            assertThat(result.mfaRequired()).isTrue(); assertThat(result.enrollmentRequired()).isTrue();
            assertThat(repository.list(user.id())).isEmpty(); invalid(() -> sessions.open(user.id()));
            mvc.perform(get("/api/v1/admin/users").header("Authorization","Bearer "+result.challengeToken())).andExpect(status().isUnauthorized());
            invalid(() -> sessions.refresh(result.challengeToken()));
        }
    }
    @Test void actualAdminMfaSessionHasScopeAndCannotCrossScopeOrElevateRoles() throws Exception {
        var e=enroll(Role.ADMIN); String token=e.result.session().accessToken(); var foreign=user(Role.USER);
        var scope=identities.createScope("Otro ámbito "+UUID.randomUUID()); var access=identities.access(foreign.id());
        identities.update(new UserAccess(foreign.id(),Role.USER,scope.id(),true,access.version()));
        mvc.perform(get("/api/v1/admin/users").header("Authorization","Bearer "+token)).andExpect(status().isOk());
        postJson("admin/scopes",Map.of("name","Prohibido"),token).andExpect(status().isForbidden());
        mvc.perform(patch("/api/v1/admin/users/"+foreign.id()+"/access").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("role","USER","scopeId",scope.id(),"enabled",false,"version",1)))).andExpect(status().isForbidden());
        var own=user(Role.USER);
        mvc.perform(patch("/api/v1/admin/users/"+own.id()+"/access").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("role","USER","scopeId",AdministrativeScope.COMMUNITY,"enabled",false,"version",0)))).andExpect(status().isOk());
    }
    @Test void superadminBootstrapEnrollmentGrantsOnlyExistingAuthorizedPermissions() throws Exception {
        var e=enroll(Role.SUPERADMIN); String token=e.result.session().accessToken();
        mvc.perform(get("/api/v1/admin/audit").header("Authorization","Bearer "+token)).andExpect(status().isOk());
        postJson("admin/scopes",Map.of("name","MFA ámbito "+UUID.randomUUID()),token).andExpect(status().isCreated());
        invalid(() -> mfa.disable(e.user.id(),PASSWORD,e.result.recoveryCodes().getFirst()));
    }
    @Test void userWithMfaStillHasNoAdministrativePermissions() throws Exception {
        var e=enroll(Role.USER);
        mvc.perform(get("/api/v1/admin/users").header("Authorization","Bearer "+e.result.session().accessToken())).andExpect(status().isForbidden());
    }
    @Test void refreshPreservesMfaDeadlineAndCannotElevatePasswordSession() {
        var e=enroll(Role.ADMIN); var before=repository.find(e.result.session().sessionId()).orElseThrow();
        var renewed=sessions.refresh(e.result.session().refreshToken());
        assertThat(repository.find(renewed.sessionId()).orElseThrow().mfaExpiresAt()).isEqualTo(before.mfaExpiresAt());
        clock.advance(12*3600-60); repository.touch(renewed.sessionId(),clock.instant(),clock.instant().plusSeconds(1800));
        clock.advance(61); invalid(() -> sessions.refresh(renewed.refreshToken())); assertThat(sessions.validate(e.user.id(),renewed.sessionId())).isFalse();
        clock.now=Instant.now(); var user=user(Role.USER); var session=sessions.open(user.id()); var access=identities.access(user.id());
        identities.update(new UserAccess(user.id(),Role.ADMIN,access.scopeId(),true,access.version()));
        invalid(() -> sessions.refresh(session.refreshToken())); assertThat(sessions.validate(user.id(),session.sessionId())).isFalse();
    }
    @Test void recoveryCodeIsSingleUseAndRequiresPasswordChallengeIncludingSuperadmin() {
        var e=enroll(Role.SUPERADMIN); var challenge=accounts.login(e.user.email(),PASSWORD).challengeToken(); String recovery=e.result.recoveryCodes().getFirst();
        invalid(() -> mfa.recover("invalid",recovery));
        var result=mfa.recover(challenge,recovery); assertThat(result.accessToken()).isNotBlank();
        assertThat(repository.find(e.result.session().sessionId()).orElseThrow().revokedAt()).isNotNull();
        assertThat(mfa.status(e.user.id()).recoveryCodesRemaining()).isEqualTo(9);
        var next=accounts.login(e.user.email(),PASSWORD).challengeToken(); invalid(() -> mfa.recover(next,recovery));
    }
    @Test void replacementPreservesActiveFactorUntilNewProofAndInvalidatesOldCodesAndSessions() {
        var e=enroll(Role.USER); String recovery=e.result.recoveryCodes().getFirst();
        invalid(() -> mfa.enroll(e.user.id(),"wrong",recovery));
        var next=mfa.enroll(e.user.id(),PASSWORD,recovery);
        assertThat(totp.decrypt(e.user.id(),factors.credential(e.user.id()).orElseThrow().activeSecret())).isEqualTo(e.seed);
        var result=mfa.confirm(e.user.id(),code(seed(next)));
        assertThat(result.recoveryCodes()).doesNotContainAnyElementsOf(e.result.recoveryCodes());
        assertThat(repository.find(e.result.session().sessionId()).orElseThrow().revokedAt()).isNotNull();
        assertThat(totp.decrypt(e.user.id(),factors.credential(e.user.id()).orElseThrow().activeSecret())).isEqualTo(seed(next));
    }
    @Test void regenerationRequiresStrongReauthenticationAndInvalidatesExistingCodes() {
        var e=enroll(Role.USER);
        invalid(() -> mfa.regenerate(e.user.id(),PASSWORD,"wrong"));
        var codes=mfa.regenerate(e.user.id(),PASSWORD,e.result.recoveryCodes().getFirst());
        assertThat(codes).hasSize(10).doesNotContainAnyElementsOf(e.result.recoveryCodes());
        assertThat(repository.find(e.result.session().sessionId()).orElseThrow().revokedAt()).isNotNull();
    }
    @Test void userCanDisableOnlyWithStrongReauthentication() {
        var e=enroll(Role.USER); invalid(() -> mfa.disable(e.user.id(),PASSWORD,"wrong"));
        mfa.disable(e.user.id(),PASSWORD,e.result.recoveryCodes().getFirst());
        assertThat(mfa.status(e.user.id()).state()).isEqualTo("DISABLED"); assertThat(mfa.status(e.user.id()).recoveryCodesRemaining()).isZero();
        assertThat(repository.find(e.result.session().sessionId()).orElseThrow().revokedAt()).isNotNull();
    }
    @Test void concurrentTotpVerificationHasExactlyOneWinnerForSameChallenge() throws Exception {
        var e=enroll(Role.USER); clock.advance(30); var challenge=accounts.login(e.user.email(),PASSWORD).challengeToken();
        var results=race(() -> mfa.verify(challenge,code(e.seed))); assertThat(results).containsExactlyInAnyOrder(true,false);
    }
    @Test void concurrentRecoveryCannotConsumeCodeTwice() throws Exception {
        var e=enroll(Role.USER); var challenge=accounts.login(e.user.email(),PASSWORD).challengeToken();
        assertThat(race(() -> mfa.recover(challenge,e.result.recoveryCodes().getFirst()))).containsExactlyInAnyOrder(true,false);
        assertThat(mfa.status(e.user.id()).recoveryCodesRemaining()).isEqualTo(9);
    }
    @Test void concurrentActivationIssuesOnlyOneSetOfCodesAndOneSession() throws Exception {
        var user=user(Role.USER); var enrollment=mfa.enroll(user.id(),PASSWORD,null); String code=code(seed(enrollment));
        assertThat(race(() -> mfa.confirm(user.id(),code))).containsExactlyInAnyOrder(true,false);
        assertThat(factors.remainingRecovery(user.id())).isEqualTo(10);
        assertThat(repository.list(user.id()).stream().filter(s -> s.active(clock.instant())).count()).isEqualTo(1);
    }
    @Test void clientCannotAssertMfaOrRequestPrivilegedSessionThroughLoginFlags() throws Exception {
        var user=user(Role.ADMIN);
        postJson("auth/login",Map.of("email",user.email(),"password",PASSWORD,"mfaVerified",true),null).andExpect(status().isBadRequest());
        assertThat(repository.list(user.id())).isEmpty();
    }
    @Test void passwordResetUsesH2aPolicyAndLeavesTokenUsableAfterWeakPasswordRejection() throws Exception {
        var user=user(Role.USER); var message=requestReset(user);
        invalid(() -> resets.complete(message.token(),"short"));
        invalid(() -> resets.complete(message.token(),"passwordpassword"));
        resets.complete(message.token(),PASSWORD+" nueva");
        assertThat(users.findById(user.id()).orElseThrow().passwordHash()).startsWith("$argon2id$");
    }
    @Test void publicResetEndpointsNeverReturnTokenOrSessionAndRevokePriorBearer() throws Exception {
        var user=user(Role.USER); var old=sessions.open(user.id());
        var requested=postJson("auth/password-reset/request",Map.of("email",user.email()),null).andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString();
        var message=mail.requests.poll(5,TimeUnit.SECONDS); assertThat(message).isNotNull();
        assertThat(requested).doesNotContain(message.token(),"token","accessToken");
        postJson("auth/password-reset/complete",Map.of("token",message.token(),"password",PASSWORD+" nueva"),null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").doesNotExist()).andExpect(jsonPath("$.accessToken").doesNotExist());
        mvc.perform(get("/api/v1/users/me").header("Authorization","Bearer "+old.accessToken())).andExpect(status().isUnauthorized());
        postJson("auth/password-reset/complete",Map.of("token",message.token(),"password",PASSWORD+" otra"),null).andExpect(status().isUnauthorized());
    }
    @Test void exhaustedResetTokenDoesNotLockOutAnUnrelatedAccount() throws Exception {
        var first=user(Role.USER); var second=user(Role.USER);
        var a=requestReset(first); var b=requestReset(second);
        for(int i=0;i<5;i++) invalid(() -> resets.complete(a.token(),"short"));
        assertThatThrownBy(() -> resets.complete(a.token(),PASSWORD+" nueva")).isInstanceOfSatisfying(BusinessException.class,
                ex -> assertThat(ex.kind()).isEqualTo(BusinessException.Kind.RATE_LIMITED));
        resets.complete(b.token(),PASSWORD+" nueva");
        assertThat(passwords.matches(PASSWORD+" nueva",users.findById(second.id()).orElseThrow().passwordHash())).isTrue();
    }
    private List<Boolean> race(Callable<?> work) throws Exception {
        var barrier=new CyclicBarrier(2);
        try(var executor=Executors.newFixedThreadPool(2)) {
            Callable<Boolean> task=() -> { barrier.await(5,TimeUnit.SECONDS); try { work.call(); return true; } catch(BusinessException ex) { return false; } };
            var a=executor.submit(task); var b=executor.submit(task); return List.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS));
        }
    }
    private CapturedMail.Message requestReset(User user) throws Exception {
        resets.request(user.email()); var message=mail.requests.poll(5,TimeUnit.SECONDS); assertThat(message).isNotNull(); return message;
    }
    @Test void resetRequestIsGenericForExistingMissingAndRateLimitedAccountsAndStoresOnlyHash() throws Exception {
        var user=user(Role.USER); var message=requestReset(user);
        assertThat(message.recipient()).isEqualTo(user.email());
        assertThat(db.queryForObject("SELECT COUNT(*) FROM password_reset_tokens WHERE token_hash=?",Integer.class,SessionService.fingerprint(message.token()))).isEqualTo(1);
        String expected=postJson("auth/password-reset/request",Map.of("email",UUID.randomUUID()+"@example.test"),null).andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();
        for(int i=0;i<7;i++) assertThat(postJson("auth/password-reset/request",Map.of("email",user.email()),null).andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString()).isEqualTo(expected);
    }
    @Test void resetRejectsInvalidExpiredAndReusedTokens() throws Exception {
        var user=user(Role.USER); var message=requestReset(user); clock.advance(901);
        invalid(() -> resets.complete(message.token(),PASSWORD+" nueva")); invalid(() -> resets.complete("invalid",PASSWORD));
        db.update("DELETE FROM login_attempts"); var next=requestReset(user);
        resets.complete(next.token(),PASSWORD+" nueva"); invalid(() -> resets.complete(next.token(),PASSWORD+" otra"));
    }
    @Test void passwordResetRevokesSessionsAndChallengesPreservesActiveMfaAndNotifies() throws Exception {
        var e=enroll(Role.SUPERADMIN); String active=factors.credential(e.user.id()).orElseThrow().activeSecret();
        var challenge=accounts.login(e.user.email(),PASSWORD).challengeToken(); var message=requestReset(e.user);
        resets.complete(message.token(),PASSWORD+" cambiada");
        assertThat(mail.notifications.poll(5,TimeUnit.SECONDS)).isEqualTo(e.user.email());
        assertThat(passwords.matches(PASSWORD+" cambiada",users.findById(e.user.id()).orElseThrow().passwordHash())).isTrue();
        assertThat(repository.find(e.result.session().sessionId()).orElseThrow().revokedAt()).isNotNull();
        assertThat(factors.credential(e.user.id()).orElseThrow().activeSecret()).isEqualTo(active);
        invalid(() -> mfa.recover(challenge,e.result.recoveryCodes().getFirst()));
        assertThat(accounts.login(e.user.email(),PASSWORD+" cambiada").mfaRequired()).isTrue();
    }
    @Test void concurrentPasswordResetHasExactlyOneWinner() throws Exception {
        var user=user(Role.USER); var message=requestReset(user);
        assertThat(race(() -> { resets.complete(message.token(),PASSWORD+" nueva"); return true; })).containsExactlyInAnyOrder(true,false);
    }
    @Test void criticalOperationsAreAuditedWithoutSeedsOrBearerValues() {
        var e=enroll(Role.USER); var challenge=accounts.login(e.user.email(),PASSWORD).challengeToken(); invalid(() -> mfa.verify(challenge,"wrong"));
        mfa.recover(challenge,e.result.recoveryCodes().getFirst());
        var events=db.queryForList("SELECT operation FROM audit_events WHERE actor_id=?",String.class,e.user.id().toString());
        assertThat(events).contains("MFA_ENROLL","MFA_CONFIRMED","MFA_VERIFY","MFA_RECOVERY_USED");
        assertThat(db.queryForList("SELECT resource FROM audit_events WHERE actor_id=?",String.class,e.user.id().toString()))
                .allMatch(resource -> !resource.contains(e.seed) && !resource.contains(challenge));
    }
    @Test void rfc6238PublishedTestVectorAndAuthenticatedEncryptionBindOwnerAndRejectTampering() {
        // RFC Appendix B public test vector, not a deployed credential.
        String publicSeed="GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
        assertThat(((AesTotpAdapter)totp).code(publicSeed,59/30,8)).isEqualTo("94287082");
        assertThat(((AesTotpAdapter)totp).code(publicSeed,1111111109L/30,8)).isEqualTo("07081804");
        var user=UUID.randomUUID(); String encrypted=totp.encrypt(user,totp.generateSecret());
        assertThatThrownBy(() -> totp.decrypt(UUID.randomUUID(),encrypted)).isInstanceOf(IllegalStateException.class);
        char changed=encrypted.charAt(10)=='A'?'B':'A'; String corrupted=encrypted.substring(0,10)+changed+encrypted.substring(11);
        assertThatThrownBy(() -> totp.decrypt(user,corrupted)).isInstanceOf(IllegalStateException.class);
    }
}
