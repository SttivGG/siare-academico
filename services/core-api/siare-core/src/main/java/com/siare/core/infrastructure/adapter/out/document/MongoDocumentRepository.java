package com.siare.core.infrastructure.adapter.out.document;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.*;
import com.siare.core.application.port.out.DocumentRepository;
import com.siare.core.domain.document.*;
import java.time.Instant;
import java.util.*;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.springframework.data.mongodb.core.MongoTemplate;
import static com.mongodb.client.model.Filters.*;
import static com.mongodb.client.model.Updates.*;

public final class MongoDocumentRepository implements DocumentRepository {
    private final MongoCollection<Document> metadata;
    private final MongoCollection<Document> fragments;
    public MongoDocumentRepository(MongoTemplate mongo) {
        metadata = mongo.getCollection("document_metadata");
        fragments = mongo.getCollection("document_fragments");
    }
    public void ensureIndexes() {
        metadata.createIndex(Indexes.compoundIndex(Indexes.ascending("ownerId", "subjectId"), Indexes.descending("createdAt", "_id")));
        metadata.createIndex(Indexes.compoundIndex(Indexes.ascending("status", "leaseUntil")));
        fragments.createIndex(Indexes.ascending("documentId", "operationId", "index"), new IndexOptions().unique(true));
    }
    @Override public void insert(DocumentMetadata m) {
        metadata.insertOne(new Document("_id", m.documentId().toString()).append("documentId", m.documentId().toString())
                .append("subjectId", m.subjectId().toString()).append("ownerId", m.ownerId().toString()).append("gridfsId", m.gridfsId())
                .append("originalFilename", m.originalFilename()).append("contentType", m.contentType()).append("sizeBytes", m.sizeBytes())
                .append("checksum", m.checksum()).append("status", m.status().name()).append("createdAt", Date.from(m.createdAt())));
    }
    private static UUID uuid(Document d, String key) { return d.getString(key) == null ? null : UUID.fromString(d.getString(key)); }
    private static Instant instant(Document d, String key) { return d.getDate(key) == null ? null : d.getDate(key).toInstant(); }
    private static DocumentMetadata map(Document d) {
        return new DocumentMetadata(uuid(d, "_id"), uuid(d, "subjectId"), uuid(d, "ownerId"), d.getString("gridfsId"),
                d.getString("originalFilename"), d.getString("contentType"), d.getLong("sizeBytes"), d.getString("checksum"),
                DocumentStatus.valueOf(d.getString("status")), instant(d, "createdAt"), instant(d, "processedAt"),
                d.getString("errorCode"), uuid(d, "operationId"), instant(d, "leaseUntil"));
    }
    @Override public Optional<DocumentMetadata> find(UUID id) { return Optional.ofNullable(metadata.find(eq("_id", id.toString())).first()).map(MongoDocumentRepository::map); }
    @Override public List<DocumentMetadata> list(UUID owner, UUID subject) {
        return metadata.find(and(eq("ownerId", owner.toString()), eq("subjectId", subject.toString())))
                .sort(Sorts.descending("createdAt", "_id")).map(MongoDocumentRepository::map).into(new ArrayList<>());
    }
    @Override public Optional<DocumentMetadata> claim(UUID id, UUID operation, Instant now, Instant leaseUntil) {
        var filter = and(eq("_id", id.toString()), ne("operationId", operation.toString()),
                or(in("status", "UPLOADED", "FAILED"), and(eq("status", "PROCESSING"), lte("leaseUntil", Date.from(now)))));
        var update = combine(set("status", "PROCESSING"), set("operationId", operation.toString()), set("leaseUntil", Date.from(leaseUntil)), unset("errorCode"), unset("processedAt"));
        return Optional.ofNullable(metadata.findOneAndUpdate(filter, update, new FindOneAndUpdateOptions().returnDocument(ReturnDocument.AFTER)))
                .map(MongoDocumentRepository::map);
    }
    private Bson reserved(UUID id, UUID operation) { return and(eq("_id", id.toString()), eq("operationId", operation.toString()), eq("status", "PROCESSING")); }
    @Override public boolean complete(UUID id, UUID operation, ExtractedContent content, Instant now) {
        var rows = content.fragments().stream().map(f -> new Document("documentId", id.toString()).append("operationId", operation.toString())
                .append("index", f.index()).append("unitType", f.unitType()).append("unitNumber", f.unitNumber()).append("text", f.text())).toList();
        try {
            if (!rows.isEmpty()) fragments.insertMany(rows);
            var updated = metadata.updateOne(reserved(id, operation), combine(set("status", "READY"), set("processedAt", Date.from(now)),
                    unset("leaseUntil"), unset("errorCode"), set("fileType", content.fileType()), set("unitCount", content.unitCount()),
                    set("warnings", content.warnings()), set("extractionStatus", content.extractionStatus())));
            if (updated.getModifiedCount() == 0) {
                fragments.deleteMany(and(eq("documentId", id.toString()), eq("operationId", operation.toString()))); return false;
            }
        } catch (RuntimeException error) {
            // A lost update acknowledgement may already have published READY. Keep these rows;
            // a later successful retry cleans unreferenced operation namespaces safely.
            throw error;
        }
        // Cleanup is best effort after publishing READY: a cleanup error must never delete the current text.
        try { fragments.deleteMany(and(eq("documentId", id.toString()), ne("operationId", operation.toString()))); }
        catch (RuntimeException ignored) { /* Unreferenced older operation fragments can be cleaned later. */ }
        return true;
    }
    @Override public void fail(UUID id, UUID operation, String code, Instant now) {
        metadata.updateOne(reserved(id, operation), combine(set("status", "FAILED"), set("errorCode", code), set("processedAt", Date.from(now)), unset("leaseUntil")));
    }
    @Override public Optional<ExtractedContent> content(UUID id, UUID operation) {
        var m = metadata.find(and(eq("_id", id.toString()), eq("operationId", operation.toString()), eq("status", "READY"))).first();
        if (m == null) return Optional.empty();
        var parts = fragments.find(and(eq("documentId", id.toString()), eq("operationId", operation.toString())))
                .sort(Sorts.ascending("index")).map(d -> new ExtractedContent.Fragment(d.getInteger("index"), d.getString("unitType"), d.getInteger("unitNumber"), d.getString("text"))).into(new ArrayList<>());
        return Optional.of(new ExtractedContent(m.getString("fileType"), String.join("\n\n", parts.stream().map(ExtractedContent.Fragment::text).toList()),
                parts, m.getInteger("unitCount"), m.getList("warnings", String.class), m.getString("extractionStatus")));
    }
}
