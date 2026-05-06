"""
Training Pipeline.

Usage:
    cd ml-service
    python -m training.train

Workflow:
    1. Extract features from MongoDB for all customers.
    2. Auto-generate churn and potential labels.
    3. Train both models.
    4. Save trained models to saved_models/.
    5. Print metrics and feature importance.
"""

import sys
import os
import json
from datetime import datetime, timezone

# Ensure ml-service root is in path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from features.feature_engineering import (
    FEATURE_NAMES,
    extract_features_for_all_users,
    generate_churn_labels,
    generate_potential_labels,
)
from models.churn_model import ChurnPredictor
from models.potential_model import PotentialScorer
from config import MODEL_DIR


def run_training():
    """Run full training pipeline. Returns metrics dict."""
    print("=" * 60)
    print("  Customer Intelligence — Training Pipeline")
    print("=" * 60)
    print()

    # Step 1: Extract features
    print("[1/5] Extracting features from MongoDB...")
    df = extract_features_for_all_users()

    if df.empty or len(df) < 5:
        print(f"  ⚠ Only {len(df)} customers found. Need at least 5 to train.")
        print("  Saving empty metrics.")
        return {"error": "Not enough data", "customer_count": len(df)}

    print(f"  ✓ Found {len(df)} customers with {len(FEATURE_NAMES)} features each.")
    print()

    X = df[FEATURE_NAMES].fillna(0).values

    # Step 2: Generate labels
    print("[2/5] Generating auto-labels...")
    churn_labels = generate_churn_labels(df)
    potential_labels = generate_potential_labels(df)

    churn_positive = int(churn_labels.sum())
    print(f"  Churn: {churn_positive} churned / {len(churn_labels)} total ({100 * churn_positive / len(churn_labels):.1f}%)")
    print(f"  Potential: min={potential_labels.min():.1f}, max={potential_labels.max():.1f}, mean={potential_labels.mean():.1f}")
    print()

    # Step 3: Train churn model
    print("[3/5] Training Churn Predictor (Random Forest)...")
    churn_model = ChurnPredictor()
    churn_metrics = churn_model.train(X, churn_labels)
    print(f"  ✓ Churn metrics: {json.dumps(churn_metrics, indent=2)}")
    print()

    # Step 4: Train potential model
    print("[4/5] Training Potential Scorer (Gradient Boosting)...")
    potential_model = PotentialScorer()
    potential_metrics = potential_model.train(X, potential_labels)
    print(f"  ✓ Potential metrics: {json.dumps(potential_metrics, indent=2)}")
    print()

    # Step 5: Save models
    print("[5/5] Saving models...")
    churn_model.save()
    potential_model.save()
    print(f"  ✓ Models saved to {MODEL_DIR}")
    print()

    # Feature importance
    churn_importance = churn_model.feature_importance(FEATURE_NAMES)
    potential_importance = potential_model.feature_importance(FEATURE_NAMES)

    print("── Churn Feature Importance (top 5) ──")
    for name, score in sorted(churn_importance.items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f"  {name:.<30} {score:.4f}")

    print()
    print("── Potential Feature Importance (top 5) ──")
    for name, score in sorted(potential_importance.items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f"  {name:.<30} {score:.4f}")

    print()
    print("✅ Training completed successfully!")

    results = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "customer_count": len(df),
        "churn_metrics": churn_metrics,
        "potential_metrics": potential_metrics,
        "churn_feature_importance": churn_importance,
        "potential_feature_importance": potential_importance,
    }

    # Save metrics to file
    metrics_path = os.path.join(MODEL_DIR, "last_training_metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    return results


if __name__ == "__main__":
    run_training()
