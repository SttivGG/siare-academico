import { createApp } from "./app.js";
import { createCassandraHealthModel } from "./models/health.model.js";

const { model, close } = createCassandraHealthModel();
const server = createApp(model).listen(3001, "0.0.0.0", () => {
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
