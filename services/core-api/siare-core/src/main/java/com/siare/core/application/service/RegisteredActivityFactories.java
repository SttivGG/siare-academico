package com.siare.core.application.service;
import com.siare.core.application.port.out.ActivityFactoryProvider;
import com.siare.core.domain.activity.*;
import com.siare.core.domain.activity.factory.ActivityFactory;
import com.siare.core.domain.activity.quiz.BankQuizFactory;
import com.siare.core.domain.activity.crossword.GridCrosswordFactory;
import java.util.*;
public final class RegisteredActivityFactories implements ActivityFactoryProvider {
    private final Map<ActivityFamily,ActivityFactory<?,?>> factories;
    public RegisteredActivityFactories() { this(List.of(new BankQuizFactory(),new GridCrosswordFactory())); }
    public RegisteredActivityFactories(List<ActivityFactory<?,?>> entries) {
        var registered=new EnumMap<ActivityFamily,ActivityFactory<?,?>>(ActivityFamily.class);
        for(var factory:entries) if(registered.put(factory.family(),factory)!=null) throw new IllegalArgumentException("Duplicate activity family");
        factories=Map.copyOf(registered);
    }
    @Override public ActivityFactory<?,?> forFamily(ActivityFamily family) {
        var factory=factories.get(family); if(factory==null) throw ActivityException.validation("Familia de actividad no disponible."); return factory;
    }
}
