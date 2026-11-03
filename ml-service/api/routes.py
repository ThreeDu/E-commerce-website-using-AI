"""
REST API /api/intelligence/* — chỉ đọc request, gọi services và định dạng JSON.
Định dạng response giữ tương thích với server Node và trang admin.
"""

import json
import os
from functools import wraps

from flask import Blueprint, jsonify, request

from config import MODEL_DIR
from data.mongo import get_db
from features.abandoned_cart import detect_abandoned_carts
from features.retention_engine import select_intervention_targets
from features.segmentation import get_segment_distribution
from services import scoring
from services.recommendation import score_products
from training.train import run_training

bp = Blueprint("intelligence", __name__, url_prefix="/api/intelligence")


def _last_training_metrics():
    path = os.path.join(MODEL_DIR, "last_training_metrics.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def requires_models(*names, message="Models not trained yet."):
    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            if not scoring.is_ready(*names):
                return jsonify({"message": message, "models_ready": False}), 400
            return view(*args, **kwargs)
        return wrapper
    return decorator


def json_errors(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        try:
            return view(*args, **kwargs)
        except Exception as e:
            return jsonify({"message": str(e)}), 500
    return wrapper


def _page_args(default_sort):
    return {
        "sort_by": request.args.get("sort", default_sort),
        "ascending": request.args.get("order", "desc") != "desc",
        "limit": min(int(request.args.get("limit", 50)), 1000),
        "page": max(int(request.args.get("page", 1)), 1),
    }


def _paginate(df, sort_by, ascending, limit, page):
    if sort_by in df.columns:
        df = df.sort_values(by=sort_by, ascending=ascending)
    start = (page - 1) * limit
    return df.iloc[start:start + limit], len(df)


def _top_importance(model_name, n=10):
    importance = scoring.models[model_name].importance
    return sorted(importance.items(), key=lambda x: x[1], reverse=True)[:n]


@bp.get("/health")
def health_check():
    return jsonify({
        "status": "ok",
        "churn_model_ready": scoring.is_ready("churn"),
        "potential_model_ready": scoring.is_ready("potential"),
        "clv_model_ready": scoring.is_ready("clv"),
        "recommend_model_ready": scoring.recommendation_model.is_trained,
    })


@bp.get("/overview")
@requires_models("churn", "potential", message="Models not trained yet. Please trigger training first.")
@json_errors
def get_overview():
    df = scoring.score_customers()
    if df.empty:
        return jsonify({"message": "No customers found.", "models_ready": True, "overview": None})

    return jsonify({
        "models_ready": True,
        "overview": {
            "total_customers": len(df),
            "churn_distribution": scoring.level_distribution(df["churn_score"]),
            "potential_distribution": scoring.level_distribution(df["potential_score"]),
            "avg_churn_score": round(float(df["churn_score"].mean()), 1),
            "avg_potential_score": round(float(df["potential_score"].mean()), 1),
            "churn_feature_importance": _top_importance("churn"),
            "potential_feature_importance": _top_importance("potential"),
            "last_training": _last_training_metrics(),
        },
    })


@bp.get("/customers")
@requires_models("churn", "potential")
@json_errors
def get_customers():
    args = _page_args("churn_score")
    df = scoring.score_customers()
    if df.empty:
        return jsonify({"models_ready": True, "customers": [], "total": 0, "page": args["page"], "limit": args["limit"]})

    page_df, total = _paginate(df, **args)
    customers = [{
        "_id": str(row["_id"]),
        "name": row.get("name", ""),
        "email": row.get("email", ""),
        "churn_score": float(row["churn_score"]),
        "churn_level": row["churn_level"],
        "potential_score": float(row["potential_score"]),
        "potential_level": row["potential_level"],
        "clv_score": float(row["clv_score"]),
        "clv_level": row["clv_level"],
        "predicted_spend": float(row["predicted_spend"]),
        "segment": row["segment"],
        "recency_days": int(row.get("recency_days", 0)),
        "frequency": int(row.get("frequency", 0)),
        "monetary": float(row.get("monetary", 0)),
        "product_views_30d": int(row.get("product_views_30d", 0)),
        "wishlist_size": int(row.get("wishlist_size", 0)),
        "account_age_days": int(row.get("account_age_days", 0)),
    } for _, row in page_df.iterrows()]

    return jsonify({"models_ready": True, "customers": customers, "total": total, "page": args["page"], "limit": args["limit"]})


@bp.get("/customer/<user_id>")
@requires_models("churn", "potential")
@json_errors
def get_customer(user_id):
    df = scoring.score_customers(user_id=user_id)
    if df.empty:
        return jsonify({"message": "Customer not found."}), 404

    row = df.iloc[0]
    return jsonify({
        "user_id": str(user_id),
        "churn_score": float(row["churn_score"]),
        "churn_level": row["churn_level"],
        "potential_score": float(row["potential_score"]),
        "potential_level": row["potential_level"],
        "predicted_spend": float(row["predicted_spend"]),
    })


@bp.post("/train")
@json_errors
def trigger_training():
    results = run_training()
    scoring.load_models()  # nạp cả các mô hình đã lưu được nếu một mô hình khác thất bại
    if "error" in results:
        return jsonify({"message": results["error"], "results": results}), 400
    return jsonify({"message": "Training completed successfully.", "results": results})


@bp.get("/segments")
@requires_models("churn", "potential", "clv")
@json_errors
def get_segments():
    args = _page_args("churn_score")
    segment_filter = request.args.get("segment")
    df = scoring.score_customers()
    if df.empty:
        return jsonify({"models_ready": True, "distribution": {}, "customers": [], "total": 0, "page": args["page"], "limit": args["limit"]})

    distribution = get_segment_distribution(df)
    if segment_filter:
        df = df[df["segment"] == segment_filter]

    page_df, total = _paginate(df, **args)
    customers = [{
        "_id": str(row["_id"]),
        "name": row.get("name", ""),
        "email": row.get("email", ""),
        "segment": row["segment"],
        "churn_score": float(row["churn_score"]),
        "clv_score": float(row["clv_score"]),
        "recency_days": int(row.get("recency_days", 0)),
        "frequency": int(row.get("frequency", 0)),
        "monetary": float(row.get("monetary", 0)),
    } for _, row in page_df.iterrows()]

    return jsonify({"models_ready": True, "distribution": distribution, "customers": customers, "total": total, "page": args["page"], "limit": args["limit"]})


@bp.get("/clv")
@requires_models("churn", "potential", "clv", message="CLV model not trained yet.")
@json_errors
def get_clv_info():
    args = _page_args("clv_score")
    df = scoring.score_customers()
    if df.empty:
        return jsonify({"models_ready": True, "avg_clv_score": 0.0, "clv_distribution": {"low": 0, "medium": 0, "high": 0}, "customers": [], "total": 0})

    page_df, total = _paginate(df, **args)
    customers = [{
        "_id": str(row["_id"]),
        "name": row.get("name", ""),
        "email": row.get("email", ""),
        "clv_score": float(row["clv_score"]),
        "clv_level": row["clv_level"],
        "predicted_spend": float(row["predicted_spend"]),
        "monetary": float(row.get("monetary", 0)),
        "frequency": int(row.get("frequency", 0)),
    } for _, row in page_df.iterrows()]

    return jsonify({
        "models_ready": True,
        "avg_clv_score": round(float(df["clv_score"].mean()), 1),
        "avg_predicted_spend": round(float(df["predicted_spend"].mean()), 0),
        "clv_distribution": scoring.level_distribution(df["clv_score"]),
        "customers": customers,
        "total": total,
        "page": args["page"],
        "limit": args["limit"],
    })


@bp.get("/abandoned-carts")
@json_errors
def get_abandoned_carts_list():
    hours = int(request.args.get("hours", 24))

    churn_dict = {}
    if scoring.is_ready("churn", "potential"):
        try:
            df = scoring.score_customers()
            churn_dict = {str(uid): float(score) for uid, score in zip(df["_id"], df["churn_score"])}
        except Exception as e:
            print(f"Error preparing real-time churn scores for carts: {e}")

    carts = detect_abandoned_carts(get_db(), churn_scores_dict=churn_dict, hours_threshold=hours)
    return jsonify({"total": len(carts), "carts": carts})


@bp.post("/retention/auto-intervene")
@requires_models("churn", "potential", "clv")
@json_errors
def get_auto_intervention_targets():
    body = request.json or {}
    df = scoring.score_customers()
    if df.empty:
        return jsonify({"targets_found": 0, "targets": []})

    targets = select_intervention_targets(
        get_db(),
        df,
        churn_threshold=int(body.get("churn_threshold", 50)),
        cooldown_days=int(body.get("cooldown_days", 7)),
        max_targets=int(body.get("max_targets", 20)),
    )
    return jsonify({"targets_found": len(targets), "targets": targets})


@bp.post("/recommend")
@json_errors
def recommend_products():
    body = request.json or {}
    return jsonify({"scores": score_products(body.get("userId"), body.get("productIds", []))})
