package com.siare.core.application.port.in;

import com.siare.core.domain.draft.AcademicDraft;
import java.util.UUID;

public interface GenerateAcademicDraftUseCase {
    AcademicDraft.Response generate(UUID authenticatedUser, UUID subject, AcademicDraft.Selection selection);
}
