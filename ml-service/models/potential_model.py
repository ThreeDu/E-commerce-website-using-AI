"""
Potential Customer Scoring Model — Gradient Boosting Regressor.

Predicts a score (0–100) indicating how likely a customer is to become
a high-value buyer.
"""

import os
import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler

from config import MODEL_DIR

POTENTIAL_MODEL_PATH = os.path.join(MODEL_DIR, "potential_model.joblib")
POTENTIAL_SCALER_PATH = os.path.join(MODEL_DIR, "potential_scaler.joblib")


class PotentialScorer:
    def __init__(self):
        self.model = GradientBoostingRegressor(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42,
        )
        self.scaler = StandardScaler()
        self._is_trained = False

    def train(self, X, y):
        """Train the potential model. Returns metrics dict."""
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)
        self._is_trained = True

        r2 = self.model.score(X_scaled, y)
        return {
            "r2_score": round(float(r2), 4),
        }

    def predict(self, X):
        """Return potential scores (0–100) for each row."""
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
        joblib.dump(self.model, POTENTIAL_MODEL_PATH)
        joblib.dump(self.scaler, POTENTIAL_SCALER_PATH)

    def load(self):
        if os.path.exists(POTENTIAL_MODEL_PATH) and os.path.exists(POTENTIAL_SCALER_PATH):
            self.model = joblib.load(POTENTIAL_MODEL_PATH)
            self.scaler = joblib.load(POTENTIAL_SCALER_PATH)
            self._is_trained = True
            return True
        return False

    @property
    def is_trained(self):
        return self._is_trained
