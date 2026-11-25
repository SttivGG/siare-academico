import { createClient } from "@redis/client";
import type { CacheStore } from "./query-cache.js";

function withinRedisDeadline<T>(operation: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Redis command timed out")), 250).unref();
    operation.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

export function connectRedisCache(url: string, password: string) {
  const client = createClient({
    url,
    password,
    disableOfflineQueue: true,
    commandsQueueMaxLength: 64,
    socket: { connectTimeout: 750, socketTimeout: 30_000 },
    pingInterval: 10_000,
  });
  // Requests account for cache failures. The Redis client reconnects in the background.
  client.on("error", () => {});
  void client.connect().catch(() => {});

  const store: CacheStore = {
    ready: () => client.isReady,
    get: (key) => withinRedisDeadline(client.get(key)),
    async set(key, value, ttlSeconds) {
      await withinRedisDeadline(client.set(key, value, { expiration: { type: "EX", value: ttlSeconds } }));
    },
  };
  return { store, close: () => { if (client.isOpen) client.destroy(); } };
}
