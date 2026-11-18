package com.siare.core;

import com.siare.core.application.port.in.SubjectUseCase;
import com.siare.core.application.port.out.*;
import com.siare.core.domain.document.*;
import com.siare.core.domain.subject.Subject;
import java.io.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(print = org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint.NONE)
@ActiveProfiles("test")
class DocumentApiTests {
    @Autowired MockMvc mvc;
    @Autowired JwtEncoder encoder;
    @Autowired DocumentRepository documents;
    @Autowired DocumentStorage storage;
    @MockitoBean SubjectUseCase subjects;
    UUID owner = UUID.randomUUID(), subject = UUID.randomUUID(), id = UUID.randomUUID();
    String token;
    DocumentMetadata document;
    @BeforeEach void setup() {
        reset(documents, storage);
        var now = Instant.now();
        token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(SignatureAlgorithm.RS256).build(),
                JwtClaimsSet.builder().issuer("siare-core").subject(owner.toString()).issuedAt(now).expiresAt(now.plusSeconds(300)).build())).getTokenValue();
        var matter = new Subject(subject, owner, "Ciencias", null, false, now, now);
        when(subjects.get(any(), eq(subject))).thenAnswer(call -> { matter.requireOwner(call.getArgument(0)); return matter; });
        document = new DocumentMetadata(id, subject, owner, "grid-id", "academic.pdf", "application/pdf", 3, "sha256", DocumentStatus.UPLOADED, now, null, null, null, null);
        when(documents.find(id)).thenReturn(Optional.of(document));
    }
    @Test void allSixDocumentEndpointsRequireJwt() throws Exception {
        mvc.perform(multipart("/api/v1/subjects/" + subject + "/documents").file("file", new byte[]{1})).andExpect(status().isUnauthorized());
        for (var path : List.of("subjects/" + subject + "/documents", "documents/" + id, "documents/" + id + "/download", "documents/" + id + "/text")) mvc.perform(get("/api/v1/" + path)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/documents/" + id + "/process")).andExpect(status().isUnauthorized());
    }
    @Test void validMultipartReturnsUploadedAndHidesStorageIdentifiers() throws Exception {
        when(storage.store(any(), anyString(), anyString())).thenReturn("grid-id");
        mvc.perform(multipart("/api/v1/subjects/" + subject + "/documents").file(new MockMultipartFile("file", "academic.pdf", "application/pdf", DocumentValidationTests.pdf(false))).header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("UPLOADED"))
                .andExpect(jsonPath("$.gridfsId").doesNotExist()).andExpect(jsonPath("$.ownerId").doesNotExist());
    }
    @Test void invalidUploadHasPhaseOneErrorShape() throws Exception {
        for (var file : new MockMultipartFile[]{new MockMultipartFile("file", "empty.pdf", "application/pdf", new byte[0]), new MockMultipartFile("file", "a.doc", "application/msword", new byte[]{1}), new MockMultipartFile("file", "a.pdf", "application/pdf", new byte[]{1,2,3})}) {
            int expected = file.isEmpty() ? 400 : file.getOriginalFilename().endsWith(".doc") ? 415 : 422;
            mvc.perform(multipart("/api/v1/subjects/" + subject + "/documents").file(file).header("Authorization", "Bearer " + token))
                    .andExpect(status().is(expected)).andExpect(jsonPath("$.timestamp").exists()).andExpect(jsonPath("$.code").exists()).andExpect(jsonPath("$.fields").exists());
        }
    }
    @Test void foreignStudentCannotReadDownloadProcessTextListOrUpload() throws Exception {
        var matter = new Subject(subject, UUID.randomUUID(), "Ajena", null, false, Instant.now(), Instant.now());
        when(subjects.get(any(), eq(subject))).thenAnswer(call -> { matter.requireOwner(call.getArgument(0)); return matter; });
        for (var suffix : List.of("", "/download", "/text")) mvc.perform(get("/api/v1/documents/" + id + suffix).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/documents/" + id + "/process").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/subjects/" + subject + "/documents").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        mvc.perform(multipart("/api/v1/subjects/" + subject + "/documents").file("file", new byte[]{1}).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        verifyNoInteractions(storage);
    }
    @Test void downloadIsAttachmentWithNoSniffAndExactBytes() throws Exception {
        when(storage.open("grid-id")).thenReturn(new ByteArrayInputStream(new byte[]{1,2,3}));
        mvc.perform(get("/api/v1/documents/" + id + "/download").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("attachment;"))).andExpect(content().bytes(new byte[]{1,2,3}));
    }
}
