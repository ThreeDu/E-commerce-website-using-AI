"""
Customer Intelligence ML Service — Flask API.

Endpoints:
    GET  /api/intelligence/overview   — Summary stats + distributions
    GET  /api/intelligence/customers  — Customer list with scores
    POST /api/intelligence/train      — Trigger model retraining
    GET  /api/intelligence/health     — Health check
"""

import os
import sys
import json
import numpy as np
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from flask_cors import CORS

# Ensure ml-service root is in path
sys.path.insert(0, os.path.dirname(__file__))

from config import ML_PORT, MODEL_DIR
from features.feature_engineering import (
    FEATURE_NAMES,
    extract_features_for_all_users,
    _get_db,
    extract_features_for_user,
)
from models.churn_model import ChurnPredictor
from models.potential_model import PotentialScorer
from models.clv_model import CLVPredictor

# Import new retention and intelligence features
from features.segmentation import segment_customers, get_segment_distribution
from features.abandoned_cart import detect_abandoned_carts
from features.retention_engine import select_intervention_targets

from training.train import run_training

app = Flask(__name__)
CORS(app)

# Global model instances
churn_predictor = ChurnPredictor()
potential_scorer = PotentialScorer()
clv_predictor = CLVPredictor()

# Try loading saved models on startup
_churn_loaded = churn_predictor.load()
_potential_loaded = potential_scorer.load()
_clv_loaded = clv_predictor.load()

if _churn_loaded and _potential_loaded and _clv_loaded:
    print("[OK] Loaded saved models from disk (Churn, Potential, CLV).")
else:
    print("[WARN] No saved models found or incomplete models. Run training first (POST /api/intelligence/train).")



def _classify_risk(score):
    """Classify a 0–100 score into risk level."""
    if score >= 61:
        return "high"
    if score >= 31:
        return "medium"
    return "low"


def _get_last_metrics():
    """Load last training metrics from file."""
    path = os.path.join(MODEL_DIR, "last_training_metrics.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


@app.route("/api/intelligence/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "ok",
        "churn_model_ready": churn_predictor.is_trained,
        "potential_model_ready": potential_scorer.is_trained,
        "clv_model_ready": clv_predictor.is_trained,
    })



@app.route("/api/intelligence/overview", methods=["GET"])
def get_overview():
    """Return summary stats, distributions, feature importance."""
    if not churn_predictor.is_trained or not potential_scorer.is_trained:
        return jsonify({
            "message": "Models not trained yet. Please trigger training first.",
            "models_ready": False,
        }), 400

    try:
        df = extract_features_for_all_users()

        if df.empty:
            return jsonify({
                "message": "No customers found.",
                "models_ready": True,
                "overview": None,
            })

        X = df[FEATURE_NAMES].fillna(0).values

        churn_probs = churn_predictor.predict(X)
        potential_scores = potential_scorer.predict(X)

        # Convert probabilities to 0-100 scores
        churn_scores = (churn_probs * 100).round(1)

        # Distribution counts
        churn_distribution = {
            "low": int(sum(1 for s in churn_scores if s <= 30)),
            "medium": int(sum(1 for s in churn_scores if 31 <= s <= 60)),
            "high": int(sum(1 for s in churn_scores if s >= 61)),
        }

        potential_distribution = {
            "low": int(sum(1 for s in potential_scores if s <= 30)),
            "medium": int(sum(1 for s in potential_scores if 31 <= s <= 60)),
            "high": int(sum(1 for s in potential_scores if s >= 61)),
        }

        # Feature importance
        churn_importance = churn_predictor.feature_importance(FEATURE_NAMES)
        potential_importance = potential_scorer.feature_importance(FEATURE_NAMES)

        # Top 5 most important features (sorted)
        top_churn_features = sorted(
            churn_importance.items(), key=lambda x: x[1], reverse=True
        )[:10]
        top_potential_features = sorted(
            potential_importance.items(), key=lambda x: x[1], reverse=True
        )[:10]

        # Last training metrics
        last_metrics = _get_last_metrics()

        return jsonify({
            "models_ready": True,
            "overview": {
                "total_customers": len(df),
                "churn_distribution": churn_distribution,
                "potential_distribution": potential_distribution,
                "avg_churn_score": round(float(churn_scores.mean()), 1),
                "avg_potential_score": round(float(potential_scores.mean()), 1),
                "churn_feature_importance": top_churn_features,
                "potential_feature_importance": top_potential_features,
                "last_training": last_metrics,
            },
        })
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@app.route("/api/intelligence/customers", methods=["GET"])
def get_customers():
    """Return paginated customer list with scores."""
    if not churn_predictor.is_trained or not potential_scorer.is_trained:
        return jsonify({
            "message": "Models not trained yet.",
            "models_ready": False,
        }), 400

    try:
        sort_by = request.args.get("sort", "churn_score")
        order = request.args.get("order", "desc")
        limit = min(int(request.args.get("limit", 50)), 1000)
        page = max(int(request.args.get("page", 1)), 1)

        df = extract_features_for_all_users()

        if df.empty:
            return jsonify({
                "models_ready": True,
                "customers": [],
                "total": 0,
                "page": page,
                "limit": limit,
            })

        X = df[FEATURE_NAMES].fillna(0).values

        churn_probs = churn_predictor.predict(X)
        potential_scores = potential_scorer.predict(X)
        clv_scores = clv_predictor.predict(X) if clv_predictor.is_trained else np.zeros(len(df))


        df["churn_score"] = (churn_probs * 100).round(1)
        df["potential_score"] = potential_scores.round(1)
        df["clv_score"] = clv_scores.round(1)
        df["churn_level"] = df["churn_score"].apply(_classify_risk)
        df["potential_level"] = df["potential_score"].apply(_classify_risk)
        df["clv_level"] = df["clv_score"].apply(_classify_risk)

        # Segment users
        df_segmented = segment_customers(df, df["churn_score"].values, clv_scores)
        df["segment"] = df_segmented["segment"]

        # Sort
        ascending = order != "desc"
        if sort_by == "clv_score":
            df = df.sort_values(by="clv_score", ascending=ascending)
        elif sort_by in df.columns:
            df = df.sort_values(by=sort_by, ascending=ascending)

        # Paginate
        total = len(df)
        start = (page - 1) * limit
        end = start + limit
        page_df = df.iloc[start:end]

        customers = []
        for _, row in page_df.iterrows():
            customers.append({
                "_id": str(row["_id"]),
                "name": row.get("name", ""),
                "email": row.get("email", ""),
                "churn_score": float(row["churn_score"]),
                "churn_level": row["churn_level"],
                "potential_score": float(row["potential_score"]),
                "potential_level": row["potential_level"],
                "clv_score": float(row["clv_score"]),
                "clv_level": row["clv_level"],
                "segment": row["segment"],
                "recency_days": int(row.get("recency_days", 0)),
                "frequency": int(row.get("frequency", 0)),
                "monetary": float(row.get("monetary", 0)),
                "product_views_30d": int(row.get("product_views_30d", 0)),
                "wishlist_size": int(row.get("wishlist_size", 0)),
                "account_age_days": int(row.get("account_age_days", 0)),
            })

        return jsonify({
            "models_ready": True,
            "customers": customers,
            "total": total,
            "page": page,
            "limit": limit,
        })
    except Exception as e:
        return jsonify({"message": str(e)}), 500



@app.route("/api/intelligence/customer/<user_id>", methods=["GET"])
def get_customer(user_id):
    """Return churn/potential scores for a single customer."""
    if not churn_predictor.is_trained or not potential_scorer.is_trained:
        return jsonify({
            "message": "Models not trained yet.",
            "models_ready": False,
        }), 400

    try:
        df = extract_features_for_user(user_id)
        if df.empty:
            return jsonify({"message": "Customer not found."}), 404

        X = df[FEATURE_NAMES].fillna(0).values
        churn_prob = float(churn_predictor.predict(X)[0])
        potential_score = float(potential_scorer.predict(X)[0])

        churn_score = round(churn_prob * 100, 1)
        potential_score = round(potential_score, 1)

        return jsonify({
            "user_id": str(user_id),
            "churn_score": churn_score,
            "churn_level": _classify_risk(churn_score),
            "potential_score": potential_score,
            "potential_level": _classify_risk(potential_score),
        })
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@app.route("/api/intelligence/train", methods=["POST"])
def trigger_training():
    """Trigger model retraining."""
    global churn_predictor, potential_scorer, clv_predictor

    try:
        results = run_training()

        if "error" in results:
            return jsonify({"message": results["error"], "results": results}), 400

        # Reload models after training
        churn_predictor = ChurnPredictor()
        churn_predictor.load()

        potential_scorer = PotentialScorer()
        potential_scorer.load()

        clv_predictor = CLVPredictor()
        clv_predictor.load()

        return jsonify({
            "message": "Training completed successfully.",
            "results": results,
        })
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@app.route("/api/intelligence/segments", methods=["GET"])
def get_segments():
    """Return distribution of customer segments and the customer list inside each segment."""
    if not churn_predictor.is_trained or not potential_scorer.is_trained or not clv_predictor.is_trained:
        return jsonify({
            "message": "Models not trained yet.",
            "models_ready": False,
        }), 400

    try:
        segment_filter = request.args.get("segment")
        limit = min(int(request.args.get("limit", 50)), 1000)
        page = max(int(request.args.get("page", 1)), 1)
        sort_by = request.args.get("sort", "churn_score")
        order = request.args.get("order", "desc")

        df = extract_features_for_all_users()

        if df.empty:
            return jsonify({
                "models_ready": True,
                "distribution": {},
                "customers": [],
                "total": 0,
                "page": page,
                "limit": limit,
            })

        X = df[FEATURE_NAMES].fillna(0).values

        churn_probs = churn_predictor.predict(X)
        clv_scores = clv_predictor.predict(X)

        churn_scores = (churn_probs * 100).round(1)

        # Segment users
        df_segmented = segment_customers(df, churn_scores, clv_scores)
        distribution = get_segment_distribution(df_segmented)

        # Filter by segment if specified
        if segment_filter:
            df_segmented = df_segmented[df_segmented["segment"] == segment_filter]

        # Sort
        ascending = order != "desc"
        if sort_by in df_segmented.columns:
            df_segmented = df_segmented.sort_values(by=sort_by, ascending=ascending)

        total = len(df_segmented)
        start = (page - 1) * limit
        end = start + limit
        page_df = df_segmented.iloc[start:end]

        customers = []
        for _, row in page_df.iterrows():
            customers.append({
                "_id": str(row["_id"]),
                "name": row.get("name", ""),
                "email": row.get("email", ""),
                "segment": row["segment"],
                "churn_score": float(row["churn_score"]),
                "clv_score": float(row["potential_score"]), # segmented uses potential_score for CLV
                "recency_days": int(row.get("recency_days", 0)),
                "frequency": int(row.get("frequency", 0)),
                "monetary": float(row.get("monetary", 0)),
            })

        return jsonify({
            "models_ready": True,
            "distribution": distribution,
            "customers": customers,
            "total": total,
            "page": page,
            "limit": limit,
        })
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@app.route("/api/intelligence/clv", methods=["GET"])
def get_clv_info():
    """Return CLV scores and stats for all customers."""
    if not clv_predictor.is_trained:
        return jsonify({
            "message": "CLV model not trained yet.",
            "models_ready": False,
        }), 400

    try:
        limit = min(int(request.args.get("limit", 50)), 1000)
        page = max(int(request.args.get("page", 1)), 1)
        sort_by = request.args.get("sort", "clv_score")
        order = request.args.get("order", "desc")

        df = extract_features_for_all_users()

        if df.empty:
            return jsonify({
                "models_ready": True,
                "avg_clv_score": 0.0,
                "clv_distribution": {"low": 0, "medium": 0, "high": 0},
                "customers": [],
                "total": 0,
            })

        X = df[FEATURE_NAMES].fillna(0).values
        clv_scores = clv_predictor.predict(X)

        df["clv_score"] = clv_scores
        df["clv_level"] = df["clv_score"].apply(_classify_risk)

        clv_distribution = {
            "low": int(sum(1 for s in clv_scores if s <= 30)),
            "medium": int(sum(1 for s in clv_scores if 31 <= s <= 60)),
            "high": int(sum(1 for s in clv_scores if s >= 61)),
        }

        # Sort
        ascending = order != "desc"
        if sort_by == "clv_score":
            df = df.sort_values(by="clv_score", ascending=ascending)
        elif sort_by in df.columns:
            df = df.sort_values(by=sort_by, ascending=ascending)

        total = len(df)
        start = (page - 1) * limit
        end = start + limit
        page_df = df.iloc[start:end]

        customers = []
        for _, row in page_df.iterrows():
            customers.append({
                "_id": str(row["_id"]),
                "name": row.get("name", ""),
                "email": row.get("email", ""),
                "clv_score": float(row["clv_score"]),
                "clv_level": row["clv_level"],
                "monetary": float(row.get("monetary", 0)),
                "frequency": int(row.get("frequency", 0)),
            })

        return jsonify({
            "models_ready": True,
            "avg_clv_score": round(float(clv_scores.mean()), 1),
            "clv_distribution": clv_distribution,
            "customers": customers,
            "total": total,
            "page": page,
            "limit": limit,
        })
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@app.route("/api/intelligence/abandoned-carts", methods=["GET"])
def get_abandoned_carts_list():
    """Detect and return prioritized abandoned carts."""
    try:
        hours = int(request.args.get("hours", 24))

        # Build real-time churn scores dict to pass to detector
        churn_dict = {}
        if churn_predictor.is_trained:
            try:
                df = extract_features_for_all_users()
                if not df.empty:
                    X = df[FEATURE_NAMES].fillna(0).values
                    churn_probs = churn_predictor.predict(X)
                    churn_scores = (churn_probs * 100).round(1)
                    for idx, row in df.iterrows():
                        churn_dict[str(row["_id"])] = float(churn_scores[idx])
            except Exception as e:
                print(f"Error preparing real-time churn scores for carts: {e}")

        db = _get_db()
        carts = detect_abandoned_carts(db, churn_scores_dict=churn_dict, hours_threshold=hours)

        return jsonify({
            "total": len(carts),
            "carts": carts
        })
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@app.route("/api/intelligence/retention/auto-intervene", methods=["POST"])
def get_auto_intervention_targets():
    """Select customers targeting churn intervention campaigns."""
    if not churn_predictor.is_trained or not clv_predictor.is_trained:
        return jsonify({
            "message": "Models not trained yet.",
            "models_ready": False,
        }), 400

    try:
        body = request.json or {}
        churn_threshold = int(body.get("churn_threshold", 50))
        cooldown_days = int(body.get("cooldown_days", 7))
        max_targets = int(body.get("max_targets", 20))

        df = extract_features_for_all_users()

        if df.empty:
            return jsonify({
                "targets_found": 0,
                "targets": []
            })

        X = df[FEATURE_NAMES].fillna(0).values

        churn_probs = churn_predictor.predict(X)
        clv_scores = clv_predictor.predict(X)

        churn_scores = (churn_probs * 100).round(1)

        db = _get_db()
        targets = select_intervention_targets(
            db, df, churn_scores, clv_scores,
            churn_threshold=churn_threshold,
            cooldown_days=cooldown_days,
            max_targets=max_targets
        )

        return jsonify({
            "targets_found": len(targets),
            "targets": targets
        })
    except Exception as e:
        return jsonify({"message": str(e)}), 500


if __name__ == "__main__":
    print(f"ML Intelligence Service starting on port {ML_PORT}...")
    app.run(host="0.0.0.0", port=ML_PORT, debug=True)
