"""Khóa X-ML-Key và việc tắt huấn luyện trên Vercel (không cần database)."""

import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import app as ml_app  # noqa: E402


class ApiGuardTest(unittest.TestCase):
    def setUp(self):
        self.client = ml_app.app.test_client()

    def test_health_is_public(self):
        with patch.object(ml_app, "ML_API_KEY", "secret"):
            self.assertEqual(self.client.get("/api/intelligence/health").status_code, 200)

    def test_wrong_or_missing_key_rejected(self):
        with patch.object(ml_app, "ML_API_KEY", "secret"):
            self.assertEqual(self.client.post("/api/intelligence/train").status_code, 401)
            self.assertEqual(
                self.client.post("/api/intelligence/train", headers={"X-ML-Key": "nope"}).status_code, 401)

    def test_vercel_without_key_refuses(self):
        with patch.object(ml_app, "ML_API_KEY", ""), patch.object(ml_app, "ON_VERCEL", True):
            self.assertEqual(self.client.post("/api/intelligence/train").status_code, 503)

    def test_training_disabled_returns_403(self):
        with patch.object(ml_app, "ML_API_KEY", "secret"), \
                patch("api.routes.TRAINING_ENABLED", False), \
                patch("api.routes.run_training") as run:
            res = self.client.post("/api/intelligence/train", headers={"X-ML-Key": "secret"})
            self.assertEqual(res.status_code, 403)
            run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
