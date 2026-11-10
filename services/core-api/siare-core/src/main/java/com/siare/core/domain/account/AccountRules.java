package com.siare.core.domain.account;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import static com.siare.core.domain.account.BusinessException.Kind.VALIDATION;

public final class AccountRules {
    private AccountRules() {}

    public static String email(String value) {
        String email = value == null ? "" : value.strip().toLowerCase(Locale.ROOT);
        if (email.length() > 254 || !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw new BusinessException(VALIDATION, "El correo no es válido.");
        }
        return email;
    }

    public static String name(String value, int max) {
        String name = value == null ? "" : value.strip();
        if (name.isEmpty() || name.length() > max) {
            throw new BusinessException(VALIDATION, "El nombre es obligatorio y debe tener como máximo " + max + " caracteres.");
        }
        return name;
    }

    public static void password(String value) {
        if (value == null || value.length() < 10 || value.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new BusinessException(VALIDATION, "La contraseña debe tener al menos 10 caracteres y como máximo 72 bytes UTF-8.");
        }
    }
}
