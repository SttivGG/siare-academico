package com.siare.core.domain.activity;

public record GenerationRequest(String subjectId, String topic, ActivityBank bank, int count, int gridSize) {
    public GenerationRequest {
        topic = ActivityRules.text(topic, 100, "tema");
        if (count < 1 || count > 50 || gridSize < 5 || gridSize > 25)
            throw ActivityException.validation("Cantidad o tamaño de cuadrícula fuera de rango.");
        if (bank == null) throw ActivityException.insufficient();
    }
}
