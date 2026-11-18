package com.siare.core;
import com.siare.core.domain.activity.*;
import java.util.*;
final class ActivityFixtures {
    static ActivityBank quizBank() {
        return new ActivityBank(true,List.of(
                new ActivityBank.Question("q1","¿Cuánto es 2 + 2?",List.of(new ActivityBank.Option("a","4"),new ActivityBank.Option("b","5")),"a","Repaso",null,"2 + 2 = 4."),
                new ActivityBank.Question("q2","¿Cuánto es 3 + 3?",List.of(new ActivityBank.Option("a","6"),new ActivityBank.Option("b","7")),"a","Repaso",null,"3 + 3 = 6.")),List.of());
    }
    static ActivityBank wordBank(String... words) {
        var entries=new ArrayList<ActivityBank.Word>(); int id=1;
        for(String word:words) entries.add(new ActivityBank.Word("w"+id++,word,"Definición revisada de prueba "+id,"Repaso",null));
        return new ActivityBank(true,List.of(),entries);
    }
}
