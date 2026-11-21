import { createApp } from "./app.js";
import { startAnalyticsDelivery } from "./models/analytics-delivery.js";
import { createClickHouseAnalytics } from "./models/analytics.model.js";
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
const stopAnalytics = analytics ? startAnalyticsDelivery(client, analytics) : undefined;
const app = createApp(model, {
  model: createCassandraAttemptModel(client, progress.apply),
  progress,
  analytics,
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
      analyticsStopped.then(close).then(() => { clearTimeout(timeout); process.exit(0); })
        .catch(() => process.exit(1));
    });
  });
}
