package com.siare.core.application.service;

import com.siare.core.domain.draft.DraftGenerationException;
import java.time.*;
import java.util.*;

/** Bounded per-instance admission: no waiting queue and no automatic retry. */
public final class DraftAdmission {
    private record Window(Instant until, int count) {}
    private final Clock clock;
    private final Map<UUID, Window> windows = new HashMap<>();
    private final Set<UUID> active = new HashSet<>();
    public DraftAdmission(Clock clock) { this.clock = clock; }
    public synchronized Lease acquire(UUID user) {
        Instant now = clock.instant();
        windows.entrySet().removeIf(e -> !e.getValue().until().isAfter(now));
        var window = windows.get(user);
        if (window != null && window.count() >= 6) throw new DraftGenerationException(429, "GENERATOR_BUSY", 60);
        if (!active.isEmpty() || windows.size() >= 4096 && window == null)
            throw new DraftGenerationException(429, "GENERATOR_BUSY", 5);
        windows.put(user, new Window(window == null ? now.plusSeconds(60) : window.until(), window == null ? 1 : window.count() + 1));
        active.add(user); return new Lease(user);
    }
    public final class Lease implements AutoCloseable {
        private final UUID user;
        private boolean closed;
        private Lease(UUID user) { this.user = user; }
        @Override public void close() {
            synchronized (DraftAdmission.this) { if (!closed) { active.remove(user); closed = true; } }
        }
    }
}
