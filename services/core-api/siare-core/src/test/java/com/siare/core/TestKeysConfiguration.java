package com.siare.core;

import java.security.*;
import org.springframework.context.annotation.*;

@Configuration(proxyBeanMethods = false)
@Profile("test")
class TestKeysConfiguration {
    @Bean com.siare.core.application.port.out.TotpPort totpPort() throws Exception {
        byte[] key=new byte[32]; new SecureRandom().nextBytes(key);
        var file=java.nio.file.Files.createTempFile("siare-test-mfa-",".key"); file.toFile().deleteOnExit();
        java.nio.file.Files.writeString(file,java.util.Base64.getEncoder().encodeToString(key));
        return new com.siare.core.infrastructure.adapter.out.security.AesTotpAdapter(file.toString());
    }
    @Bean KeyPair jwtKeyPair() throws Exception {
        var generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        return generator.generateKeyPair();
    }
}
