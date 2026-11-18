package com.siare.core.application.service;
import com.siare.core.application.port.in.GenerateActivityUseCase;
import com.siare.core.application.port.out.ActivityFactoryProvider;
import com.siare.core.domain.activity.*;
public final class GenerateActivityService implements GenerateActivityUseCase {
    private final ActivityFactoryProvider factories;
    public GenerateActivityService(ActivityFactoryProvider factories) { this.factories=factories; }
    @Override public Activity generate(ActivityFamily family,GenerationRequest request) { return factories.forFamily(family).createGenerator().generate(request); }
}
