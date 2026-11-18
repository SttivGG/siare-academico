package com.siare.core.infrastructure.adapter.out.document;

import com.siare.core.application.port.out.DocumentValidator;
import com.siare.core.domain.document.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.zip.*;
import javax.imageio.ImageIO;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.w3c.dom.Element;
import org.xml.sax.InputSource;

/** No renderer, macro interpreter, external XML entities, or external resource fetches. */
public final class StructuralDocumentValidator implements DocumentValidator {
    private final long maximum;
    public StructuralDocumentValidator(long maximum) { this.maximum = maximum; }
    private static DocumentException corrupt() { return new DocumentException(422, "CORRUPT_DOCUMENT", "El documento está corrupto o su estructura no corresponde al formato indicado."); }
    private static DocumentException unsafe() { return new DocumentException(422, "UNSAFE_DOCUMENT", "El documento contiene contenido activo o una expansión comprimida no permitida."); }
    @Override public void validate(InputStream source, DocumentType type) {
        Path temporary = null;
        try {
            temporary = Files.createTempFile("siare-validate-", ".bin");
            try (var output = Files.newOutputStream(temporary)) {
                byte[] buffer = new byte[8192]; int count; long actual = 0;
                while ((count = source.read(buffer)) != -1) {
                    actual += count;
                    if (actual > maximum) throw new DocumentException(413, "FILE_TOO_LARGE", "El archivo supera el límite permitido.");
                    output.write(buffer, 0, count);
                }
            }
            switch (type) {
                case PDF -> pdf(temporary);
                case DOCX, PPTX -> office(temporary, type);
                case JPEG, PNG -> image(temporary, type);
            }
        } catch (DocumentException error) { throw error; }
        catch (InvalidPasswordException error) { throw new DocumentException(422, "PASSWORD_PROTECTED", "No se admiten documentos protegidos con contraseña."); }
        catch (Exception error) { throw corrupt(); }
        finally { if (temporary != null) try { Files.deleteIfExists(temporary); } catch (IOException ignored) { /* OS temp cleanup */ } }
    }
    private void pdf(Path file) throws IOException {
        try (var input = Files.newInputStream(file)) {
            if (!Arrays.equals(input.readNBytes(5), "%PDF-".getBytes(java.nio.charset.StandardCharsets.US_ASCII))) throw corrupt();
        }
        try (var doc = Loader.loadPDF(file.toFile())) {
            if (doc.isEncrypted()) throw new DocumentException(422, "PASSWORD_PROTECTED", "No se admiten documentos protegidos con contraseña.");
            if (doc.getNumberOfPages() < 1 || doc.getNumberOfPages() > 500) throw unsafe();
            // Inspect all parsed dictionaries without resolving or executing actions.
            int objects = 0;
            Set<org.apache.pdfbox.cos.COSBase> visited = Collections.newSetFromMap(new IdentityHashMap<>());
            for (var keyObject : doc.getDocument().getXrefTable().keySet()) {
                if (++objects > 100_000) throw unsafe();
                var base = doc.getDocument().getObjectFromPool(keyObject).getObject();
                inspectPdf(base, visited, 0);
            }
            long expanded = 0;
            for (var page : doc.getPages()) {
                if (page.getMediaBox() == null) throw corrupt();
                try (var stream = page.getContents()) {
                    byte[] buffer = new byte[8192]; int count; long pageSize = 0;
                    while ((count = stream.read(buffer)) != -1) {
                        pageSize += count; expanded += count;
                        if (pageSize > 8L * 1024 * 1024 || expanded > 48L * 1024 * 1024) throw unsafe();
                    }
                }
            }
        }
    }
    private void inspectPdf(org.apache.pdfbox.cos.COSBase base, Set<org.apache.pdfbox.cos.COSBase> visited, int depth) {
        if (base == null || !visited.add(base)) return;
        if (depth > 100 || visited.size() > 200_000) throw unsafe();
        if (base instanceof org.apache.pdfbox.cos.COSObject object) inspectPdf(object.getObject(), visited, depth + 1);
        else if (base instanceof org.apache.pdfbox.cos.COSArray array) {
            for (var item : array) inspectPdf(item, visited, depth + 1);
        } else if (base instanceof org.apache.pdfbox.cos.COSDictionary dict) {
            for (var key : dict.keySet()) {
                if (Set.of("JS", "JavaScript", "OpenAction", "AA", "EmbeddedFiles", "RichMedia", "XFA").contains(key.getName())) throw unsafe();
                inspectPdf(dict.getItem(key), visited, depth + 1);
            }
            var action = dict.getNameAsString(org.apache.pdfbox.cos.COSName.S);
            if (Set.of("JavaScript", "Launch", "SubmitForm", "ImportData", "GoToR").contains(action == null ? "" : action)) throw unsafe();
        }
    }
    private void image(Path file, DocumentType type) throws IOException {
        try (var stream = ImageIO.createImageInputStream(file.toFile())) {
            var readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) throw corrupt();
            var reader = readers.next();
            try {
                reader.setInput(stream, true, true);
                var format = reader.getFormatName();
                if (!(type == DocumentType.PNG ? format.equalsIgnoreCase("png") : format.equalsIgnoreCase("jpeg"))) throw corrupt();
                if ((long) reader.getWidth(0) * reader.getHeight(0) > 4_000_000L) throw unsafe();
                if (reader.read(0) == null) throw corrupt();
            } finally { reader.dispose(); }
        }
    }
    private void office(Path file, DocumentType type) throws Exception {
        try (var input = Files.newInputStream(file)) {
            if (Arrays.equals(input.readNBytes(8), new byte[]{(byte)0xd0,(byte)0xcf,0x11,(byte)0xe0,(byte)0xa1,(byte)0xb1,0x1a,(byte)0xe1}))
                throw new DocumentException(422, "PASSWORD_PROTECTED", "No se admiten documentos Office cifrados o protegidos con contraseña.");
        }
        try (var zip = new ZipFile(file.toFile())) {
            if (zip.size() < 3 || zip.size() > 1000) throw unsafe();
            long expanded = 0;
            var seen = new HashSet<String>();
            var entries = zip.entries();
            String main = type == DocumentType.DOCX ? "word/document.xml" : "ppt/presentation.xml";
            boolean foundMain = false, foundTypes = false, foundRoot = false;
            while (entries.hasMoreElements()) {
                var entry = entries.nextElement(); String name = entry.getName(); String lower = name.toLowerCase(Locale.ROOT);
                if (!seen.add(name) || name.startsWith("/") || name.contains("\\") || Arrays.asList(name.split("/")).contains("..")) throw unsafe();
                if (lower.contains("vbaproject") || lower.contains("embeddings/") || lower.contains("activex/")
                        || (lower.endsWith(".bin") && !lower.matches("(?:ppt|word)/printersettings/printersettings\\d+\\.bin"))) throw unsafe();
                if (entry.isDirectory()) continue;
                if (entry.getSize() < 0 || entry.getSize() > 16L * 1024 * 1024 || entry.getSize() > Math.max(1, entry.getCompressedSize()) * 100) throw unsafe();
                var bytes = new ByteArrayOutputStream();
                var crc = new CRC32();
                try (var input = zip.getInputStream(entry)) {
                    byte[] buffer = new byte[8192]; int count; long entrySize = 0;
                    while ((count = input.read(buffer)) != -1) {
                        entrySize += count; expanded += count;
                        if (entrySize > 16L * 1024 * 1024 || expanded > 48L * 1024 * 1024) throw unsafe();
                        crc.update(buffer, 0, count);
                        if (lower.endsWith(".xml") || lower.endsWith(".rels")) bytes.write(buffer, 0, count);
                    }
                    if (entrySize != entry.getSize() || crc.getValue() != entry.getCrc()) throw corrupt();
                }
                if (bytes.size() == 0) continue;
                var factory = DocumentBuilderFactory.newInstance();
                factory.setNamespaceAware(true);
                factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
                factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
                factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
                factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, ""); factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
                var builder = factory.newDocumentBuilder();
                builder.setErrorHandler(new org.xml.sax.helpers.DefaultHandler() {
                    @Override public void fatalError(org.xml.sax.SAXParseException ex) throws org.xml.sax.SAXException { throw ex; }
                });
                var xml = builder.parse(new InputSource(new ByteArrayInputStream(bytes.toByteArray())));
                var root = xml.getDocumentElement();
                if (name.equals(main)) {
                    String ns = type == DocumentType.DOCX ? "http://schemas.openxmlformats.org/wordprocessingml/2006/main" : "http://schemas.openxmlformats.org/presentationml/2006/main";
                    if (!ns.equals(root.getNamespaceURI()) || !(type == DocumentType.DOCX ? "document" : "presentation").equals(root.getLocalName())) throw corrupt();
                    foundMain = true;
                }
                if (name.equals("[Content_Types].xml")) {
                    var nodes = root.getElementsByTagNameNS("*", "Override");
                    for (int i = 0; i < nodes.getLength(); i++) {
                        var element = (Element) nodes.item(i);
                        var content = element.getAttribute("ContentType");
                        if (content.toLowerCase(Locale.ROOT).contains("macroenabled")) throw unsafe();
                        String expected = type == DocumentType.DOCX
                                ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
                                : "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml";
                        if (element.getAttribute("PartName").equals("/" + main) && content.equals(expected)) foundTypes = true;
                    }
                }
                if (lower.endsWith(".rels")) {
                    var nodes = root.getElementsByTagNameNS("*", "Relationship");
                    for (int i = 0; i < nodes.getLength(); i++) {
                        var element = (Element) nodes.item(i);
                        if ("External".equals(element.getAttribute("TargetMode")) && !element.getAttribute("Type").endsWith("/hyperlink")) throw unsafe();
                        if (name.equals("_rels/.rels") && element.getAttribute("Type").endsWith("/officeDocument") && element.getAttribute("Target").equals(main)) foundRoot = true;
                    }
                }
            }
            if (!foundMain || !foundTypes || !foundRoot) throw corrupt();
        }
    }
}
