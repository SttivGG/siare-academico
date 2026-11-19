package com.siare.core;

import com.mongodb.client.*;
import com.siare.core.application.port.out.*;
import com.siare.core.infrastructure.adapter.out.document.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.HexFormat;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.*;
import static com.mongodb.client.model.Filters.*;

/** Dedicated internal Docker network and disposable Mongo only; no production credentials.
 * Keeps the real HTTP Spring server available while Playwright exercises upload/process/text.
 */
@EnabledIfEnvironmentVariable(named = "SIARE_DOCUMENT_BROWSER", matches = "1")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT,
        properties = {"server.port=8080", "siare.documents.service-token=synthetic-document-service-token-64-characters-for-tests-only"})
@ActiveProfiles("test")
@Import(DocumentBrowserIntegrationTests.RealDocuments.class)
class DocumentBrowserIntegrationTests {
    @Test void browserUsesRealGridFsAndPersistsExactOriginal() throws Exception {
        var signal = Path.of("/scratch/browser.done");
        var deadline = java.time.Instant.now().plusSeconds(900);
        System.out.println("DOCUMENT_BROWSER_SERVER_READY");
        while (!Files.exists(signal) && java.time.Instant.now().isBefore(deadline)) Thread.sleep(500);
        assertThat(signal).exists();
        try (var client = MongoClients.create("mongodb://mongo:27017")) {
            var database = client.getDatabase("siare_document_test");
            var original = database.getCollection("document_metadata").find(and(eq("status", "READY"),
                    eq("originalFilename", "Guia_Estudio_MongoDB_Aggregate_Solucionario.pdf"))).first();
            assertThat(original).isNotNull();
            assertThat(original.getInteger("unitCount")).isEqualTo(13);
            assertThat(original.getList("warnings", String.class)).contains("PROVENANCE_UNVERIFIED", "ASSOCIATED_FILES_IGNORED");
            var bucket = com.mongodb.client.gridfs.GridFSBuckets.create(database);
            try (var stream = bucket.openDownloadStream(new org.bson.types.ObjectId(original.getString("gridfsId")))) {
                assertThat(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(stream.readAllBytes())))
                        .isEqualTo("66cdd9f6cd895d4837cd68aa1208d89ca4bf4b9760e2c24e54cbf9e76815735e");
            }
            assertThat(database.getCollection("document_fragments").countDocuments(eq("documentId", original.getString("_id")))).isGreaterThan(0);
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class RealDocuments {
        @Bean(destroyMethod = "close") MongoClient integrationMongoClient() { return MongoClients.create("mongodb://mongo:27017"); }
        @Bean MongoTemplate integrationMongo(MongoClient client) { return new MongoTemplate(client, "siare_document_test"); }
        @Bean(initMethod = "ensureIndexes") @Primary MongoDocumentRepository integrationDocumentRepository(MongoTemplate mongo) { return new MongoDocumentRepository(mongo); }
        @Bean @Primary DocumentStorage integrationDocumentStorage(MongoTemplate mongo) {
            return new GridFsDocumentStorage(new GridFsTemplate(mongo.getMongoDatabaseFactory(), mongo.getConverter()));
        }
        @Bean @Primary DocumentProcessor integrationDocumentProcessor(ObjectMapper mapper) {
            return new HttpDocumentProcessor("http://content-ai:5000", "synthetic-document-service-token-64-characters-for-tests-only", mapper);
        }
    }
}
