package com.siare.core.application.service;

import com.siare.core.application.port.in.*;
import com.siare.core.application.port.out.*;
import com.siare.core.domain.activity.ActivityBank;
import com.siare.core.domain.draft.*;
import com.siare.core.domain.draft.AcademicDraft.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;

public final class AcademicDraftService implements AcademicDraftUseCase {
    private final GenerateAcademicDraftService generation;
    private final AcademicDraftRepository drafts;
    private final ActivityUseCase activities;
    private final TransactionPort tx;
    private final Clock clock;
    public AcademicDraftService(GenerateAcademicDraftService generation, AcademicDraftRepository drafts,
            ActivityUseCase activities, TransactionPort tx, Clock clock) {
        this.generation = generation; this.drafts = drafts; this.activities = activities; this.tx = tx; this.clock = clock;
    }
    @Override public View create(UUID owner, UUID subject, Selection selection) {
        var generated = generation.generateCaptured(owner, subject, selection);
        var now = clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        var d = new StoredAcademicDraft(UUID.randomUUID(), owner, subject, selection, generated.fingerprint(),
                generated.response(), 1, now, now, now.plus(Duration.ofHours(24)), null, null, null);
        return tx.required(() -> {
            generation.authorize(owner, subject);
            if (!drafts.lockActiveSubject(owner, subject)) throw failure(409, "SUBJECT_ARCHIVED");
            current(d); drafts.insert(d); return view(d);
        });
    }
    @Override public View get(UUID owner, UUID id) { var d = owned(owner, id, false); available(d); return view(d); }
    @Override public View revise(UUID owner, UUID id, int expected, Bank bank) {
        revisionInput(expected);
        return tx.required(() -> {
            var d = owned(owner, id, false); available(d); expected(d, expected);
            validate(current(d), bank);
            if (expected == 2147483646) throw failure(409, "DRAFT_REVISION_CONFLICT");
            var edited = d.edited(bank, clock.instant()); available(edited);
            if (!drafts.updateRevision(edited, expected)) throw failure(409, "DRAFT_REVISION_CONFLICT");
            return view(edited);
        });
    }
    @Override public Publication publish(UUID owner, UUID id, int expected, Boolean confirmed, UUID key) {
        revisionInput(expected);
        // Authorization precedes status or idempotency disclosure, including expired replay.
        var initial = owned(owner, id, false);
        if (!Boolean.TRUE.equals(confirmed)) throw failure(400, "REVIEW_REQUIRED");
        if (key == null) throw failure(400, "INVALID_DRAFT_REQUEST");
        String fingerprint = publicationFingerprint(id, expected);
        return tx.required(() -> {
            // Lock order is identity, subject, draft; same identity order as account mutations.
            generation.lockIdentity(owner);
            boolean active = drafts.lockActiveSubject(owner, initial.subject());
            var d = owned(owner, id, true);
            if (d.activityId() != null) {
                if (!key.equals(d.publicationKey())) throw published(d);
                if (!fingerprint.equals(d.publicationFingerprint())) throw failure(409, "IDEMPOTENCY_CONFLICT");
                return new Publication(activities.get(owner, d.activityId()), true);
            }
            if (!active) throw failure(409, "SUBJECT_ARCHIVED");
            available(d); expected(d, expected);
            validate(current(d), d.response().draft());
            var saved = activities.create(owner, d.subject(), d.selection().type(), d.selection().documentId(),
                    d.selection().topic(), toBank(d.response().draft()), d.selection().count(), d.selection().gridSize());
            // Mongo cannot enlist in this MySQL transaction. Detect observed changes and roll back H3.
            current(d); available(d);
            if (!drafts.markPublished(id, expected, key, fingerprint, saved.activityId(), clock.instant()))
                throw failure(409, "DRAFT_REVISION_CONFLICT");
            return new Publication(saved, false);
        });
    }
    private StoredAcademicDraft owned(UUID owner, UUID id, boolean lock) {
        if (owner == null) throw failure(401, "UNAUTHORIZED");
        var d = drafts.find(id, lock).orElseThrow(() -> failure(404, "NOT_FOUND"));
        if (!owner.equals(d.owner())) throw failure(403, "FORBIDDEN");
        // Archived subjects can still recover a previously committed publication.
        try { generation.authorize(owner, d.subject()); }
        catch (DraftGenerationException ex) { if (!"SUBJECT_ARCHIVED".equals(ex.code())) throw ex; }
        return d;
    }
    private Request current(StoredAcademicDraft d) {
        var s = d.selection();
        var snapshot = generation.snapshot(d.owner(), d.subject(), s.documentId());
        if (!s.extractionVersion().equals("operation:" + snapshot.metadata().operationId())
                || !d.extractionFingerprint().equals(snapshot.fingerprint())) throw failure(409, "EXTRACTION_CHANGED");
        var fragments = new ArrayList<Fragment>();
        for (int index : s.fragmentIndexes().stream().sorted().toList()) {
            var f = snapshot.content().fragments().stream().filter(item -> item.index() == index).findFirst()
                    .orElseThrow(() -> failure(409, "EXTRACTION_CHANGED"));
            fragments.add(new Fragment(f.index(), DraftEvidence.reference(f.unitType(), f.unitNumber()), f.unitType(), f.unitNumber(), f.text()));
        }
        return new Request(1, d.response().requestId(), s.documentId(), s.extractionVersion(), s.type(), s.topic(), s.count(),
                s.gridSize(), "es", snapshot.content().warnings(), fragments);
    }
    private void validate(Request request, Bank bank) {
        try { DraftEvidence.bank(request, bank); }
        catch (DraftGenerationException | NullPointerException | IllegalArgumentException ex) { throw failure(422, "INVALID_DRAFT_CONTENT"); }
    }
    private void available(StoredAcademicDraft d) {
        if (d.activityId() != null) throw published(d);
        if (!clock.instant().isBefore(d.expiresAt())) throw failure(410, "DRAFT_EXPIRED");
    }
    private void expected(StoredAcademicDraft d, int expected) { if (d.revision() != expected) throw failure(409, "DRAFT_REVISION_CONFLICT"); }
    private void revisionInput(int expected) { if (expected < 1 || expected > 2147483646) throw failure(400, "INVALID_DRAFT_REQUEST"); }
    private DraftLifecycleException published(StoredAcademicDraft d) { return new DraftLifecycleException(409, "DRAFT_ALREADY_PUBLISHED", d.activityId()); }
    private static DraftLifecycleException failure(int status, String code) { return new DraftLifecycleException(status, code); }
    private View view(StoredAcademicDraft d) {
        var s = d.selection(); var r = d.response();
        // Claims always refer to original revision 1. A later revision has no ML quality declaration.
        return new View(d.id(), d.subject(), s.documentId(), s.extractionVersion(), s.type(), s.topic(), s.count(), s.gridSize(),
                d.revision(), d.expiresAt(), "AWAITING_REVIEW", r.draft(), r.quality(), 1, r.warnings(), r.generatorVersion());
    }
    private ActivityBank.Source source(Source s) { return new ActivityBank.Source(s.reference(), s.fragmentIndex(), s.quote()); }
    private ActivityBank toBank(Bank draft) {
        return new ActivityBank(true, draft.questions().stream().map(q -> new ActivityBank.Question(q.id(), q.prompt(),
                q.options().stream().map(o -> new ActivityBank.Option(o.id(), o.text())).toList(), q.correctOptionId(), q.topic(), source(q.source()), q.explanation())).toList(),
                draft.words().stream().map(w -> new ActivityBank.Word(w.id(), w.answer(), w.clue(), w.topic(), source(w.source()))).toList());
    }
    private String publicationFingerprint(UUID id, int revision) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((id + ":" + revision + ":true").getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException ex) { throw new IllegalStateException("Publication fingerprint unavailable"); }
    }
}
