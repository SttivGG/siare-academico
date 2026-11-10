package com.siare.core.domain.subject;

import com.siare.core.domain.account.AccountRules;
import com.siare.core.domain.account.BusinessException;
import java.time.Instant;
import java.util.UUID;
import static com.siare.core.domain.account.BusinessException.Kind.*;

public record Subject(UUID id, UUID userId, String name, String description, boolean archived,
                      Instant createdAt, Instant updatedAt) {
    public Subject {
        name = AccountRules.name(name, 120);
        description = description == null || description.isBlank() ? null : description.strip();
        if (description != null && description.length() > 2000) {
            throw new BusinessException(VALIDATION, "La descripción admite hasta 2000 caracteres.");
        }
    }

    public void requireOwner(UUID owner) {
        if (!userId.equals(owner)) throw new BusinessException(FORBIDDEN, "No tienes acceso a esta materia.");
    }

    public Subject update(String name, String description, Instant now) {
        if (archived) throw new BusinessException(VALIDATION, "Una materia archivada no se puede editar.");
        return new Subject(id, userId, name, description, false, createdAt, now);
    }

    public Subject archive(Instant now) {
        return archived ? this : new Subject(id, userId, name, description, true, createdAt, now);
    }
}
