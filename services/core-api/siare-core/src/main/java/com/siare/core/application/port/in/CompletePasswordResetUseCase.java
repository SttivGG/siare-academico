package com.siare.core.application.port.in;

public interface CompletePasswordResetUseCase { void complete(String token, String newPassword); }
