import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { CachedView, CacheGenerations } from "./cache-generations.js";
import type { ProgressScope } from "./progress.model.js";

export interface CacheStore {
  ready(): boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

function counters() {
  return { hits: 0, misses: 0, fallbacks: 0, errors: 0, invalidations: 0, hitTimeMs: 0, sourceReads: 0, sourceTimeMs: 0 };
}

export function createQueryCache(generations: CacheGenerations, store?: CacheStore, ttlSeconds = 60) {
  const byView = { progress: counters(), indicators: counters() };

  return {
    async read<T>(view: CachedView, scope: ProgressScope, filters: readonly unknown[], readSource: () => Promise<T>): Promise<T> {
      const stats = byView[view];
      const startedAt = performance.now();
      const load = async () => {
        const sourceStartedAt = performance.now();
        stats.sourceReads++;
        try { return await readSource(); }
        finally { stats.sourceTimeMs += performance.now() - sourceStartedAt; }
      };

      if (!store?.ready()) {
        stats.fallbacks++;
        return load();
      }

      let key: string;
      try {
        const generation = await generations.current(view, scope);
        const queryHash = createHash("sha256").update(JSON.stringify(filters)).digest("hex");
        key = ["siare:progress:v1", view, scope.studentId, scope.subjectId, generation, queryHash].join(":");
        const cached = await store.get(key);
        if (cached !== null) {
          const entry = JSON.parse(cached);
          if (entry === null || typeof entry !== "object" || !Object.hasOwn(entry, "value")) {
            throw new Error("Invalid cache envelope");
          }
          stats.hits++;
          stats.hitTimeMs += performance.now() - startedAt;
          return entry.value as T;
        }
      } catch {
        stats.fallbacks++;
        stats.errors++;
        return load();
      }

      stats.misses++;
      const value = await load();
      try {
        // A read started before an invalidation can only write to its old key.
        await store.set(key, JSON.stringify({ value }), ttlSeconds);
      } catch {
        stats.errors++;
      }
      return value;
    },

    async invalidate(view: CachedView, scope: ProgressScope) {
      await generations.advance(view, scope);
      byView[view].invalidations++;
    },

    metrics() {
      return { redisReady: store?.ready() ?? false, ttlSeconds, progress: { ...byView.progress }, indicators: { ...byView.indicators } };
    },
  };
}
