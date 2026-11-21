import { createApp } from "./app.js";
import { createCassandraAttemptModel } from "./models/attempt.model.js";
import { createCassandraHealthModel } from "./models/health.model.js";

const { client, model, close } = createCassandraHealthModel();
const app = createApp(model, {
  model: createCassandraAttemptModel(client),
  token: process.env.PROGRESS_SERVICE_TOKEN,
});
const server = app.listen(3001, "0.0.0.0", () => {
  console.log("progress-api listening on port 3001");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    const timeout = setTimeout(() => process.exit(1), 15000).unref();
    server.close(() => {
      close().then(() => { clearTimeout(timeout); process.exit(0); })
        .catch(() => process.exit(1));
    });
  });
}
