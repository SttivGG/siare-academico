package com.siare.core.application.port.out;

import com.siare.core.domain.draft.AcademicDraft;

/** Provider-independent outbound port. No persistence, evaluation or publication authority. */
@FunctionalInterface
public interface AcademicDraftGenerator {
    AcademicDraft.Response generate(AcademicDraft.Request request);
}
