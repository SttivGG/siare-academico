package com.siare.core.infrastructure.config;

import com.siare.core.application.port.in.AccountUseCase;
import com.siare.core.application.port.out.*;
import com.siare.core.application.service.SessionService;
import com.siare.core.domain.identity.*;
import java.util.Arrays;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Deliberately console-only: no HTTP registration, environment password, or command-line secret. */
@Component
@ConditionalOnProperty(name="siare.bootstrap-superadmin",havingValue="true")
public class SuperadminBootstrap implements ApplicationRunner {
    private final TransactionPort tx;
    private final IdentityRepository identities;
    private final AccountUseCase accounts;
    private final SessionService sessions;
    public SuperadminBootstrap(TransactionPort tx,IdentityRepository identities,AccountUseCase accounts,SessionService sessions) {
        this.tx=tx; this.identities=identities; this.accounts=accounts; this.sessions=sessions;
    }
    @Override public void run(ApplicationArguments args) {
        tx.required(() -> {
            identities.lockBootstrap();
            if(identities.bootstrapped()) { System.out.println("Bootstrap ya completado. No se ha modificado ninguna cuenta."); return null; }
            var console=System.console();
            if(console==null) throw new IllegalStateException("El bootstrap requiere una consola interactiva segura (TTY).");
            String name=console.readLine("Nombre del primer SUPERADMIN: ");
            String email=console.readLine("Correo: ");
            char[] secret=console.readPassword("Frase de contraseña (no se mostrará): ");
            if(secret==null) throw new IllegalStateException("Bootstrap cancelado.");
            try {
                var user=accounts.register(name,email,new String(secret));
                var access=identities.lockAccess(user.id());
                identities.update(new UserAccess(user.id(),Role.SUPERADMIN,access.scopeId(),true,access.version()));
                identities.finishBootstrap();
                sessions.event(user.id(),"SUPERADMIN_BOOTSTRAP","user:"+user.id(),"SUCCESS",access.scopeId());
                System.out.println("SUPERADMIN creado. Inicia sesión y confirma el alta MFA provisional antes de usar permisos administrativos.");
            } finally { Arrays.fill(secret,'\0'); }
            return null;
        });
    }
}
