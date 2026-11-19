package com.siare.core.infrastructure.config;

import com.siare.core.application.port.in.*;
import com.siare.core.application.port.out.*;
import com.siare.core.application.service.*;
import com.siare.core.domain.draft.DraftGenerationException;
import java.time.Clock;
import org.springframework.context.annotation.*;

/** Production has no HTTP generator binding. Activation requires a reviewed integration change. */
@Configuration(proxyBeanMethods = false)
public class AcademicDraftConfiguration {
    @Bean AcademicDraftGenerator academicDraftGenerator() {
        return request -> { throw new DraftGenerationException(503, "GENERATION_DISABLED"); };
    }
    @Bean GenerateAcademicDraftService generateAcademicDraft(IdentityRepository identities, SubjectUseCase subjects,
            DocumentRepository documents, AcademicDraftGenerator generator, Clock clock) {
        return new GenerateAcademicDraftService(identities, subjects, documents, generator, new DraftAdmission(clock));
    }
    @Bean AcademicDraftUseCase academicDrafts(GenerateAcademicDraftService generation, AcademicDraftRepository drafts,
            ActivityUseCase activities, TransactionPort tx, Clock clock) {
        return new AcademicDraftService(generation, drafts, activities, tx, clock);
    }
}
