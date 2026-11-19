package com.siare.core;

import com.siare.core.domain.document.DocumentException;
import com.siare.core.domain.document.DocumentType;
import com.siare.core.infrastructure.adapter.out.document.StructuralDocumentValidator;
import java.nio.file.Files;
import java.nio.file.Path;
import org.apache.pdfbox.Loader;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import static org.assertj.core.api.Assertions.*;

/** Opt-in local reproduction; the user's document is never committed as a fixture. */
@EnabledIfSystemProperty(named = "siare.test.pdf", matches = ".+")
class OriginalPdfValidationTests {
    @Test void originalManifestIsPreservedAndAdmittedWithoutCryptographicVerification() throws Exception {
        var path = Path.of(System.getProperty("siare.test.pdf"));
        try (var doc = Loader.loadPDF(path.toFile())) {
            assertThat(doc.isEncrypted()).isFalse();
            assertThat(doc.getNumberOfPages()).isEqualTo(13);
            var catalog = doc.getDocumentCatalog().getCOSObject();
            assertThat(catalog.getCOSDictionary(org.apache.pdfbox.cos.COSName.NAMES)
                    .containsKey(org.apache.pdfbox.cos.COSName.EMBEDDED_FILES)).isTrue();
        }
        try (var input = Files.newInputStream(path)) {
            new StructuralDocumentValidator(15L * 1024 * 1024).validateForStorage(input, DocumentType.PDF);
        }
        try (var input = Files.newInputStream(path)) { new StructuralDocumentValidator(15L * 1024 * 1024).validate(input, DocumentType.PDF); }
        assertThat(java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(path))))
                .isEqualTo("66cdd9f6cd895d4837cd68aa1208d89ca4bf4b9760e2c24e54cbf9e76815735e");
    }
}
