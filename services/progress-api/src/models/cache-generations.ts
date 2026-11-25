import cassandra from "cassandra-driver";
import type { ProgressScope } from "./progress.model.js";

export type CachedView = "progress" | "indicators";

export interface CacheGenerations {
  current(view: CachedView, scope: ProgressScope): Promise<string>;
  advance(view: CachedView, scope: ProgressScope): Promise<void>;
}

const options: cassandra.QueryOptions = {
  prepare: true,
  consistency: cassandra.types.consistencies.localQuorum,
  serialConsistency: cassandra.types.consistencies.localSerial,
};
const table = "siare_progress.cache_generations";
const predicate = "student_id = ? AND subject_id = ? AND cache_kind = ?";

function key(view: CachedView, scope: ProgressScope) {
  return [cassandra.types.Uuid.fromString(scope.studentId), cassandra.types.Uuid.fromString(scope.subjectId), view];
}

export function createCacheGenerations(client: cassandra.Client): CacheGenerations {
  return {
    async current(view, scope) {
      const result = await client.execute("SELECT generation FROM " + table + " WHERE " + predicate, key(view, scope), options);
      return result.first()?.generation.toString() ?? "initial";
    },

    async advance(view, scope) {
      const identifiers = key(view, scope);
      const generation = cassandra.types.Uuid.random();
      const replace = "UPDATE " + table + " SET generation = ? WHERE " + predicate + " IF EXISTS";
      const values = [generation, ...identifiers];

      if ((await client.execute(replace, values, options)).wasApplied()) return;
      const initialized = await client.execute(
        "INSERT INTO " + table + " (student_id, subject_id, cache_kind, generation) VALUES (?, ?, ?, ?) IF NOT EXISTS",
        [...identifiers, generation],
        options,
      );
      if (initialized.wasApplied()) return;
      // Another writer initialized this scope concurrently. Confirm our invalidation too.
      if (!(await client.execute(replace, values, options)).wasApplied()) {
        throw new Error("Cache generation could not be advanced");
      }
    },
  };
}
