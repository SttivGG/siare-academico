import express from "express";
import type { ErrorRequestHandler } from "express";
import type { AttemptModel } from "./models/attempt.model.js";
import type { HealthModel } from "./models/health.model.js";
import { attemptRoutes } from "./routes/attempt.routes.js";
import { healthRoutes } from "./routes/health.routes.js";

export function createApp(model: HealthModel, attempts?: { model: AttemptModel; token?: string }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(healthRoutes(model));
  if (attempts) app.use(attemptRoutes(attempts.model, attempts.token));
  const errorHandler: ErrorRequestHandler = (_error, _request, response, _next) => {
    response.status(503).json({ service: "progress-api", status: "DOWN" });
  };
  app.use(errorHandler);
  return app;
}
