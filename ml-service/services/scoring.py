"""
Chấm điểm khách hàng: nạp các mô hình đã huấn luyện và trả về DataFrame đặc trưng + điểm.

Điểm (0-100) trả cho API:
  - churn_score:     xác suất khách đã từng mua sẽ không mua lại trong CHURN_HORIZON_DAYS ngày
  - potential_score: xác suất phát sinh đơn trong POTENTIAL_HORIZON_DAYS ngày tới
  - clv_score:       thứ hạng phần trăm của chi tiêu dự đoán (predicted_spend, VND) trong
                     CLV_HORIZON_DAYS ngày tới so với các khách khác
"""

import numpy as np
import pandas as pd

from config import LEVEL_HIGH_ABOVE, LEVEL_MEDIUM_ABOVE
from data.firestore import load_customer_data, utcnow
from features.customer_features import MODEL_FEATURES, build_customer_features
from features.segmentation import segment_customers
from models.recommendation_model import RecommendationPredictor
from models.tabular import TabularModel


def create_models():
    return {
        "churn": TabularModel("churn", "classifier", MODEL_FEATURES, baseline=("recency_days", 1)),
        "potential": TabularModel("potential", "classifier", MODEL_FEATURES, baseline=("recency_days", -1)),
        "clv": TabularModel("clv", "regressor", MODEL_FEATURES),
    }


models = create_models()
recommendation_model = RecommendationPredictor()


def load_models():
    """Nạp (lại) toàn bộ mô hình từ saved_models/. Trả về dict tên -> đã nạp được hay chưa."""
    global models, recommendation_model
    models = create_models()
    recommendation_model = RecommendationPredictor()
    status = {name: model.load() for name, model in models.items()}
    status["recommendation"] = recommendation_model.load()
    return status


def is_ready(*names):
    return all(models[name].is_trained for name in names)


def classify_level(score):
    if score > LEVEL_HIGH_ABOVE:
        return "high"
    if score > LEVEL_MEDIUM_ABOVE:
        return "medium"
    return "low"


def level_distribution(scores):
    levels = [classify_level(s) for s in scores]
    return {level: levels.count(level) for level in ("low", "medium", "high")}


def customer_features(user_id=None):
    """Đặc trưng tại thời điểm hiện tại cho tất cả khách (hoặc một khách)."""
    return build_customer_features(load_customer_data(user_id=user_id), utcnow())


def score_customers(user_id=None, df=None):
    """
    DataFrame đặc trưng + churn/potential/clv score, level và segment.
    clv_score (thứ hạng) chỉ có nghĩa khi chấm cả tập khách; với một khách chỉ trả predicted_spend.
    """
    df = customer_features(user_id) if df is None else df
    if df.empty:
        return df
    df = df.copy()

    df["churn_score"] = (models["churn"].predict(df) * 100).round(1)
    df["potential_score"] = (models["potential"].predict(df) * 100).round(1)

    if models["clv"].is_trained:
        spend = models["clv"].predict(df)
        df["predicted_spend"] = np.round(spend, 0)
        df["clv_score"] = (pd.Series(spend).rank(pct=True, method="average") * 100).round(1).to_numpy()
    else:
        df["predicted_spend"] = 0.0
        df["clv_score"] = 0.0

    for col in ("churn", "potential", "clv"):
        df[f"{col}_level"] = df[f"{col}_score"].apply(classify_level)

    return segment_customers(df)
