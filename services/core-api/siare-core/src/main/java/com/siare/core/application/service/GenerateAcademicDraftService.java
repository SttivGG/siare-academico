package com.siare.core.application.service;

import com.siare.core.application.port.in.*;
import com.siare.core.application.port.out.*;
import com.siare.core.domain.draft.AcademicDraft.*;
import com.siare.core.domain.draft.DraftGenerationException;
import com.siare.core.domain.document.*;
import java.io.*;
import java.security.*;
import java.util.*;

public final class GenerateAcademicDraftService implements GenerateAcademicDraftUseCase {
    private record Snapshot(DocumentMetadata metadata, ExtractedContent content, String fingerprint) {}
    private final IdentityRepository identities;
    private final SubjectUseCase subjects;
    private final DocumentRepository documents;
    private final AcademicDraftGenerator generator;
    private final DraftAdmission admission;

    public GenerateAcademicDraftService(IdentityRepository identities, SubjectUseCase subjects, DocumentRepository documents,
                                       AcademicDraftGenerator generator, DraftAdmission admission) {
        this.identities = identities; this.subjects = subjects; this.documents = documents;
        this.generator = generator; this.admission = admission;
    }
    @Override public Response generate(UUID owner, UUID subject, Selection selection) {
        authorize(owner, subject);
        if (selection == null || selection.documentId() == null || selection.fragmentIndexes() == null
                || selection.fragmentIndexes().isEmpty() || selection.fragmentIndexes().size() > 32
                || new HashSet<>(selection.fragmentIndexes()).size() != selection.fragmentIndexes().size())
            throw new DraftGenerationException(400, "INVALID_DRAFT_REQUEST");
        Snapshot before = snapshot(owner, subject, selection.documentId());
        if (!version(before.metadata()).equals(selection.extractionVersion())) throw changed();
        var selected = new ArrayList<Fragment>();
        for (int index : selection.fragmentIndexes().stream().sorted().toList()) {
            var fragment = before.content().fragments().stream().filter(f -> f.index() == index).findFirst()
                    .orElseThrow(() -> new DraftGenerationException(400, "INVALID_DRAFT_REQUEST"));
            if (fragment.text() == null || fragment.text().isBlank()) throw new DraftGenerationException(422, "INSUFFICIENT_CONTENT");
            selected.add(new Fragment(index, DraftEvidence.reference(fragment.unitType(), fragment.unitNumber()),
                    fragment.unitType(), fragment.unitNumber(), fragment.text()));
        }
        if (selected.stream().mapToInt(f -> f.text().length()).sum() > 100_000) throw new DraftGenerationException(413, "PAYLOAD_TOO_LARGE");
        var request = new Request(1, UUID.randomUUID(), selection.documentId(), selection.extractionVersion(), selection.type(),
                selection.topic(), selection.count(), selection.gridSize(), "es", before.content().warnings(), selected);
        try { DraftEvidence.request(request); }
        catch (DraftGenerationException error) { throw new DraftGenerationException(400, "INVALID_DRAFT_REQUEST"); }
        try (var lease = admission.acquire(owner)) {
            Response result = generator.generate(request);
            DraftEvidence.response(request, result);
            authorize(owner, subject);
            Snapshot after;
            try { after = snapshot(owner, subject, selection.documentId()); }
            catch (DraftGenerationException error) {
                if (error.status() == 403 || error.status() == 401) throw error;
                throw changed();
            }
            if (!before.fingerprint().equals(after.fingerprint())) throw changed();
            return result;
        }
    }
    private void authorize(UUID owner, UUID subject) {
        if (owner == null) throw new DraftGenerationException(401, "UNAUTHORIZED");
        var access = identities.access(owner);
        if (access == null || !owner.equals(access.userId()) || !access.enabled()) throw new DraftGenerationException(403, "FORBIDDEN");
        var found = subjects.get(owner, subject);
        if (!owner.equals(found.userId())) throw new DraftGenerationException(403, "FORBIDDEN");
        if (found.archived()) throw new DraftGenerationException(409, "SUBJECT_ARCHIVED");
    }
    private Snapshot snapshot(UUID owner, UUID subject, UUID id) {
        var metadata = documents.find(id).orElseThrow(() -> new DraftGenerationException(404, "NOT_FOUND"));
        if (!owner.equals(metadata.ownerId()) || !subject.equals(metadata.subjectId())) throw new DraftGenerationException(403, "FORBIDDEN");
        if (metadata.status() != DocumentStatus.READY || metadata.operationId() == null) throw new DraftGenerationException(409, "TEXT_NOT_READY");
        var content = documents.content(id, metadata.operationId()).orElseThrow(GenerateAcademicDraftService::changed);
        if (!"READY".equals(content.extractionStatus()) || content.text() == null || content.text().isBlank()
                || content.fragments() == null || content.fragments().isEmpty() || content.warnings() == null)
            throw new DraftGenerationException(422, "INSUFFICIENT_CONTENT");
        content = new ExtractedContent(content.fileType(), content.text(), List.copyOf(content.fragments()), content.unitCount(),
                List.copyOf(content.warnings()), content.extractionStatus());
        var current = documents.find(id).orElseThrow(GenerateAcademicDraftService::changed);
        if (!metadata.equals(current)) throw changed();
        return new Snapshot(metadata, content, fingerprint(metadata, content));
    }
    private static String version(DocumentMetadata metadata) { return "operation:" + metadata.operationId(); }
    private static String fingerprint(DocumentMetadata metadata, ExtractedContent content) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            try (var out = new DataOutputStream(new DigestOutputStream(OutputStream.nullOutputStream(), digest))) {
                write(out, metadata.toString()); write(out, content.fileType()); write(out, content.text());
                out.writeInt(content.unitCount()); write(out, content.extractionStatus());
                out.writeInt(content.fragments().size());
                for (var f : content.fragments()) { out.writeInt(f.index()); write(out, f.unitType()); out.writeInt(f.unitNumber()); write(out, f.text()); }
                out.writeInt(content.warnings().size()); for (String warning : content.warnings()) write(out, warning);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (IOException | NoSuchAlgorithmException error) { throw new IllegalStateException("Snapshot fingerprint unavailable"); }
    }
    private static void write(DataOutputStream out, String value) throws IOException {
        if (value == null) { out.writeInt(-1); return; }
        byte[] bytes = value.getBytes(java.nio.charset.StandardCharsets.UTF_8); out.writeInt(bytes.length); out.write(bytes);
    }
    private static DraftGenerationException changed() { return new DraftGenerationException(409, "EXTRACTION_CHANGED"); }
}
