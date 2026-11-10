package com.siare.core.application.port.out;

public interface PasswordPort {
    String hash(String password);
    boolean matches(String password, String hash);
}
