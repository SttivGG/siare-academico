package com.siare.core.application.port.in;
import com.siare.core.application.port.out.TokenPort.AccessToken;
public interface RefreshSessionUseCase { AccessToken refresh(String refreshToken); }
