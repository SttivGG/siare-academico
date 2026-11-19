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
import org.apache.pdfbox.cos.*;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.w3c.dom.Element;
import org.xml.sax.InputSource;

/** No renderer, macro interpreter, external XML entities, or external resource fetches. */
public final class StructuralDocumentValidator implements DocumentValidator {
    private final long maximum;
    public StructuralDocumentValidator(long maximum) { this.maximum = maximum; }
    @Override public void validateForStorage(InputStream source, DocumentType type) {
        // No PDF/ZIP/image parser in the HTTP upload process. Bytes stay private until READY.
        try {
            byte[] header = source.readNBytes(8);
            long actual = header.length;
            byte[] tail = new byte[1024]; int position = 0;
            for (byte value : header) tail[position++ % tail.length] = value;
            byte[] buffer = new byte[8192]; int count;
            while ((count = source.read(buffer)) != -1) {
                actual += count;
                if (actual > maximum) throw new DocumentException(413, "FILE_TOO_LARGE", "El archivo supera el límite permitido.");
                for (int i = 0; i < count; i++) tail[position++ % tail.length] = buffer[i];
            }
            if (actual > maximum) throw new DocumentException(413, "FILE_TOO_LARGE", "El archivo supera el límite permitido.");
            byte[] orderedTail = new byte[tail.length];
            for (int i = 0; i < tail.length; i++) orderedTail[i] = tail[(position % tail.length + i) % tail.length];
            boolean matches = switch (type) {
                case PDF -> header.length == 8 && new String(header, java.nio.charset.StandardCharsets.US_ASCII).matches("%PDF-[12]\\.[0-9]")
                        && new String(orderedTail, java.nio.charset.StandardCharsets.ISO_8859_1).contains("%%EOF");
                case PNG -> Arrays.equals(header, new byte[]{(byte)137,80,78,71,13,10,26,10});
                case JPEG -> header.length >= 3 && header[0] == (byte)255 && header[1] == (byte)216 && header[2] == (byte)255;
                case DOCX, PPTX -> header.length >= 4 && header[0] == 80 && header[1] == 75 && header[2] == 3 && header[3] == 4;
            };
            if (!matches) throw corrupt();
        } catch (IOException error) { throw corrupt(); }
    }
    private static DocumentException corrupt() { return new DocumentException(422, "CORRUPT_DOCUMENT", "El documento está corrupto o su estructura no corresponde al formato indicado."); }
    private static DocumentException unsafe() { return new DocumentException(422, "UNSAFE_DOCUMENT", "El documento contiene contenido activo o una expansión comprimida no permitida."); }
    private static DocumentException active() { return new DocumentException(422, "ACTIVE_CONTENT", "El PDF contiene acciones o contenido activo no permitido. Exporta una copia sin acciones ni scripts."); }
    private static DocumentException resourceLimit() { return new DocumentException(422, "DOCUMENT_LIMIT_EXCEEDED", "El documento supera los límites de procesamiento seguro. Usa una versión más pequeña o dividida."); }
    private static DocumentException attachments() { return new DocumentException(422, "ATTACHMENTS_NOT_ALLOWED", "El PDF contiene archivos adjuntos no admitidos. Usa una copia sin adjuntos."); }
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
            if (doc.getNumberOfPages() < 1) throw corrupt();
            if (doc.getNumberOfPages() > 500) throw resourceLimit();
            // Inspect all parsed dictionaries without resolving or executing actions.
            int objects = 0;
            Set<org.apache.pdfbox.cos.COSBase> visited = Collections.newSetFromMap(new IdentityHashMap<>());
            inspectPdf(doc.getDocument().getTrailer(), visited, 0);
            for (var keyObject : doc.getDocument().getXrefTable().keySet()) {
                if (++objects > 100_000) throw resourceLimit();
                var base = doc.getDocument().getObjectFromPool(keyObject).getObject();
                inspectPdf(base, visited, 0);
            }
            // Standalone structural diagnostic; production processing runs in the isolated worker.
            inspectPdfAttachments(visited);
            long expanded = 0;
            for (var page : doc.getPages()) {
                if (page.getMediaBox() == null) throw corrupt();
                try (var stream = page.getContents()) {
                    byte[] buffer = new byte[8192]; int count; long pageSize = 0;
                    while ((count = stream.read(buffer)) != -1) {
                        pageSize += count; expanded += count;
                        if (pageSize > 8L * 1024 * 1024 || expanded > 48L * 1024 * 1024) throw resourceLimit();
                    }
                }
            }
        }
    }
    private void inspectPdf(org.apache.pdfbox.cos.COSBase base, Set<org.apache.pdfbox.cos.COSBase> visited, int depth) {
        if (base == null || !visited.add(base)) return;
        if (depth > 100 || visited.size() > 200_000) throw resourceLimit();
        if (base instanceof org.apache.pdfbox.cos.COSObject object) inspectPdf(object.getObject(), visited, depth + 1);
        else if (base instanceof org.apache.pdfbox.cos.COSArray array) {
            for (var item : array) inspectPdf(item, visited, depth + 1);
        } else if (base instanceof org.apache.pdfbox.cos.COSDictionary dict) {
            for (var key : dict.keySet()) {
                if (Set.of("JS", "JavaScript", "OpenAction", "AA", "Launch", "RichMedia", "RichMediaContent", "RichMediaSettings", "XFA").contains(key.getName())) throw active();
                inspectPdf(dict.getItem(key), visited, depth + 1);
            }
            var action = dict.getNameAsString(org.apache.pdfbox.cos.COSName.S);
            if (Set.of("JavaScript", "Launch", "SubmitForm", "ImportData", "GoToR").contains(action == null ? "" : action)) throw active();
            if ("RichMedia".equals(dict.getNameAsString(COSName.SUBTYPE))) throw active();
        }
    }
    private void inspectPdfAttachments(Set<COSBase> visited) throws IOException {
        boolean attached = false;
        var specifications = new ArrayList<COSDictionary>();
        var streams = new ArrayList<COSStream>();
        for (var base : visited) {
            if (!(base instanceof COSDictionary dict)) continue;
            String type = dict.getNameAsString(COSName.TYPE);
            if (dict.containsKey(COSName.EMBEDDED_FILES) || dict.containsKey(COSName.EF)
                    || dict.containsKey(COSName.getPDFName("AF"))
                    || "FileAttachment".equals(dict.getNameAsString(COSName.SUBTYPE))) attached = true;
            if ("Filespec".equals(type)) { attached = true; specifications.add(dict); }
            if ("EmbeddedFile".equals(type)) {
                attached = true;
                if (dict instanceof COSStream stream) streams.add(stream);
                else throw attachments();
            }
        }
        if (!attached) return;
        // Structural classification is independent of signature/trust verification.
        // This diagnostic supports unfiltered bounded JUMBF. The production worker also supports
        // bounded Flate streams and returns warnings; it never studies attachment contents.
        if (specifications.size() == 1 && streams.size() == 1) {
            var specification = specifications.getFirst();
            var stream = streams.getFirst();
            var embedded = specification.getCOSDictionary(COSName.EF);
            var mime = specification.getDictionaryObject(COSName.SUBTYPE);
            boolean c2paMime = (mime instanceof COSString s && "application/c2pa".equals(s.getString()))
                    || (mime instanceof COSName n && "application/c2pa".equals(n.getName()));
            if ("C2PA_Manifest".equals(specification.getNameAsString(COSName.getPDFName("AFRelationship")))
                    && c2paMime && "application/c2pa".equals(stream.getNameAsString(COSName.SUBTYPE))
                    && embedded != null && embedded.getDictionaryObject(COSName.F) == stream
                    && embedded.size() == 1 && stream.getLength() > 0 && stream.getLength() <= 256L * 1024) {
                if (stream.containsKey(COSName.FILTER)) throw attachments();
                try (var input = stream.createRawInputStream()) {
                    var bytes = input.readNBytes(256 * 1024 + 1);
                    if (isManifest(bytes)) return;
                }
            }
        }
        throw attachments();
    }
    private static boolean isManifest(byte[] bytes) {
        if (bytes.length < 48 || bytes.length > 256 * 1024) return false;
        try {
            var buffer = java.nio.ByteBuffer.wrap(bytes);
            if (buffer.getInt(0) != bytes.length || buffer.getInt(4) != 0x6a756d62) return false;
            int descriptionSize = buffer.getInt(8);
            if (descriptionSize < 30 || descriptionSize > bytes.length - 8 || buffer.getInt(12) != 0x6a756d64
                    || buffer.getInt(16) != 0x63327061
                    || buffer.getLong(20) != 0x00110010800000aaL || buffer.getInt(28) != 0x00389b71
                    || (bytes[32] & 2) == 0 || !Arrays.equals(Arrays.copyOfRange(bytes, 33, 38), new byte[]{99,50,112,97,0})) return false;
            int start = 8 + descriptionSize, boxes = 0; boolean manifest = false;
            while (start < bytes.length) {
                if (++boxes > 4096 || bytes.length - start < 8) return false;
                int size = buffer.getInt(start);
                if (size < 8 || size > bytes.length - start) return false;
                if (size >= 40 && buffer.getInt(start + 4) == 0x6a756d62 && buffer.getInt(start + 12) == 0x6a756d64) {
                    int kind = buffer.getInt(start + 16);
                    manifest |= Set.of(0x63326d61, 0x6332636d, 0x6332756d).contains(kind);
                }
                start += size;
            }
            return manifest;
        } catch (IndexOutOfBoundsException error) { return false; }
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
