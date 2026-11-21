import assert from "node:assert/strict";
import { test } from "node:test";
import { createQueryCache } from "../dist/models/query-cache.js";

const scope = { studentId: "student", subjectId: "subject" };

test("a read that finishes after invalidation only fills the old Redis generation", async () => {
  let generation = "initial";
  const stored = new Map();
  const cache = createQueryCache({
    current: async () => generation,
    advance: async () => { generation = "new"; },
  }, {
    ready: () => true,
    get: async (key) => stored.get(key) ?? null,
    set: async (key, value, ttl) => {
      assert.equal(ttl, 60);
      stored.set(key, value);
    },
  });
  const started = Promise.withResolvers();
  const release = Promise.withResolvers();
  const pending = cache.read("indicators", scope, ["range"], async () => {
    started.resolve();
    await release.promise;
    return { count: 1 };
  });
  await started.promise;
  await cache.invalidate("indicators", scope);
  assert.deepEqual(await cache.read("indicators", scope, ["range"], async () => ({ count: 2 })), { count: 2 });
  release.resolve();
  assert.deepEqual(await pending, { count: 1 });
  assert.deepEqual(await cache.read("indicators", scope, ["range"], async () => assert.fail("Expected cache hit")), { count: 2 });
  assert.equal(cache.metrics().indicators.invalidations, 1);
  assert.equal(cache.metrics().indicators.hits, 1);
});

test("a Redis or revision failure falls back to the source", async () => {
  const generations = {
    current: async () => { throw new Error("Cassandra version is unavailable"); },
  };
  const store = {
    ready: () => true,
    get: async () => { throw new Error("Redis is unavailable"); },
  };
  for (const revisions of [generations, { current: async () => "initial" }]) {
    const cache = createQueryCache(revisions, store);
    assert.equal(await cache.read("progress", scope, [], async () => "from source"), "from source");
    assert.equal(cache.metrics().progress.fallbacks, 1);
    assert.equal(cache.metrics().progress.sourceReads, 1);
    assert.equal(cache.metrics().progress.errors, 1);
  }
});

test("simultaneous cold reads of the same key share one source read", async () => {
  const cache = createQueryCache({ current: async () => "initial" }, {
    ready: () => true,
    get: async () => null,
    set: async () => {},
  });
  const allLookups = Promise.withResolvers();
  let lookups = 0;
  const source = async () => {
    lookups++;
    await allLookups.promise;
    return 7;
  };
  const reads = Array.from({ length: 12 }, () => cache.read("progress", scope, [20], source));
  // Wait until all 12 lookups have reached the miss branch while the source is blocked.
  await new Promise((resolve) => setImmediate(resolve));
  try {
    assert.equal(lookups, 1);
    assert.equal(cache.metrics().progress.coalesced, 11);
  } finally {
    allLookups.resolve();
  }
  assert.deepEqual(await Promise.all(reads), Array(12).fill(7));
});

test("a rejected shared read releases its key for a subsequent source read", async () => {
  const cache = createQueryCache({ current: async () => "initial" }, {
    ready: () => true,
    get: async () => null,
    set: async () => {},
  });
  await assert.rejects(cache.read("progress", scope, [20], async () => { throw new Error("Source failed"); }));
  assert.equal(await cache.read("progress", scope, [20], async () => 9), 9);
});
