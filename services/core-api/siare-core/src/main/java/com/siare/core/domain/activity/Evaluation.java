package com.siare.core.domain.activity;

import java.util.List;

public record Evaluation(List<Item> items) {
    public Evaluation { items = List.copyOf(items); if (items.isEmpty()) throw ActivityException.insufficient(); }
    public record Item(String id, boolean correct, String submitted, String expected, String rationale) { }
    public int points() { return (int) items.stream().filter(Item::correct).count(); }
    public int total() { return items.size(); }
    public double score() { return (double) points() / total(); }
    public double percentage() { return score() * 100; }
    public boolean correct() { return points() == total(); }
}
