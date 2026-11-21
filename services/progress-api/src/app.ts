import express from "express";
import type { ErrorRequestHandler } from "express";
import type { AnalyticsReader } from "./models/analytics.model.js";
import type { AttemptModel } from "./models/attempt.model.js";
import type { HealthModel } from "./models/health.model.js";
import type { ProgressModel } from "./models/progress.model.js";
import { analyticsRoutes } from "./routes/analytics.routes.js";
import { attemptRoutes } from "./routes/attempt.routes.js";
import { healthRoutes } from "./routes/health.routes.js";
import { progressRoutes } from "./routes/progress.routes.js";

interface InternalServices {
  model: AttemptModel;
  token?: string;
  progress?: ProgressModel;
  analytics?: AnalyticsReader;
}

export function createApp(model: HealthModel, attempts?: InternalServices) {
  const app = express();
  app.disable("x-powered-by");
  app.use(healthRoutes(model));
  if (attempts) {
    app.use(attemptRoutes(attempts.model, attempts.token));
    app.use(analyticsRoutes(attempts.analytics, attempts.token));
  }
  if (attempts?.progress) app.use(progressRoutes(attempts.progress, attempts.token));
  const errorHandler: ErrorRequestHandler = (_error, _request, response, _next) => {
    response.status(503).json({ service: "progress-api", status: "DOWN" });
  };
  app.use(errorHandler);
  return app;
}
