package com.siare.core.domain.activity.crossword;
import com.siare.core.domain.activity.*;
import com.siare.core.domain.activity.factory.Evaluator;
import java.util.stream.Collectors;
public final class CrosswordEvaluator implements Evaluator<Crossword,CrosswordSubmission> {
    @Override public Evaluation evaluate(Crossword crossword,CrosswordSubmission submission) {
        var words=((CrosswordActivity)crossword).placements().stream().map(CrosswordActivity.Placement::word).toList();
        var answers=((CrosswordAnswers)submission).answers();
        ActivityRules.answers(answers,words.stream().map(ActivityBank.Word::id).collect(Collectors.toSet()));
        return new Evaluation(words.stream().map(w->new Evaluation.Item(w.id(),w.answer().equals(ActivityRules.normalize(answers.get(w.id()))),
                answers.get(w.id()),w.answer(),w.clue())).toList());
    }
}
