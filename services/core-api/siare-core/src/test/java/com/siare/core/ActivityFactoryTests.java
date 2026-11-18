package com.siare.core;

import com.siare.core.application.service.*;
import com.siare.core.domain.activity.*;
import com.siare.core.domain.activity.quiz.*;
import com.siare.core.domain.activity.crossword.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class ActivityFactoryTests {
    final RegisteredActivityFactories provider=new RegisteredActivityFactories();
    GenerationRequest request(ActivityBank bank,int count) { return new GenerationRequest(UUID.randomUUID().toString(),"Repaso",bank,count,15); }
    @Test void providerSelectsTypedFamiliesAndDistinctProducts() {
        var quiz=provider.forFamily(ActivityFamily.QUIZ); var crossword=provider.forFamily(ActivityFamily.CROSSWORD);
        assertThat(quiz).isInstanceOf(QuizFactory.class); assertThat(crossword).isInstanceOf(CrosswordFactory.class);
        assertThat(quiz.createGenerator()).isInstanceOf(QuizGenerator.class);
        assertThat(crossword.createGenerator()).isInstanceOf(CrosswordGenerator.class);
        assertThat(quiz.createEvaluator()).isInstanceOf(QuizEvaluator.class);
        assertThat(crossword.createEvaluator()).isInstanceOf(CrosswordEvaluator.class);
        assertThat(quiz.createFeedbackPolicy()).isInstanceOf(QuizFeedbackPolicy.class);
        assertThat(crossword.createFeedbackPolicy()).isInstanceOf(CrosswordFeedbackPolicy.class);
        assertThatThrownBy(()->new RegisteredActivityFactories(List.of(new BankQuizFactory(),new BankQuizFactory()))).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void quizUsesOnlyReviewedBankAndKeepsStableIdsWithShuffledOptions() {
        var generated=(QuizActivity)new GenerateActivityService(provider).generate(ActivityFamily.QUIZ,request(ActivityFixtures.quizBank(),2));
        assertThat(generated.questions()).extracting(ActivityBank.Question::id).containsExactlyInAnyOrder("q1","q2");
        assertThat(generated.questions()).allSatisfy(q->assertThat(q.options()).extracting(ActivityBank.Option::id).containsExactlyInAnyOrder("a","b"));
        var factory=new BankQuizFactory();
        var partial=factory.createEvaluator().evaluate(generated,new QuizAnswers(Map.of("q1","a","q2","b")));
        assertThat(partial.points()).isEqualTo(1); assertThat(partial.total()).isEqualTo(2); assertThat(partial.score()).isEqualTo(0.5); assertThat(partial.percentage()).isEqualTo(50);
        assertThat(partial.items()).filteredOn(i->!i.correct()).extracting(Evaluation.Item::id).containsExactly("q2");
        assertThat(factory.createEvaluator().evaluate(generated,new QuizAnswers(Map.of())).score()).isZero();
        assertThat(factory.createEvaluator().evaluate(generated,new QuizAnswers(Map.of("q1","a","q2","a")))).matches(Evaluation::correct);
        assertThatThrownBy(()->factory.createEvaluator().evaluate(generated,new QuizAnswers(Map.of("q1","unknown"))))
                .isInstanceOf(ActivityException.class);
    }
    @Test void insufficientAndInvalidBanksAreRejected() {
        assertThatThrownBy(()->new QuizGenerator().generate(request(new ActivityBank(true,List.of(),List.of()),1))).isInstanceOf(ActivityException.class).hasMessageContaining("estructurado");
        assertThatThrownBy(()->new QuizGenerator().generate(request(ActivityFixtures.quizBank(),3))).isInstanceOf(ActivityException.class);
        assertThatThrownBy(()->new ActivityBank(false,List.of(),List.of())).isInstanceOf(ActivityException.class);
        assertThatThrownBy(()->ActivityFixtures.wordBank("sol","sól")).isInstanceOf(ActivityException.class);
    }
    @Test void crosswordHasConnectedCompatibleCrossingsAndNumberedBoundedClues() {
        var crossword=(CrosswordActivity)new CrosswordGenerator().generate(request(ActivityFixtures.wordBank("SOL","LUNA","NUBE"),3));
        assertThat(crossword.placements()).hasSize(3);
        assertThat(crossword.placements()).extracting(CrosswordActivity.Placement::direction).contains(CrosswordActivity.Direction.ACROSS,CrosswordActivity.Direction.DOWN);
        var board=new HashMap<String,Character>(); var counts=new HashMap<String,Integer>();
        for(var p:crossword.placements()) {
            assertThat(p.number()).isPositive();
            for(int i=0;i<p.word().answer().length();i++) {
                int r=p.row()+(p.direction()==CrosswordActivity.Direction.DOWN?i:0),c=p.column()+(p.direction()==CrosswordActivity.Direction.ACROSS?i:0);
                assertThat(r).isBetween(0,crossword.rows()-1); assertThat(c).isBetween(0,crossword.columns()-1);
                String cell=r+":"+c; var old=board.putIfAbsent(cell,p.word().answer().charAt(i));
                if(old!=null) assertThat(old).isEqualTo(p.word().answer().charAt(i)); counts.merge(cell,1,Integer::sum);
            }
        }
        assertThat(counts.values().stream().filter(n->n==2).count()).isGreaterThanOrEqualTo(2);
        assertThat(crossword.rows()).isLessThanOrEqualTo(15); assertThat(crossword.columns()).isLessThanOrEqualTo(15);
    }
    @Test void impossibleGridAndOversizedWordsAreRejected() {
        assertThatThrownBy(()->new CrosswordGenerator().generate(request(ActivityFixtures.wordBank("SOL","PEZ"),2)))
                .isInstanceOf(ActivityException.class).hasMessageContaining("cuadrícula");
        var small=new GenerationRequest("subject","Repaso",ActivityFixtures.wordBank("PROGRAMACION","RAM"),2,5);
        assertThatThrownBy(()->new CrosswordGenerator().generate(small)).isInstanceOf(ActivityException.class);
    }
    @Test void spanishNormalizationAndWordScoringAreConsistent() {
        assertThat(ActivityRules.normalize("  cañóN ")).isEqualTo("CAÑON");
        assertThat(ActivityRules.normalize("nin\u0303o")).isEqualTo("NIÑO");
        assertThat(ActivityRules.normalize("año")).isNotEqualTo(ActivityRules.normalize("ano"));
        var crossword=(CrosswordActivity)new CrosswordGenerator().generate(request(ActivityFixtures.wordBank("cañón","niño"),2));
        var evaluation=new CrosswordEvaluator().evaluate(crossword,new CrosswordAnswers(Map.of("w1","CAÑON","w2","nino")));
        assertThat(evaluation.score()).isEqualTo(0.5);
        assertThat(new CrosswordEvaluator().evaluate(crossword,new CrosswordAnswers(Map.of("w1","cañón","w2","niño"))).score()).isEqualTo(1);
    }
}
