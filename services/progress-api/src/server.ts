import { createApp } from "./app.js";
import { startAnalyticsDelivery } from "./models/analytics-delivery.js";
import { createClickHouseAnalytics } from "./models/analytics.model.js";
import type { AttemptEvent } from "./models/attempt-event.js";
import { createCacheGenerations } from "./models/cache-generations.js";
import { createQueryCache } from "./models/query-cache.js";
import { connectRedisCache } from "./models/redis-cache.js";
import { createCassandraAttemptModel } from "./models/attempt.model.js";
import { createCassandraHealthModel } from "./models/health.model.js";
import { createCassandraProgressModel } from "./models/progress.model.js";

const { client, model, close } = createCassandraHealthModel();
const progress = createCassandraProgressModel(client);
const {
  CLICKHOUSE_URL: url, CLICKHOUSE_USER: username,
  CLICKHOUSE_PASSWORD: password, CLICKHOUSE_DB: database,
} = process.env;
const analytics = url && username && password && database
  ? createClickHouseAnalytics({ url, username, password, database })
  : undefined;
const redis = process.env.PROGRESS_REDIS_URL && process.env.REDIS_PASSWORD
  ? connectRedisCache(process.env.PROGRESS_REDIS_URL, process.env.REDIS_PASSWORD)
  : undefined;
const configuredTtl = Number(process.env.PROGRESS_CACHE_TTL_SECONDS);
const ttl = Number.isInteger(configuredTtl) && configuredTtl >= 1 && configuredTtl <= 300 ? configuredTtl : 60;
const cache = createQueryCache(createCacheGenerations(client), redis?.store, ttl);
const stopAnalytics = analytics
  ? startAnalyticsDelivery(client, analytics, (scope) => cache.invalidate("indicators", scope))
  : undefined;

async function applyProgress(event: AttemptEvent) {
  await progress.apply(event);
  await cache.invalidate("progress", event);
}

const app = createApp(model, {
  model: createCassandraAttemptModel(client, applyProgress),
  progress: {
    list: (scope, limit, after) =>
      cache.read("progress", scope, [limit, after], () => progress.list(scope, limit, after)),
  },
  analytics: analytics && {
    indicators: (window) => cache.read("indicators", window, [window.from, window.to], () => analytics.indicators(window)),
  },
  cacheMetrics: cache.metrics,
  token: process.env.PROGRESS_SERVICE_TOKEN,
});
const server = app.listen(3001, "0.0.0.0", () => {
  console.log("progress-api listening on port 3001");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    const timeout = setTimeout(() => process.exit(1), 15000).unref();
    const analyticsStopped = stopAnalytics?.() ?? Promise.resolve();
    server.close(() => {
      redis?.close();
      analyticsStopped.then(close).then(() => { clearTimeout(timeout); process.exit(0); })
        .catch(() => process.exit(1));
    });
  });
}
