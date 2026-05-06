"""
Churn Prediction Model — Random Forest Classifier.

Predicts the probability that a customer will churn (stop purchasing).
"""

import os
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler

from config import MODEL_DIR

CHURN_MODEL_PATH = os.path.join(MODEL_DIR, "churn_model.joblib")
CHURN_SCALER_PATH = os.path.join(MODEL_DIR, "churn_scaler.joblib")


class ChurnPredictor:
    def __init__(self):
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=8,
            min_samples_leaf=5,
            class_weight="balanced",
            random_state=42,
        )
        self.scaler = StandardScaler()
        self._is_trained = False

    def train(self, X, y):
        """Train the churn model. Returns metrics dict."""
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)
        self._is_trained = True

        # Cross-validation metrics
        unique_classes = np.unique(y)
        if len(unique_classes) < 2:
            return {
                "f1_mean": 0.0,
                "f1_std": 0.0,
                "accuracy": float(np.mean(y == 0)),
                "note": "Only one class in training data — model will default-predict.",
            }

        n_splits = min(5, min(np.bincount(y)))
        n_splits = max(2, n_splits)

        f1_scores = cross_val_score(
            self.model, X_scaled, y, cv=n_splits, scoring="f1"
        )
        acc_scores = cross_val_score(
            self.model, X_scaled, y, cv=n_splits, scoring="accuracy"
        )

        return {
            "f1_mean": round(float(f1_scores.mean()), 4),
            "f1_std": round(float(f1_scores.std()), 4),
            "accuracy": round(float(acc_scores.mean()), 4),
        }

    def predict(self, X):
        """Return churn probabilities (0.0 – 1.0) for each row."""
        if not self._is_trained:
            raise RuntimeError("Model not trained yet.")
        X_scaled = self.scaler.transform(X)
        return self.model.predict_proba(X_scaled)[:, 1]

    def feature_importance(self, feature_names):
        """Return dict of feature name → importance score."""
        if not self._is_trained:
            return {}
        return dict(zip(feature_names, self.model.feature_importances_.tolist()))

    def save(self):
        joblib.dump(self.model, CHURN_MODEL_PATH)
        joblib.dump(self.scaler, CHURN_SCALER_PATH)

    def load(self):
        if os.path.exists(CHURN_MODEL_PATH) and os.path.exists(CHURN_SCALER_PATH):
            self.model = joblib.load(CHURN_MODEL_PATH)
            self.scaler = joblib.load(CHURN_SCALER_PATH)
            self._is_trained = True
            return True
        return False

    @property
    def is_trained(self):
        return self._is_trained
