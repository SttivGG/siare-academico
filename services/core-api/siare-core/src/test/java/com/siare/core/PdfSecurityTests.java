package com.siare.core;

import com.siare.core.domain.document.*;
import com.siare.core.infrastructure.adapter.out.document.StructuralDocumentValidator;
import java.io.*;
import java.util.function.Consumer;
import org.apache.pdfbox.cos.*;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDStream;
import org.apache.pdfbox.pdmodel.encryption.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class PdfSecurityTests {
    private final StructuralDocumentValidator validator = new StructuralDocumentValidator(15L * 1024 * 1024);
    static byte[] fixture(Consumer<PDDocument> change) throws IOException {
        try (var doc = new PDDocument(); var out = new ByteArrayOutputStream()) {
            doc.addPage(new PDPage()); change.accept(doc); doc.save(out); return out.toByteArray();
        }
    }
    static void attachment(PDDocument doc, boolean provenance, int size) {
        try {
            var stream = new PDStream(doc, new ByteArrayInputStream(new byte[size])).getCOSObject();
            stream.setItem(COSName.TYPE, COSName.getPDFName("EmbeddedFile"));
            stream.setName(COSName.SUBTYPE, provenance ? "application/c2pa" : "application/octet-stream");
            var spec = new COSDictionary(); spec.setName(COSName.TYPE, "Filespec");
            spec.setString(COSName.F, provenance ? "Content Credentials" : "payload.exe");
            spec.setString(COSName.SUBTYPE, provenance ? "application/c2pa" : "application/octet-stream");
            spec.setName(COSName.getPDFName("AFRelationship"), provenance ? "C2PA_Manifest" : "Data");
            var ef = new COSDictionary(); ef.setItem(COSName.F, stream); spec.setItem(COSName.EF, ef);
            var values = new COSArray(); values.add(new COSString("Content Credentials")); values.add(spec);
            var tree = new COSDictionary(); tree.setItem(COSName.NAMES, values);
            var names = new COSDictionary(); names.setItem(COSName.EMBEDDED_FILES, tree);
            var catalog = doc.getDocumentCatalog().getCOSObject(); catalog.setItem(COSName.NAMES, names);
            var af = new COSArray(); af.add(spec); catalog.setItem(COSName.getPDFName("AF"), af);
        } catch (IOException error) { throw new UncheckedIOException(error); }
    }
    private void rejects(byte[] bytes, String code) {
        assertThatThrownBy(() -> validator.validate(new ByteArrayInputStream(bytes), DocumentType.PDF))
                .isInstanceOfSatisfying(DocumentException.class, error -> assertThat(error.code()).isEqualTo(code));
    }
    @Test void normalPdfAndExactObservedByteLimitAreAccepted() throws Exception {
        byte[] bytes = fixture(doc -> {});
        new StructuralDocumentValidator(bytes.length).validate(new ByteArrayInputStream(bytes), DocumentType.PDF);
        assertThatThrownBy(() -> new StructuralDocumentValidator(bytes.length - 1).validate(new ByteArrayInputStream(bytes), DocumentType.PDF))
                .isInstanceOfSatisfying(DocumentException.class, error -> assertThat(error.code()).isEqualTo("FILE_TOO_LARGE"));
    }
    @Test void c2paLabelsAreNeverAcceptedAsCryptographicVerification() throws Exception {
        // Deliberately fake content with the expected PDF labels: this MUST NOT become an allowlist.
        rejects(fixture(doc -> attachment(doc, true, 32)), "ATTACHMENTS_NOT_ALLOWED");
        rejects(fixture(doc -> attachment(doc, true, 256 * 1024 + 1)), "ATTACHMENTS_NOT_ALLOWED");
        rejects(fixture(doc -> attachment(doc, false, 32)), "ATTACHMENTS_NOT_ALLOWED");
    }
    @Test void alternateAttachmentLocationsAndMultipleFilesAreRejected() throws Exception {
        rejects(fixture(doc -> {
            attachment(doc, true, 32);
            doc.getDocumentCatalog().getCOSObject().removeItem(COSName.NAMES);
        }), "ATTACHMENTS_NOT_ALLOWED");
        rejects(fixture(doc -> {
            attachment(doc, true, 32);
            var second = new COSDictionary(); second.setName(COSName.TYPE, "Filespec"); second.setString(COSName.F, "evil.exe");
            doc.getDocumentCatalog().getCOSObject().setItem(COSName.getPDFName("Other"), second);
        }), "ATTACHMENTS_NOT_ALLOWED");
        for (String marker : new String[]{"EF", "AF", "EmbeddedFiles"})
            rejects(fixture(doc -> doc.getDocumentCatalog().getCOSObject().setItem(COSName.getPDFName(marker), new COSDictionary())), "ATTACHMENTS_NOT_ALLOWED");
        rejects(fixture(doc -> doc.getDocumentCatalog().getCOSObject().setName(COSName.SUBTYPE, "FileAttachment")), "ATTACHMENTS_NOT_ALLOWED");
        rejects(fixture(doc -> doc.getDocumentCatalog().getCOSObject().setName(COSName.TYPE, "EmbeddedFile")), "ATTACHMENTS_NOT_ALLOWED");
    }
    @Test void scriptsActionsAndRichMediaStayBlockedEvenBesideProvenance() throws Exception {
        for (String key : new String[]{"JS", "JavaScript", "OpenAction", "AA", "Launch", "XFA", "RichMedia", "RichMediaContent"})
            rejects(fixture(doc -> {
                attachment(doc, true, 32);
                doc.getDocumentCatalog().getCOSObject().setString(COSName.getPDFName(key), "blocked");
            }), "ACTIVE_CONTENT");
        for (String action : new String[]{"JavaScript", "Launch", "SubmitForm", "ImportData", "GoToR"})
            rejects(fixture(doc -> doc.getDocumentCatalog().getCOSObject().setName(COSName.S, action)), "ACTIVE_CONTENT");
    }
    @Test void encryptedEvenWithEmptyUserPasswordCorruptAndOversizedPdfsStayBlocked() throws Exception {
        rejects(fixture(doc -> {
            try { doc.protect(new StandardProtectionPolicy("owner", "", new AccessPermission())); }
            catch (IOException error) { throw new UncheckedIOException(error); }
        }), "PASSWORD_PROTECTED");
        rejects("%PDF-corrupt".getBytes(java.nio.charset.StandardCharsets.US_ASCII), "CORRUPT_DOCUMENT");
        rejects(new byte[15 * 1024 * 1024 + 1], "FILE_TOO_LARGE");
    }
    @Test void compressedPageBombAndPageCountLimitStayBlocked() throws Exception {
        rejects(fixture(doc -> {
            try { doc.getPage(0).setContents(new PDStream(doc, new ByteArrayInputStream(new byte[8 * 1024 * 1024 + 1]), COSName.FLATE_DECODE)); }
            catch (IOException error) { throw new UncheckedIOException(error); }
        }), "DOCUMENT_LIMIT_EXCEEDED");
        rejects(fixture(doc -> { for (int i = 0; i < 500; i++) doc.addPage(new PDPage()); }), "DOCUMENT_LIMIT_EXCEEDED");
    }
}
