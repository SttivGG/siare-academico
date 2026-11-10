package com.siare.core;

import java.security.*;
import org.springframework.context.annotation.*;

@Configuration(proxyBeanMethods = false)
@Profile("test")
class TestKeysConfiguration {
    @Bean KeyPair jwtKeyPair() throws Exception {
        var generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        return generator.generateKeyPair();
    }
}
