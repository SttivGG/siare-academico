import { Router } from "express";
import { healthController } from "../controllers/health.controller.js";
import type { HealthModel } from "../models/health.model.js";

export function healthRoutes(model: HealthModel) {
  const router = Router();
  router.get("/health", healthController(model));
  return router;
}
