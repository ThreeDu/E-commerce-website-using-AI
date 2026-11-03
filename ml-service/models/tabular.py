"""
Mô hình bảng dùng chung cho rời bỏ / tiềm năng (phân loại) và CLV (hồi quy).

- HistGradientBoosting: không cần chuẩn hóa, chịu được dữ liệu nhỏ và giá trị lệch.
  Hồi quy dùng loss Poisson: mục tiêu là tiền (không âm, lệch phải, nhiều giá trị 0).
- Đánh giá bằng out-of-fold với GroupKFold theo khách hàng (một khách có nhiều snapshot,
  không được nằm ở cả train lẫn test), kèm baseline một đặc trưng để thấy mô hình có hơn
  một luật đơn giản hay không.
- Độ quan trọng đặc trưng = permutation importance trên fold kiểm tra (không dùng
  impurity của cây vốn thiên vị đặc trưng nhiều giá trị).
- Lưu một file joblib gồm estimator + danh sách đặc trưng + metrics + version sklearn.
"""

import os
import warnings
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.inspection import permutation_importance
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    f1_score,
    mean_absolute_error,
    r2_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupKFold

from config import MODEL_DIR

RANDOM_STATE = 42


def _round(value):
    return None if value is None or np.isnan(value) else round(float(value), 4)


class TabularModel:
    def __init__(self, name, kind, feature_names, baseline=None, model_dir=MODEL_DIR):
        """
        kind: "classifier" (dự đoán xác suất lớp 1) hoặc "regressor" (giá trị không âm).
        baseline: (tên đặc trưng, dấu) — điểm baseline = dấu * đặc trưng, dùng để so sánh.
        """
        if kind not in ("classifier", "regressor"):
            raise ValueError(kind)
        self.name = name
        self.kind = kind
        self.feature_names = list(feature_names)
        self.baseline = baseline
        self.path = os.path.join(model_dir, f"{name}.joblib")
        self.estimator = None
        self.metrics = {}
        self.importance = {}
        self.trained_at = None

    # ── huấn luyện ────────────────────────────────────────────────────────────
    def _new_estimator(self):
        params = dict(max_iter=200, learning_rate=0.05, max_depth=3, l2_regularization=1.0, random_state=RANDOM_STATE)
        if self.kind == "classifier":
            return HistGradientBoostingClassifier(**params)
        return HistGradientBoostingRegressor(loss="poisson", **params)

    def _matrix(self, X):
        return X[self.feature_names].fillna(0).to_numpy(dtype=float)

    def _raw_predict(self, estimator, X):
        if self.kind == "classifier":
            return estimator.predict_proba(X)[:, 1]
        return estimator.predict(X)

    def fit_evaluate(self, X, y, groups):
        """Đánh giá out-of-fold theo nhóm khách hàng, rồi huấn luyện mô hình cuối trên toàn bộ dữ liệu."""
        X_mat = self._matrix(X)
        y = np.asarray(y)
        groups = np.asarray(groups)
        n_splits = min(5, len(np.unique(groups)))
        if n_splits < 2:
            raise ValueError("Cần ít nhất 2 khách hàng để đánh giá.")

        oof = np.full(len(y), np.nan)
        importance = None
        for fold, (train_idx, test_idx) in enumerate(GroupKFold(n_splits=n_splits).split(X_mat, y, groups)):
            y_train = y[train_idx]
            if self.kind == "classifier" and len(np.unique(y_train)) < 2:
                oof[test_idx] = y_train.mean()
                continue
            est = self._new_estimator().fit(X_mat[train_idx], y_train)
            oof[test_idx] = self._raw_predict(est, X_mat[test_idx])
            if importance is None:
                importance = self._permutation_importance(est, X_mat[test_idx], y[test_idx])

        self.metrics = self._evaluate(y, oof, X)
        self.metrics.update({"samples": int(len(y)), "customers": int(len(np.unique(groups))), "cv_folds": n_splits})
        self.importance = importance or {}

        self.estimator = self._new_estimator().fit(X_mat, y)
        self.trained_at = datetime.now(timezone.utc).isoformat()
        return self.metrics

    def _permutation_importance(self, estimator, X_test, y_test):
        scoring = "neg_brier_score" if self.kind == "classifier" else "neg_mean_absolute_error"
        result = permutation_importance(
            estimator, X_test, y_test, scoring=scoring, n_repeats=5, random_state=RANDOM_STATE
        )
        values = np.clip(result.importances_mean, 0, None)
        total = values.sum()
        values = values / total if total > 0 else values
        return {name: round(float(v), 4) for name, v in zip(self.feature_names, values)}

    def _evaluate(self, y, pred, X):
        baseline = None
        if self.baseline:
            feature, sign = self.baseline
            baseline = sign * X[feature].fillna(0).to_numpy(dtype=float)

        if self.kind == "classifier":
            two_classes = len(np.unique(y)) == 2
            metrics = {
                "base_rate": _round(y.mean()),
                "roc_auc": _round(roc_auc_score(y, pred)) if two_classes else None,
                "pr_auc": _round(average_precision_score(y, pred)) if two_classes else None,
                "f1": _round(f1_score(y, pred >= 0.5, zero_division=0)),
                "brier": _round(brier_score_loss(y, pred)),
            }
            if baseline is not None and two_classes:
                metrics["baseline"] = {"feature": self.baseline[0], "roc_auc": _round(roc_auc_score(y, baseline))}
            return metrics

        metrics = {
            "mean_target": _round(y.mean()),
            "mae": _round(mean_absolute_error(y, pred)),
            "r2": _round(r2_score(y, pred)),
            "spearman": _round(pd.Series(pred).corr(pd.Series(y), method="spearman")),
        }
        # Baseline hồi quy: luôn dự đoán trung vị
        metrics["baseline"] = {"strategy": "median", "mae": _round(mean_absolute_error(y, np.full(len(y), np.median(y))))}
        return metrics

    # ── dự đoán / lưu ─────────────────────────────────────────────────────────
    @property
    def is_trained(self):
        return self.estimator is not None

    def predict(self, X):
        """Xác suất (classifier) hoặc giá trị dự đoán (regressor) cho DataFrame có đủ cột đặc trưng."""
        if not self.is_trained:
            raise RuntimeError(f"Model '{self.name}' not trained yet.")
        return self._raw_predict(self.estimator, self._matrix(X))

    def save(self):
        joblib.dump({
            "estimator": self.estimator,
            "kind": self.kind,
            "feature_names": self.feature_names,
            "metrics": self.metrics,
            "importance": self.importance,
            "trained_at": self.trained_at,
            "sklearn_version": sklearn.__version__,
        }, self.path)

    def load(self):
        if not os.path.exists(self.path):
            return False
        bundle = joblib.load(self.path)
        if bundle.get("kind") != self.kind:
            raise ValueError(f"{self.path}: kind {bundle.get('kind')} != {self.kind}")
        if bundle.get("sklearn_version") != sklearn.__version__:
            warnings.warn(
                f"{self.name}: model lưu bằng scikit-learn {bundle.get('sklearn_version')}, "
                f"đang chạy {sklearn.__version__}; nên huấn luyện lại."
            )
        self.estimator = bundle["estimator"]
        self.feature_names = bundle["feature_names"]
        self.metrics = bundle.get("metrics", {})
        self.importance = bundle.get("importance", {})
        self.trained_at = bundle.get("trained_at")
        return True
