package com.siare.core.application.service;

import com.siare.core.domain.activity.*;
import com.siare.core.domain.activity.quiz.QuizActivity;
import com.siare.core.domain.activity.crossword.CrosswordActivity;
import java.time.Instant;
import java.util.*;

/** Allowlist projection. Never serialize server activity objects or evidence quotes to clients. */
public final class ActivityViews {
    private ActivityViews() { }
    public record SourceView(String reference,Integer fragmentIndex) { }
    public record QuestionView(String id,String prompt,List<ActivityBank.Option> options,String topic,SourceView source) { }
    public record QuizView(List<QuestionView> questions) { }
    public record Cell(int row,int column) { }
    public record Clue(String id,int number,int row,int column,String direction,int length,String clue,String topic,SourceView source) { }
    public record CrosswordView(int rows,int columns,List<Cell> cells,List<Clue> clues) { }
    public record ActivityView(UUID activityId,UUID subjectId,UUID documentId,ActivityFamily type,String title,String status,Instant createdAt,Object content) { }
    public record Summary(UUID activityId,UUID subjectId,ActivityFamily type,String title,boolean available) { }
    public record Page(List<Summary> items,String nextCursor) { }
    private static SourceView source(ActivityBank.Source source) { return source==null ? null : new SourceView(source.reference(),source.fragmentIndex()); }
    public static ActivityView view(SavedActivity saved) {
        return new ActivityView(saved.activityId(),saved.subjectId(),saved.documentId(),saved.content().family(),saved.topic(),saved.status(),saved.createdAt(),content(saved.content()));
    }
    public static Summary summary(SavedActivity saved) { return new Summary(saved.activityId(),saved.subjectId(),saved.content().family(),saved.topic(),saved.status().equals("AVAILABLE")); }
    public static Object content(Activity activity) {
        if(activity instanceof QuizActivity quiz) return new QuizView(quiz.questions().stream().map(q->new QuestionView(q.id(),q.prompt(),q.options(),q.topic(),source(q.source()))).toList());
        if(activity instanceof CrosswordActivity crossword) {
            var cells=new TreeSet<Cell>(Comparator.comparingInt(Cell::row).thenComparingInt(Cell::column));
            var clues=new ArrayList<Clue>();
            for(var p:crossword.placements()) {
                for(int i=0;i<p.word().answer().length();i++) cells.add(new Cell(p.row()+(p.direction()==CrosswordActivity.Direction.DOWN?i:0),p.column()+(p.direction()==CrosswordActivity.Direction.ACROSS?i:0)));
                clues.add(new Clue(p.word().id(),p.number(),p.row(),p.column(),p.direction().name(),p.word().answer().length(),p.word().clue(),p.word().topic(),source(p.word().source())));
            }
            return new CrosswordView(crossword.rows(),crossword.columns(),List.copyOf(cells),List.copyOf(clues));
        }
        throw new IllegalStateException("Unregistered activity view");
    }
}
