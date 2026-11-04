"""
Training Pipeline.

Usage:
    cd ml-service
    python -m training.train

Workflow:
    1. Nạp dữ liệu khách hàng từ Firestore.
    2. Dựng tập snapshot theo thời gian cho từng mục tiêu (đặc trưng trước mốc T,
       nhãn = hành vi thật sau T): rời bỏ, khả năng mua (tiềm năng), chi tiêu (CLV).
    3. Đánh giá out-of-fold theo khách hàng rồi huấn luyện mô hình cuối, lưu vào saved_models/.
    4. Huấn luyện lại mô hình gợi ý sản phẩm (logic giữ nguyên).
    5. Ghi metrics vào saved_models/last_training_metrics.json.
"""

import json
import os
import sys

# Cho phép chạy trực tiếp: python ml-service/training/train.py
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config import CHURN_HORIZON_DAYS, CLV_HORIZON_DAYS, MODEL_DIR, POTENTIAL_HORIZON_DAYS
from data.firestore import load_customer_data, utcnow
from features.recommendation_dataset import RECOMMEND_FEATURE_NAMES, extract_recommendation_dataset
from models.recommendation_model import RecommendationPredictor
from services.scoring import create_models
from training.datasets import TARGETS, build_snapshot_dataset

MIN_CUSTOMERS = 5

# tên mô hình -> (mục tiêu nhãn, horizon ngày)
PLAN = {
    "churn": ("churn", CHURN_HORIZON_DAYS),
    "potential": ("purchase", POTENTIAL_HORIZON_DAYS),
    "clv": ("spend", CLV_HORIZON_DAYS),
}


def _train_model(model, raw, target, horizon, now):
    data = build_snapshot_dataset(raw, target, horizon, now)
    if data.empty or data["_id"].nunique() < 2:
        return {"error": "Không đủ dữ liệu lịch sử để dựng snapshot."}
    if model.kind == "classifier" and data["target"].nunique() < 2:
        return {"error": "Nhãn chỉ có một lớp trong dữ liệu lịch sử."}

    metrics = model.fit_evaluate(data, data["target"].to_numpy(), groups=data["_id"].to_numpy())
    model.save()
    metrics.update({
        "label": TARGETS[target],
        "horizon_days": horizon,
        "snapshots": int(data["snapshot"].nunique()),
        "first_snapshot": data["snapshot"].min().isoformat(),
        "last_snapshot": data["snapshot"].max().isoformat(),
    })
    return metrics


def run_training(now=None):
    """Chạy toàn bộ pipeline. Trả về dict kết quả (có khóa "error" nếu không đủ dữ liệu)."""
    now = now or utcnow()
    print("[1/4] Loading customer data from Firestore...")
    raw = load_customer_data(events_since_days=None)  # snapshot quá khứ cần toàn bộ lịch sử sự kiện
    customer_count = len(raw["users"])
    if customer_count < MIN_CUSTOMERS:
        print(f"  [WARN] Only {customer_count} customers found. Need at least {MIN_CUSTOMERS} to train.")
        return {"error": "Not enough data", "customer_count": customer_count}
    print(f"  [OK] {customer_count} customers, {len(raw['orders'])} orders, {len(raw['events'])} events.")

    results = {"trained_at": now.isoformat() + "Z", "customer_count": customer_count}
    models = create_models()
    for step, (name, (target, horizon)) in enumerate(PLAN.items(), start=1):
        print(f"[2/4] ({step}/{len(PLAN)}) Training {name} model ({target}, {horizon}-day horizon)...")
        metrics = _train_model(models[name], raw, target, horizon, now)
        results[f"{name}_metrics"] = metrics
        results[f"{name}_feature_importance"] = models[name].importance
        print(f"  {json.dumps(metrics)}")  # ASCII: console Windows (cp1252) không in được tiếng Việt

    print("[3/4] Training recommendation model...")
    X_recommend, y_recommend = extract_recommendation_dataset()
    recommend_model = RecommendationPredictor()
    if len(X_recommend) > 0:
        results["recommendation_metrics"] = recommend_model.train(X_recommend, y_recommend)
        recommend_model.save()
    else:
        results["recommendation_metrics"] = {"f1_mean": 0.0, "accuracy": 0.0, "note": "No data"}
    results["recommendation_feature_importance"] = recommend_model.feature_importance(RECOMMEND_FEATURE_NAMES)
    print(f"  {json.dumps(results['recommendation_metrics'])}")

    print("[4/4] Saving metrics...")
    with open(os.path.join(MODEL_DIR, "last_training_metrics.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    failed = [name for name in PLAN if "error" in results[f"{name}_metrics"]]
    if failed:
        results["error"] = f"Không huấn luyện được: {', '.join(failed)}"
        print(f"[WARN] {results['error']}")
    else:
        print("[SUCCESS] Training completed.")
    return results


if __name__ == "__main__":
    run_training()
