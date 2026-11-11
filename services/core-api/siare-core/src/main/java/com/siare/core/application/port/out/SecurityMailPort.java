package com.siare.core.application.port.out;

public interface SecurityMailPort {
    void passwordReset(String recipient, String token);
    void passwordChanged(String recipient);
}
