package com.siare.core.application.port.in;
import java.util.UUID;
public interface LogoutUseCase { void logout(UUID actor, UUID sessionId); }
