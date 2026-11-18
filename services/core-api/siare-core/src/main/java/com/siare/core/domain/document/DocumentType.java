package com.siare.core.domain.document;

import java.util.Locale;

public enum DocumentType {
    PDF("application/pdf"), DOCX("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    PPTX("application/vnd.openxmlformats-officedocument.presentationml.presentation"), JPEG("image/jpeg"), PNG("image/png");
    private final String contentType;
    DocumentType(String contentType) { this.contentType = contentType; }
    public String contentType() { return contentType; }
    public static DocumentType fromFilename(String filename) {
        String ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        return switch (ext) {
            case "pdf" -> PDF; case "docx" -> DOCX; case "pptx" -> PPTX;
            case "jpg", "jpeg" -> JPEG; case "png" -> PNG;
            default -> throw new DocumentException(415, "UNSUPPORTED_FORMAT", "Formato no soportado. Usa PDF, DOCX, PPTX, JPG, JPEG o PNG; DOC y PPT antiguos no se admiten.");
        };
    }
}
