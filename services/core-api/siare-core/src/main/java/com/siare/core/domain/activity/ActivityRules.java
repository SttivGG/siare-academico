package com.siare.core.domain.activity;

import java.text.Normalizer;
import java.util.*;

public final class ActivityRules {
    private ActivityRules() { }
    public static String text(String value, int max, String field) {
        if(value==null || value.isBlank() || value.length()>max) throw ActivityException.validation("Campo inválido: " + field + ".");
        return value.strip();
    }
    public static String id(String value) {
        if(value==null || !value.matches("[A-Za-z0-9_-]{1,64}")) throw ActivityException.validation("Identificador de contenido inválido.");
        return value;
    }
    /** Preserve Ñ as a distinct Spanish letter; remove accents, whitespace and hyphens. */
    public static String normalize(String value) {
        if(value==null) return "";
        String upper=Normalizer.normalize(value.strip(),Normalizer.Form.NFC).toUpperCase(Locale.ROOT).replace('Ñ','\uE000');
        return Normalizer.normalize(upper,Normalizer.Form.NFD).replaceAll("\\p{M}","")
                .replace('\uE000','Ñ').replaceAll("[\\s-]","");
    }
    public static void answers(Map<String,String> answers, Set<String> ids) {
        if(answers==null || answers.size()>50 || answers.keySet().stream().anyMatch(k->k==null || !k.matches("[A-Za-z0-9_-]{1,64}")) || !ids.containsAll(answers.keySet()) ||
                answers.values().stream().anyMatch(v->v==null || v.length()>200))
            throw ActivityException.validation("Las respuestas contienen identificadores o valores inválidos.");
    }
}
