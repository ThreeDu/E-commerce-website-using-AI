"""
Customer Lifetime Value (CLV) Predictor Model — Gradient Boosting Regressor.

Predicts a score (0–100) indicating the expected lifetime value of a customer over the next 6 months.
"""

import os
import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler

from config import MODEL_DIR

CLV_MODEL_PATH = os.path.join(MODEL_DIR, "clv_model.joblib")
CLV_SCALER_PATH = os.path.join(MODEL_DIR, "clv_scaler.joblib")

class CLVPredictor:
    def __init__(self):
        self.model = GradientBoostingRegressor(
            n_estimators=120,
            max_depth=5,
            learning_rate=0.08,
            random_state=42,
        )
        self.scaler = StandardScaler()
        self._is_trained = False

    def train(self, X, y):
        """Train the CLV model. Returns metrics dict."""
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)
        self._is_trained = True

        r2 = self.model.score(X_scaled, y)
        return {
            "r2_score": round(float(r2), 4),
        }

    def predict(self, X):
        """Return predicted CLV scores (0–100) for each row."""
        if not self._is_trained:
            raise RuntimeError("Model not trained yet.")
        X_scaled = self.scaler.transform(X)
        scores = self.model.predict(X_scaled)
        return np.clip(scores, 0, 100).round(2)

    def feature_importance(self, feature_names):
        """Return dict of feature name → importance score."""
        if not self._is_trained:
            return {}
        return dict(zip(feature_names, self.model.feature_importances_.tolist()))

    def save(self):
        joblib.dump(self.model, CLV_MODEL_PATH)
        joblib.dump(self.scaler, CLV_SCALER_PATH)

    def load(self):
        if os.path.exists(CLV_MODEL_PATH) and os.path.exists(CLV_SCALER_PATH):
            self.model = joblib.load(CLV_MODEL_PATH)
            self.scaler = joblib.load(CLV_SCALER_PATH)
            self._is_trained = True
            return True
        return False

    @property
    def is_trained(self):
        return self._is_trained
