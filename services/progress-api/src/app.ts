import express from "express";
import type { ErrorRequestHandler } from "express";
import type { HealthModel } from "./models/health.model.js";
import { healthRoutes } from "./routes/health.routes.js";

export function createApp(model: HealthModel) {
  const app = express();
  app.disable("x-powered-by");
  app.use(healthRoutes(model));
  const errorHandler: ErrorRequestHandler = (_error, _request, response, _next) => {
    response.status(503).json({ service: "progress-api", status: "DOWN" });
  };
  app.use(errorHandler);
  return app;
}
