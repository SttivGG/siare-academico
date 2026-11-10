import type { Request, Response } from "express";
import type { HealthModel } from "../models/health.model.js";
import { healthView } from "../views/health.view.js";

export function healthController(model: HealthModel) {
  return async (_request: Request, response: Response) => {
    const ready = await model.isReady();
    response.status(ready ? 200 : 503).json(healthView(ready));
  };
}
