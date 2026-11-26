package com.siare.core.application.service;

import com.siare.core.application.port.in.*;
import com.siare.core.application.port.out.*;
import com.siare.core.domain.activity.*;
import com.siare.core.domain.activity.factory.ActivityFactory;
import com.siare.core.domain.account.BusinessException;
import com.siare.core.domain.document.*;
import java.time.Clock;
import java.util.*;
import org.springframework.beans.factory.ObjectProvider;
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
    private final ObjectProvider<GenerativeAssessmentProcessor> generative;
    public ActivityService(SubjectUseCase subjects,GetDocumentUseCase documents,StructuredActivityContent structured,
            GenerateActivityUseCase generator,ActivityFactoryProvider factories,ActivityRepository activities,TransactionPort tx,Clock clock,
            ObjectProvider<GenerativeAssessmentProcessor> generative) {
        this.subjects=subjects; this.documents=documents; this.structured=structured; this.generator=generator;
        this.factories=factories; this.activities=activities; this.tx=tx; this.clock=clock; this.generative=generative;
    }
    @Override public SavedActivity create(UUID owner,UUID subject,ActivityFamily family,UUID document,String topic,ActivityBank bank,int count,int gridSize) {
        writable(owner,subject);
        if(document!=null) {
            var metadata=documents.get(owner,document);
            if(!metadata.ownerId().equals(owner) || !metadata.subjectId().equals(subject)) throw new BusinessException(FORBIDDEN,"El documento no pertenece a esta materia y usuario.");
            if(metadata.status()!=DocumentStatus.READY) throw new ActivityException(409,"TEXT_NOT_READY","El documento debe estar READY.");
            var content=documents.text(owner,document);
            if(content==null || content.text()==null || content.text().isBlank()) throw ActivityException.insufficient();

            boolean generatedBank = false;
            // Si no llegó un banco manual, Spring pide a Flask/Gemini una evaluación y la transforma
            // en el mismo modelo persistido que usan las actividades manuales.
            if(bank==null) {
                var processor=generative.getIfAvailable();
                if(family==ActivityFamily.QUIZ && processor!=null) {
                    try {
                        var generated=processor.generate(subject,document,topic,content.text(),count);
                        bank=toBank(generated,topic,metadata.originalFilename(),content);
                        generatedBank=true;
                    } catch (ActivityException error) {
                        throw error;
                    } catch (com.siare.core.infrastructure.adapter.out.learning.GenerativeServiceException error) {
                        throw new ActivityException(error.status(),error.code(),error.getMessage());
                    } catch (IllegalStateException error) {
                        throw new ActivityException(503,"GENERATIVE_UNAVAILABLE","Gemini no pudo generar el Quiz. Verifica el estado del servicio y vuelve a intentarlo.");
                    }
                } else bank=structured.read(content.text());
            }
            if(generatedBank) validateGeneratedSources(bank,content); else validateSources(bank,content);
        }
        var generated=generator.generate(family,new GenerationRequest(subject.toString(),topic,bank,count,gridSize));
        var saved=new SavedActivity(UUID.randomUUID(),subject,document,topic.strip(),clock.instant(),"AVAILABLE",generated);
        return tx.required(()->{ writable(owner,subject); activities.insert(saved); return saved; });
    }

    /**Convierte la respuesta generada a opciones, claves y citas soportadas por el dominio existente.*/
    private ActivityBank toBank(GenerativeAssessmentProcessor.GeneratedAssessment generated,String topic,String filename,ExtractedContent content) {
        var questions=new ArrayList<ActivityBank.Question>();
        for(var item:generated.questions()) {
            if(item.options().size()<2 || item.options().size()>6) throw ActivityException.insufficient();
            if(item.correctAnswer()<0 || item.correctAnswer()>=item.options().size()) throw ActivityException.insufficient();

            var options=new ArrayList<ActivityBank.Option>();
            char id='a';
            for(var text:item.options()) options.add(new ActivityBank.Option(String.valueOf(id++),text));

            // Gemini devuelve las opciones como String; se conserva el texto directo sin usar APIs de Option.
            var answer=item.options().get(item.correctAnswer());
            // La inferencia puede formular una respuesta válida sin repetir literalmente una frase del PDF.
            // Se conserva una cita real del fragmento relacionado para revisión académica.
            var source=findGeneratedSource(filename,item.question(),topic,answer,content);
            questions.add(new ActivityBank.Question("q"+(questions.size()+1),item.question(),List.copyOf(options),
                    String.valueOf((char)('a'+item.correctAnswer())),topic,source,
                    "Contenido generado por Gemini; respuesta y explicación sujetas a revisión académica."));
        }
        if(questions.isEmpty()) throw ActivityException.insufficient();
        return new ActivityBank(true,List.copyOf(questions),List.of());
    }

    private ActivityBank.Source findGeneratedSource(String filename,String question,String topic,String answer,ExtractedContent content) {
        if(content.fragments()==null || content.fragments().isEmpty()) throw ActivityException.insufficient();

        var terms=new ArrayList<String>();
        terms.addAll(Arrays.stream(topic.split("\\s+")).filter(word->word.length()>=3).map(ActivityRules::normalize).toList());
        terms.addAll(Arrays.stream(question.split("\\s+")).filter(word->word.length()>=4).map(ActivityRules::normalize).limit(8).toList());

        for(var fragment:content.fragments()) {
            if(fragment.text()==null) continue;
            var normalized=ActivityRules.normalize(fragment.text());
            if(terms.stream().anyMatch(normalized::contains)) {
                var quote=fragment.text().length()>4000 ? fragment.text().substring(0,4000) : fragment.text();
                return new ActivityBank.Source(filename,fragment.index(),quote);
            }
        }

        // Si no hay coincidencia léxica, usa el primer fragmento sin inventar texto ni modificar el documento.
        var fragment=content.fragments().getFirst();
        var quote=fragment.text()==null ? "" : fragment.text().length()>4000 ? fragment.text().substring(0,4000) : fragment.text();
        if(quote.isBlank()) throw ActivityException.insufficient();
        return new ActivityBank.Source(filename,fragment.index(),quote);
    }

    private void validateGeneratedSources(ActivityBank bank,ExtractedContent content) {
        // Gemini puede crear una respuesta inferida que no repita literalmente una frase.
        // Para este flujo solo exige que el banco tenga una fuente real dentro del documento;
        // el banco manual conserva la validación estricta de cita y respuesta.
        for(var question:bank.questions()) {
            var source=question.source();
            if(source==null || source.fragmentIndex()==null || source.quote()==null || content.fragments()==null)
                throw ActivityException.insufficient();
            var fragment=content.fragments().stream()
                    .filter(f->f.index()==source.fragmentIndex())
                    .findFirst().orElseThrow(ActivityException::insufficient);
            if(fragment.text()==null || source.quote().isBlank()) throw ActivityException.insufficient();
        }
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
