package com.siare.core.application.service;

import com.siare.core.application.port.in.*;
import com.siare.core.application.port.out.*;
import com.siare.core.domain.activity.*;
import com.siare.core.domain.activity.factory.ActivityFactory;
import com.siare.core.domain.account.BusinessException;
import com.siare.core.domain.document.*;
import java.time.Clock;
import java.util.*;
import static com.siare.core.domain.account.BusinessException.Kind.*;

public final class ActivityService implements ActivityUseCase {
    private final SubjectUseCase subjects;
    private final GetDocumentUseCase documents;
    private final StructuredActivityContent structured;
    private final GenerateActivityUseCase generator;
    private final ActivityFactoryProvider factories;
    private final ActivityRepository activities;
    private final TransactionPort tx;
    private final Clock clock;
    public ActivityService(SubjectUseCase subjects,GetDocumentUseCase documents,StructuredActivityContent structured,
            GenerateActivityUseCase generator,ActivityFactoryProvider factories,ActivityRepository activities,TransactionPort tx,Clock clock) {
        this.subjects=subjects; this.documents=documents; this.structured=structured; this.generator=generator;
        this.factories=factories; this.activities=activities; this.tx=tx; this.clock=clock;
    }
    @Override public SavedActivity create(UUID owner,UUID subject,ActivityFamily family,UUID document,String topic,ActivityBank bank,int count,int gridSize) {
        writable(owner,subject);
        if(document!=null) {
            var metadata=documents.get(owner,document);
            if(!metadata.ownerId().equals(owner) || !metadata.subjectId().equals(subject)) throw new BusinessException(FORBIDDEN,"El documento no pertenece a esta materia y usuario.");
            if(metadata.status()!=DocumentStatus.READY) throw new ActivityException(409,"TEXT_NOT_READY","El documento debe estar READY.");
            var content=documents.text(owner,document);
            if(content==null || content.text()==null || content.text().isBlank()) throw ActivityException.insufficient();
            if(bank==null) bank=structured.read(content.text());
            validateSources(bank,content);
        }
        var generated=generator.generate(family,new GenerationRequest(subject.toString(),topic,bank,count,gridSize));
        var saved=new SavedActivity(UUID.randomUUID(),subject,document,topic.strip(),clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MICROS),"AVAILABLE",generated);
        return tx.required(()->{ writable(owner,subject); activities.insert(saved); return saved; });
    }
    private void validateSources(ActivityBank bank,ExtractedContent content) {
        for(var question:bank.questions()) {
            String expected=question.options().stream().filter(o->o.id().equals(question.correctOptionId())).findFirst().orElseThrow().text();
            evidence(question.source(),expected,content);
        }
        for(var word:bank.words()) evidence(word.source(),word.answer(),content);
    }
    private void evidence(ActivityBank.Source source,String answer,ExtractedContent content) {
        if(source==null || source.fragmentIndex()==null || source.quote()==null || content.fragments()==null) throw ActivityException.insufficient();
        var fragment=content.fragments().stream().filter(f->f.index()==source.fragmentIndex()).findFirst().orElseThrow(ActivityException::insufficient);
        if(!fragment.text().contains(source.quote()) || !ActivityRules.normalize(source.quote()).contains(ActivityRules.normalize(answer)))
            throw new ActivityException(422,"UNSUPPORTED_SOURCE","La cita y la respuesta deben estar sustentadas en el fragmento indicado.");
    }
    @Override public List<SavedActivity> list(UUID owner,UUID subject,UUID after,int limit) {
        subjects.get(owner,subject); if(limit<1 || limit>100) throw ActivityException.validation("limit debe estar entre 1 y 100.");
        return activities.list(subject,after,limit);
    }
    @Override public SavedActivity get(UUID owner,UUID activity) {
        var saved=activities.find(activity,false).orElseThrow(()->new BusinessException(NOT_FOUND,"Actividad no encontrada."));
        subjects.get(owner,saved.subjectId()); return saved;
    }
    @Override public AttemptResult submit(UUID owner,UUID activity,UUID idempotencyKey,Map<String,String> answers,long durationMs) {
        var saved=get(owner,activity);
        if(idempotencyKey==null || durationMs<0 || durationMs>86400000) throw ActivityException.validation("Indica idempotencyKey y durationMs entre 0 y 86400000.");
        ActivityRules.answers(answers,answers==null ? Set.of() : answers.keySet());
        String fingerprint=fingerprint(answers,durationMs);
        return tx.required(()->{
            var locked=activities.find(activity,true).orElseThrow(()->new BusinessException(NOT_FOUND,"Actividad no encontrada."));
            subjects.get(owner,locked.subjectId());
            var previous=activities.findAttempt(activity,owner,idempotencyKey);
            if(previous.isPresent()) {
                if(!previous.get().fingerprint().equals(fingerprint)) throw new ActivityException(409,"IDEMPOTENCY_CONFLICT","La clave de idempotencia ya se utilizó con otras respuestas o duración.");
                return previous.get().result();
            }
            writable(owner,locked.subjectId());
            var result=evaluate(factories.forFamily(locked.content().family()),locked,owner,answers,durationMs);
            activities.saveAttempt(idempotencyKey,fingerprint,result); return result;
        });
    }
    private <A extends Activity,S extends Submission> AttemptResult evaluate(ActivityFactory<A,S> factory,SavedActivity saved,UUID owner,Map<String,String> answers,long duration) {
        var evaluation=factory.createEvaluator().evaluate(factory.activityClass().cast(saved.content()),factory.submission(answers));
        var feedback=factory.createFeedbackPolicy();
        var items=evaluation.items().stream().map(item->new AttemptResult.QuestionFeedback(item.id(),item.correct(),item.submitted(),item.expected(),item.rationale(),
                feedback.feedbackFor(new Evaluation(List.of(item))))).toList();
        return new AttemptResult(UUID.randomUUID(),UUID.randomUUID(),owner,saved.subjectId(),saved.activityId(),factory.family(),evaluation.score(),evaluation.percentage(),
                evaluation.points(),evaluation.total(),duration,clock.instant(),feedback.feedbackFor(evaluation),items);
    }
    @Override public AttemptResult result(UUID owner,UUID activity,UUID attempt) {
        get(owner,activity); var result=activities.result(activity,attempt).orElseThrow(()->new BusinessException(NOT_FOUND,"Intento no encontrado."));
        if(!result.studentId().equals(owner)) throw new BusinessException(FORBIDDEN,"No tienes acceso a este intento."); return result;
    }
    private void writable(UUID owner,UUID subject) {
        if(subjects.get(owner,subject).archived()) throw new BusinessException(CONFLICT,"La materia está archivada.");
    }
    private String fingerprint(Map<String,String> answers,long duration) {
        try {
            var bytes=new java.io.ByteArrayOutputStream(); var stream=new java.io.DataOutputStream(bytes); stream.writeLong(duration);
            for(var entry:new TreeMap<>(answers).entrySet()) { stream.writeUTF(entry.getKey()); stream.writeUTF(entry.getValue()); }
            return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes.toByteArray()));
        } catch(java.io.IOException | java.security.NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
    }
}
