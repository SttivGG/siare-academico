package com.siare.core.domain.identity;

import com.siare.core.domain.account.BusinessException;
import java.text.Normalizer;
import java.nio.charset.StandardCharsets;

public final class PasswordPolicy {
    private PasswordPolicy() {}
    public static String normalize(String password) { return Normalizer.normalize(password, Normalizer.Form.NFC); }
    public static void bound(String password) {
        if (password == null || password.length() > 2048 || password.getBytes(StandardCharsets.UTF_8).length > 4096)
            throw new BusinessException(BusinessException.Kind.VALIDATION, "La contraseña supera el límite de 1024 caracteres o 4096 bytes UTF-8.");
    }
    public static String validate(String password) {
        bound(password);
        String normalized = normalize(password);
        int length = normalized.codePointCount(0, normalized.length());
        if (length < 15 || length > 1024)
            throw new BusinessException(BusinessException.Kind.VALIDATION, "Usa una frase de entre 15 y 1024 caracteres.");
        return normalized;
    }
}
