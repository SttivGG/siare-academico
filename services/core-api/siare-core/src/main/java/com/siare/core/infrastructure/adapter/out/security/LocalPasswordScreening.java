package com.siare.core.infrastructure.adapter.out.security;

import com.siare.core.application.port.out.PasswordScreeningPort;
import com.siare.core.application.service.SessionService;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Offline exact-match screening. Optional SHA-256 corpus is read once; passwords never leave the process. */
public final class LocalPasswordScreening implements PasswordScreeningPort {
    private final Set<String> hashes=new HashSet<>();
    public LocalPasswordScreening(String additionalFile) throws IOException {
        try(var stream=getClass().getResourceAsStream("/security/common-passwords.txt")) {
            if(stream==null) throw new IOException("Falta la lista de contraseñas bloqueadas.");
            new BufferedReader(new InputStreamReader(stream,StandardCharsets.UTF_8)).lines().filter(s -> !s.isBlank())
                    .map(s -> SessionService.fingerprint(s.toLowerCase(Locale.ROOT))).forEach(hashes::add);
        }
        try(var stream=getClass().getResourceAsStream("/security/common-passwords.sha256")) {
            if(stream==null) throw new IOException("Falta el corpus de contraseñas comprometidas.");
            new BufferedReader(new InputStreamReader(stream,StandardCharsets.US_ASCII)).lines().forEach(hashes::add);
        }
        if(hashes.size()<10000) throw new IOException("Corpus de contraseñas incompleto.");
        if(!additionalFile.isBlank()) {
            try(var lines=Files.lines(Path.of(additionalFile),StandardCharsets.US_ASCII)) {
                lines.filter(s -> !s.isBlank()).forEach(s -> {
                    if(!s.matches("[a-fA-F0-9]{64}")) throw new IllegalArgumentException("Corpus SHA-256 inválido.");
                    hashes.add(s.toLowerCase(Locale.ROOT));
                });
            }
        }
    }
    @Override public boolean compromised(String password) {
        return hashes.contains(SessionService.fingerprint(password.toLowerCase(Locale.ROOT)));
    }
}
