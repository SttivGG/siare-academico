"""Pruebas de la regresión logística con datos sintéticos reproducibles."""

import unittest

from app.ml.inference.model_registry import ModelRegistry
from app.ml.models.logistic_risk import LogisticRiskModel
from app.ml.training.dataset import split_by_position
from app.ml.training.evaluator import evaluate_logistic_risk
from app.ml.training.trainer import train_logistic_risk


class LearningModelTests(unittest.TestCase):
    def setUp(self):
        self.rows = []
        for index in range(24):
            error = index % 3 != 0
            self.rows.append({
                "accuracyRate": 0.65 if index < 12 else 0.35,
                "normalizedScore": 0.70 if index < 12 else 0.30,
                "recentAccuracyTrend": 0.20 if index < 12 else -0.20,
                "attemptCount": float(index + 5),
                "recencyHours": float(index % 24),
                "consecutiveErrors": float(index % 4 if error else 0),
                "label": 1 if error else 0,
            })

    def test_training_requires_both_classes(self):
        with self.assertRaises(ValueError):
            train_logistic_risk([{"label": 0, "accuracyRate": 1, "normalizedScore": 1,
                                  "recentAccuracyTrend": 0, "attemptCount": 10,
                                  "recencyHours": 1, "consecutiveErrors": 0}] * 10)

    def test_model_exports_safe_json_parameters(self):
        train_rows, test_rows = split_by_position(self.rows, 0.7)
        model = train_logistic_risk(train_rows)
        parameters = model.to_parameters()

        self.assertEqual(parameters["modelVersion"], "ml-v1")
        self.assertEqual(parameters["algorithm"], "logistic_regression")
        self.assertEqual(len(parameters["coefficients"]), 6)
        risk = model.predict_risk([0.4, 0.4, -0.1, 15, 12, 2])
        self.assertGreaterEqual(risk, 0.0)
        self.assertLessEqual(risk, 1.0)

        metrics = evaluate_logistic_risk(model, test_rows)
        self.assertIn("confusionMatrix", metrics)
        self.assertIn("f1", metrics)

    def test_model_reloads_from_safe_parameters(self):
        """Comprueba que un artefacto exportado pueda reconstruirse sin pickle."""
        train_rows, _ = split_by_position(self.rows, 0.7)
        trained = train_logistic_risk(train_rows)
        parameters = trained.to_parameters()

        reloaded = LogisticRiskModel.from_parameters(parameters)

        self.assertEqual(reloaded.model_version, trained.model_version)
        self.assertEqual(reloaded._feature_names, trained._feature_names)
        risk = reloaded.predict_risk([0.4, 0.4, -0.1, 15, 12, 2])
        self.assertGreaterEqual(risk, 0.0)
        self.assertLessEqual(risk, 1.0)

    def test_model_registry_resolves_registered_version(self):
        """Verifica el registro por modelVersion y la degradación baseline."""
        train_rows, _ = split_by_position(self.rows, 0.7)
        model = train_logistic_risk(train_rows)
        registry = ModelRegistry()
        registry.register(model)

        self.assertIs(registry.resolve("ml-v1"), model)
        self.assertIsNone(registry.resolve("baseline-error-rate-v1"))
        self.assertIsNone(registry.resolve("not-registered"))

    def test_model_parameters_reject_invalid_dimensions(self):
        """Rechaza artefactos que no coinciden con el número de características."""
        train_rows, _ = split_by_position(self.rows, 0.7)
        parameters = train_logistic_risk(train_rows).to_parameters()
        parameters["coefficients"] = [0.1]

        with self.assertRaises(ValueError):
            LogisticRiskModel.from_parameters(parameters)

    def test_inference_service_uses_loaded_model_without_training(self):
        """Verifica inferencia supervisada usando un modelo ya reconstruido."""
        train_rows, _ = split_by_position(self.rows, 0.7)
        model = train_logistic_risk(train_rows)

        from datetime import datetime, timezone
        from app.ml.contracts import Attempt
        from app.ml.inference.inference_service import LearningInferenceService

        attempts = []
        for index in range(5):
            attempts.append(Attempt(
                activity_id=f"00000000-0000-4000-8000-{index + 1:012d}",
                topic_id="fracciones",
                correct=index % 2 == 0,
                score=0.8 if index % 2 == 0 else 0.2,
                max_score=1.0,
                occurred_at=datetime(2026, 11, index + 1, tzinfo=timezone.utc),
            ))

        result = LearningInferenceService(model).analyze_topics(["fracciones"], attempts)

        self.assertEqual(result["modelVersion"], "ml-v1")
        self.assertFalse(result["insufficientEvidence"])
        self.assertGreaterEqual(result["riskTopics"][0]["riskScore"], 0.0)
        self.assertLessEqual(result["riskTopics"][0]["riskScore"], 1.0)


if __name__ == "__main__":
    unittest.main()
