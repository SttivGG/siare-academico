package com.siare.core;

import com.siare.core.infrastructure.adapter.out.persistence.JpaSubjects;
import com.siare.core.infrastructure.adapter.out.persistence.JpaUsers;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(print = org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint.NONE)
@ActiveProfiles("test")
class PhaseOneApiTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JwtEncoder encoder;
    @Autowired JpaUsers users;
    @Autowired JpaSubjects subjects;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired com.siare.core.application.port.out.PasswordPort passwords;
    @Autowired java.security.KeyPair keys;
    private static final String PASSWORD = "Una clave segura 123!";

    @BeforeEach void cleanTestDatabase() { subjects.deleteAll(); users.deleteAll(); }

    private String register(String email) throws Exception {
        return mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(new Credentials("Estudiante", email, PASSWORD))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.password").doesNotExist()).andReturn().getResponse().getContentAsString();
    }
    private record Credentials(String name, String email, String password) {}
    private String login(String email) throws Exception {
        var response = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(java.util.Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(response).get("accessToken").asText();
    }
    private String account(String email) throws Exception { register(email); return login(email); }
    private String create(String token) throws Exception {
        var response = mvc.perform(post("/api/v1/subjects").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Matemáticas\",\"description\":\"Álgebra\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.archived").value(false))
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(response).get("id").asText();
    }

    @Test void registrationNormalizesEmailAndStoresBcryptOnly() throws Exception {
        var response = register("  ANA@Example.COM  ");
        assertThat(mapper.readTree(response).get("email").asText()).isEqualTo("ana@example.com");
        UUID.fromString(mapper.readTree(response).get("id").asText());
        assertThat(users.count()).isEqualTo(1);
        var stored = jdbc.queryForObject("SELECT password_hash FROM users WHERE email = ?", String.class, "ana@example.com");
        assertThat(stored != null && stored.startsWith("$2a$12$")).isTrue();
        assertThat(PASSWORD.equals(stored)).isFalse();
        assertThat(passwords.matches(PASSWORD, stored)).isTrue();
        assertThat(login("ana@example.com")).isNotBlank();
    }
    @Test void duplicateNormalizedEmailIsConflict() throws Exception {
        register("ana@example.com");
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Otra\",\"email\":\" ANA@EXAMPLE.COM \",\"password\":\"Otra clave segura\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_EMAIL"));
    }
    @Test void invalidFieldsAndMalformedJsonAreBadRequests() throws Exception {
        for (var body : new String[]{"{}", "{", "{\"name\":\" \",\"email\":\"no-email\",\"password\":\"short\"}",
                "{\"name\":\"Ana\",\"email\":\"no-email\",\"password\":\"Una clave segura\"}"}) {
            mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.status").value(400));
        }
    }
    @Test void bcryptByteLimitRejectsMultibytePasswords() throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(new Credentials("Ana", "ana@example.com", "é".repeat(40)))))
                .andExpect(status().isBadRequest());
    }
    @Test void loginAndMeUseRealSignedToken() throws Exception {
        var token = account("ana@example.com");
        assertThat(mapper.readTree(java.util.Base64.getUrlDecoder().decode(token.split("\\.")[0])).get("alg").asText()).isEqualTo("RS256");
        mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.email").value("ana@example.com"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }
    @Test void wrongPasswordAndUnknownAccountAreUnauthorized() throws Exception {
        register("ana@example.com");
        for (var email : new String[]{"ana@example.com", "unknown@example.com"}) {
            mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + email + "\",\"password\":\"wrong\"}"))
                    .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        }
    }
    @Test void privateRoutesRequireAuthentication() throws Exception {
        mvc.perform(get("/api/v1/users/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/subjects")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/subjects").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }
    @Test void invalidExpiredWrongIssuerMissingExpiryAndTamperedTokensAreRejected() throws Exception {
        var now = Instant.now();
        var valid = account("ana@example.com");
        var expired = signed("siare-core", now.minusSeconds(300), now.minusSeconds(120), UUID.randomUUID().toString());
        var wrongIssuer = signed("untrusted", now, now.plusSeconds(300), UUID.randomUUID().toString());
        var missingExpiry = signed("siare-core", now, null, UUID.randomUUID().toString());
        var badSubject = signed("siare-core", now, now.plusSeconds(300), "invalid");
        var parts = valid.split("\\.");
        var tampered = parts[0] + "." + parts[1] + "." + (parts[2].startsWith("A") ? "B" : "A") + parts[2].substring(1);
        var unsigned = "eyJhbGciOiJub25lIn0." + parts[1] + ".";
        for (var token : new String[]{"invalid", expired, wrongIssuer, missingExpiry, badSubject, tampered, unsigned}) {
            mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + token))
                    .andExpect(status().isUnauthorized());
        }
    }
    private String signed(String issuer, Instant issued, Instant expiry, String subject) {
        var claims = JwtClaimsSet.builder().issuer(issuer).subject(subject).issuedAt(issued);
        if (expiry != null) claims.expiresAt(expiry);
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(SignatureAlgorithm.RS256).build(), claims.build())).getTokenValue();
    }
    @Test void signedTokenUsingAnotherRsaAlgorithmIsRejected() throws Exception {
        var claims = new com.nimbusds.jwt.JWTClaimsSet.Builder().issuer("siare-core")
                .subject(UUID.randomUUID().toString()).issueTime(java.util.Date.from(Instant.now()))
                .expirationTime(java.util.Date.from(Instant.now().plusSeconds(300))).build();
        var token = new com.nimbusds.jwt.SignedJWT(new com.nimbusds.jose.JWSHeader(com.nimbusds.jose.JWSAlgorithm.RS512), claims);
        token.sign(new com.nimbusds.jose.crypto.RSASSASigner(keys.getPrivate()));
        mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + token.serialize()))
                .andExpect(status().isUnauthorized());
    }
    @Test void createAndListOnlyOwnSubjects() throws Exception {
        var ana = account("ana@example.com");
        var bob = account("bob@example.com");
        var id = create(ana);
        create(bob);
        mvc.perform(get("/api/v1/subjects").header("Authorization", "Bearer " + ana))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(id));
    }
    @Test void otherStudentCannotReadUpdateOrArchiveEvenWithUuid() throws Exception {
        var ana = account("ana@example.com");
        var bob = account("bob@example.com");
        var id = create(ana);
        mvc.perform(get("/api/v1/subjects/" + id).header("Authorization", "Bearer " + bob)).andExpect(status().isForbidden());
        mvc.perform(patch("/api/v1/subjects/" + id).header("Authorization", "Bearer " + bob)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Intrusión\"}")).andExpect(status().isForbidden());
        mvc.perform(patch("/api/v1/subjects/" + id + "/archive").header("Authorization", "Bearer " + bob)).andExpect(status().isForbidden());
    }
    @Test void updateSupportsPartialChangesAndExplicitDescriptionRemoval() throws Exception {
        var token = account("ana@example.com");
        var path = "/api/v1/subjects/" + create(token);
        mvc.perform(patch(path).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Física\"}")).andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Física")).andExpect(jsonPath("$.description").value("Álgebra"));
        mvc.perform(patch(path).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":null}")).andExpect(status().isOk()).andExpect(jsonPath("$.description").isEmpty());
        for (var body : new String[]{"{}", "{\"name\":null}", "{\"name\":\"   \"}", "{\"userId\":\"injected\"}"}) {
            mvc.perform(patch(path).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
    }
    @Test void archiveIsPersistentIdempotentAndDisablesEditing() throws Exception {
        var token = account("ana@example.com");
        var path = "/api/v1/subjects/" + create(token);
        for (int i = 0; i < 2; i++) {
            mvc.perform(patch(path + "/archive").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.archived").value(true));
        }
        mvc.perform(get(path).header("Authorization", "Bearer " + token)).andExpect(jsonPath("$.archived").value(true));
        assertThat(subjects.count()).isEqualTo(1);
        mvc.perform(patch(path).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Cambio\"}")).andExpect(status().isBadRequest());
    }
    @Test void missingSubjectAndMalformedUuidHaveCorrectStatus() throws Exception {
        var token = account("ana@example.com");
        mvc.perform(get("/api/v1/subjects/" + UUID.randomUUID()).header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/subjects/not-a-uuid").header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }
}
