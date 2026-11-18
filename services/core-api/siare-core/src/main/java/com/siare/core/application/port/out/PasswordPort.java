package com.siare.core.application.port.out;

public interface PasswordPort {
    String hash(String password);
    boolean matches(String password, String hash);
    default boolean needsUpgrade(String hash) { return !hash.startsWith("$argon2id$"); }
}
