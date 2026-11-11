package com.siare.core.domain.document;

public final class DocumentRules {
    private DocumentRules() {}
    public static String filename(String name) {
        if (name == null || name.isBlank() || name.length() > 180 || name.startsWith(".")
                || !name.equals(name.strip()) || name.endsWith(".")
                || name.matches("(?i)^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\\..*)?$")
                || name.codePoints().anyMatch(c -> Character.isISOControl(c) || Character.getType(c) == Character.FORMAT)
                || name.matches(".*[\\\\/:*?\"<>|].*") || name.contains("..")) {
            throw new DocumentException(400, "UNSAFE_FILENAME", "Usa un nombre de archivo simple, sin rutas ni caracteres de control (máximo 180 caracteres).");
        }
        return name;
    }
    public static void size(long size, long maximum) {
        if (size <= 0) throw new DocumentException(400, "EMPTY_FILE", "El archivo está vacío.");
        if (size > maximum) throw new DocumentException(413, "FILE_TOO_LARGE", "El archivo supera el límite de " + maximum + " bytes.");
    }
}
