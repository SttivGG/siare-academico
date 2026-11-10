package com.siare.core;

import com.siare.core.domain.document.*;
import com.siare.core.infrastructure.adapter.out.document.StructuralDocumentValidator;
import java.io.*;
import java.awt.image.BufferedImage;
import java.util.zip.*;
import javax.imageio.ImageIO;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.encryption.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class DocumentValidationTests {
    StructuralDocumentValidator validator = new StructuralDocumentValidator(15 * 1024 * 1024);
    static byte[] pdf(boolean encrypted) throws IOException {
        try (var doc = new PDDocument(); var output = new ByteArrayOutputStream()) {
            doc.addPage(new PDPage());
            if (encrypted) doc.protect(new StandardProtectionPolicy("owner", "fixture", new AccessPermission()));
            doc.save(output); return output.toByteArray();
        }
    }
    @Test void realPdfAndImagesAreAcceptedAndMimeSpoofingIsRejected() throws Exception {
        validator.validate(new ByteArrayInputStream(pdf(false)), DocumentType.PDF);
        for (var type : new DocumentType[]{DocumentType.PNG, DocumentType.JPEG}) {
            var output = new ByteArrayOutputStream();
            ImageIO.write(new BufferedImage(20, 20, BufferedImage.TYPE_INT_RGB), type == DocumentType.PNG ? "png" : "jpeg", output);
            validator.validate(new ByteArrayInputStream(output.toByteArray()), type);
            assertThatThrownBy(() -> validator.validate(new ByteArrayInputStream(output.toByteArray()), DocumentType.PDF)).isInstanceOf(DocumentException.class);
        }
    }
    @Test void protectedCorruptAndOversizedActualBytesAreRejected() throws Exception {
        assertThatThrownBy(() -> validator.validate(new ByteArrayInputStream(pdf(true)), DocumentType.PDF)).isInstanceOfSatisfying(DocumentException.class, e -> assertThat(e.code()).isEqualTo("PASSWORD_PROTECTED"));
        assertThatThrownBy(() -> validator.validate(new ByteArrayInputStream("%PDF-corrupt".getBytes()), DocumentType.PDF)).isInstanceOf(DocumentException.class);
        assertThatThrownBy(() -> new StructuralDocumentValidator(2).validate(new ByteArrayInputStream(new byte[3]), DocumentType.PDF)).isInstanceOfSatisfying(DocumentException.class, e -> assertThat(e.status()).isEqualTo(413));
    }
    @Test void officeBombTraversalMalformedAndActiveContentAreRejected() throws Exception {
        for (String name : new String[]{"../escape.xml", "word/vbaProject.bin", "word/document.xml", "word/bomb.xml"}) {
            var output = new ByteArrayOutputStream();
            try (var zip = new ZipOutputStream(output)) {
                zip.putNextEntry(new ZipEntry(name)); zip.write((name.contains("bomb") ? "a".repeat(1_000_000) : "<broken").getBytes()); zip.closeEntry();
                for (String other : new String[]{"a", "b"}) { zip.putNextEntry(new ZipEntry(other)); zip.write(1); zip.closeEntry(); }
            }
            assertThatThrownBy(() -> validator.validate(new ByteArrayInputStream(output.toByteArray()), DocumentType.DOCX)).isInstanceOf(DocumentException.class);
        }
    }
    @Test void officeTypesAndRootRelationshipsAreVerified() throws Exception {
        for (var type : new DocumentType[]{DocumentType.DOCX, DocumentType.PPTX}) {
            String main = type == DocumentType.DOCX ? "word/document.xml" : "ppt/presentation.xml";
            String ns = type == DocumentType.DOCX ? "wordprocessingml" : "presentationml";
            String root = type == DocumentType.DOCX ? "document" : "presentation";
            String mime = type == DocumentType.DOCX ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
                    : "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml";
            var parts = new java.util.LinkedHashMap<String, String>();
            parts.put(main, "<" + root + " xmlns=\"http://schemas.openxmlformats.org/" + ns + "/2006/main\"/>");
            parts.put("[Content_Types].xml", "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Override PartName=\"/" + main + "\" ContentType=\"" + mime + "\"/></Types>");
            parts.put("_rels/.rels", "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"r1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"" + main + "\"/></Relationships>");
            var output = new ByteArrayOutputStream();
            try (var zip = new ZipOutputStream(output)) {
                for (var part : parts.entrySet()) { zip.putNextEntry(new ZipEntry(part.getKey())); zip.write(part.getValue().getBytes(java.nio.charset.StandardCharsets.UTF_8)); zip.closeEntry(); }
            }
            validator.validate(new ByteArrayInputStream(output.toByteArray()), type);
            var other = type == DocumentType.DOCX ? DocumentType.PPTX : DocumentType.DOCX;
            assertThatThrownBy(() -> validator.validate(new ByteArrayInputStream(output.toByteArray()), other)).isInstanceOf(DocumentException.class);
        }
    }
}
