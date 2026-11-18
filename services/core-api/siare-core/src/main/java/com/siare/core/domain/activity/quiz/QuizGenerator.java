package com.siare.core.domain.activity.quiz;
import com.siare.core.domain.activity.*;
import com.siare.core.domain.activity.factory.Generator;
import java.util.*;
public final class QuizGenerator implements Generator<Quiz> {
    @Override public Quiz generate(GenerationRequest request) {
        var eligible=new ArrayList<>(request.bank().questions().stream().filter(q->q.topic().equals(request.topic())).toList());
        if(eligible.size()<request.count()) throw ActivityException.insufficient();
        Collections.shuffle(eligible);
        var selected=eligible.subList(0,request.count()).stream().map(q->{
            var options=new ArrayList<>(q.options()); Collections.shuffle(options);
            return new ActivityBank.Question(q.id(),q.prompt(),options,q.correctOptionId(),q.topic(),q.source(),q.explanation());
        }).toList();
        return new QuizActivity(selected);
    }
}
