package com.siare.core.domain.activity;

import java.util.*;

/** Author-reviewed structured content; validation checks structure, not factual truth. */
public record ActivityBank(boolean validated, List<Question> questions, List<Word> words) {
    @Override public String toString() { return "ActivityBank[REDACTED]"; }
    public ActivityBank {
        questions=questions==null ? List.of() : List.copyOf(questions);
        words=words==null ? List.of() : List.copyOf(words);
        if(!validated) throw ActivityException.insufficient();
        if(questions.size()>50 || words.size()>12) throw ActivityException.validation("Banco demasiado grande (50 preguntas / 12 palabras).");
        unique(questions.stream().map(Question::id).toList()); unique(words.stream().map(Word::id).toList());
        unique(words.stream().map(Word::answer).toList());
    }
    private static void unique(List<String> ids) {
        if(new HashSet<>(ids).size()!=ids.size()) throw ActivityException.validation("El banco contiene identificadores o palabras repetidos.");
    }
    public record Source(String reference, Integer fragmentIndex, String quote) {
        public Source {
            reference=ActivityRules.text(reference,500,"fuente");
            if(fragmentIndex!=null && (fragmentIndex<0 || fragmentIndex>1999)) throw ActivityException.validation("Fragmento inválido.");
            if(quote!=null) quote=ActivityRules.text(quote,4000,"cita");
        }
    }
    public record Option(String id, String text) {
        public Option { id=ActivityRules.id(id); text=ActivityRules.text(text,1000,"opción"); }
    }
    public record Question(String id, String prompt, List<Option> options, String correctOptionId,
                           String topic, Source source, String explanation) {
        public Question {
            id=ActivityRules.id(id); prompt=ActivityRules.text(prompt,2000,"pregunta"); topic=ActivityRules.text(topic,100,"tema");
            explanation=ActivityRules.text(explanation,2000,"justificación revisada");
            if(options==null || options.size()<2 || options.size()>6) throw ActivityException.validation("Cada pregunta requiere de 2 a 6 opciones.");
            options=List.copyOf(options); unique(options.stream().map(Option::id).toList());
            unique(options.stream().map(o->o.text().toLowerCase(Locale.ROOT)).toList());
            if(options.stream().noneMatch(o->o.id().equals(correctOptionId))) throw ActivityException.validation("La clave debe identificar una opción del banco.");
        }
    }
    public record Word(String id, String answer, String clue, String topic, Source source) {
        public Word {
            id=ActivityRules.id(id); answer=ActivityRules.normalize(ActivityRules.text(answer,100,"palabra")); clue=ActivityRules.text(clue,2000,"pista"); topic=ActivityRules.text(topic,100,"tema");
            if(!answer.matches("[A-ZÑ]{2,25}")) throw ActivityException.validation("Las palabras admiten de 2 a 25 letras españolas.");
        }
    }
}
