package com.siare.core.application.port.in;

import com.siare.core.application.port.out.TokenPort.AccessToken;

public interface VerifyMfaUseCase { AccessToken verify(String challenge, String code); }
