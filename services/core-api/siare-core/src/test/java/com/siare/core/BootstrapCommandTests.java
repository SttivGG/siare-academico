package com.siare.core;

import com.siare.core.application.port.in.AccountUseCase;
import com.siare.core.application.port.out.*;
import com.siare.core.application.service.SessionService;
import com.siare.core.infrastructure.config.SuperadminBootstrap;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BootstrapCommandTests {
    private final TransactionPort tx=new TransactionPort() {
        @Override public <T> T required(Supplier<T> work) { return work.get(); }
    };
    @Test void completedBootstrapIsIdempotentWithoutRequestingNewCredentials() {
        var identities=mock(IdentityRepository.class); var accounts=mock(AccountUseCase.class); var sessions=mock(SessionService.class);
        when(identities.bootstrapped()).thenReturn(true);
        var command=new SuperadminBootstrap(tx,identities,accounts,sessions);
        command.run(new DefaultApplicationArguments()); command.run(new DefaultApplicationArguments());
        verify(identities,times(2)).lockBootstrap();
        verify(identities,never()).finishBootstrap();
        verifyNoInteractions(accounts,sessions);
    }
    @Test void unattendedBootstrapCannotCreateAPrivilegedAccount() {
        // Surefire has no interactive System.console; no environment/argument fallback is permitted.
        org.junit.jupiter.api.Assumptions.assumeTrue(System.console()==null);
        var identities=mock(IdentityRepository.class); var accounts=mock(AccountUseCase.class); var sessions=mock(SessionService.class);
        var command=new SuperadminBootstrap(tx,identities,accounts,sessions);
        assertThatThrownBy(() -> command.run(new DefaultApplicationArguments())).isInstanceOf(IllegalStateException.class);
        verify(identities,never()).finishBootstrap(); verifyNoInteractions(accounts,sessions);
    }
}
