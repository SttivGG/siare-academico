package com.siare.core.domain.account;

import java.time.Instant;
import java.util.UUID;

public record User(UUID id, String name, String email, String passwordHash, Instant createdAt) {
    @Override public String toString() { return "User[id=" + id + "]"; }
}
