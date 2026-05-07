"""
Feature Engineering module.

Extracts 16 features per customer from MongoDB collections:
  - Order (RFM + cancel rate + trend)
  - AnalyticsEvent (engagement metrics)
  - ChatbotEvent (chatbot interaction)
  - User (profile completeness)
"""

from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
from pymongo import MongoClient

from config import (
    MONGO_URI,
    DB_NAME,
    RECENCY_WINDOW_DAYS,
    TREND_COMPARE_DAYS,
    CHURN_INACTIVE_DAYS,
    CHURN_NO_ORDER_DAYS,
)

FEATURE_NAMES = [
    "recency_days",
    "frequency",
    "monetary",
    "avg_order_value",
    "cancel_rate",
    "order_trend",
    "product_views_30d",
    "add_to_cart_30d",
    "wishlist_adds_30d",
    "view_to_cart_ratio",
    "engagement_trend",
    "chatbot_sessions_30d",
    "chatbot_queries_30d",
    "account_age_days",
    "wishlist_size",
    "profile_completeness",
]


def _get_db():
    client = MongoClient(MONGO_URI)
    return client[DB_NAME]


def _safe_ratio(numerator, denominator):
    if denominator == 0:
        return 0.0
    return round(numerator / denominator, 4)


def extract_features_for_all_users():
    """
    Return a DataFrame with one row per user and 16 feature columns,
    plus ``_id``, ``name``, ``email`` for identification.
    """
    db = _get_db()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    window_start = now - timedelta(days=RECENCY_WINDOW_DAYS)
    prev_window_start = now - timedelta(days=TREND_COMPARE_DAYS)

    # ── 1. Load all users ──
    users = list(
        db.users.find(
            {"role": {"$ne": "admin"}},
            {"name": 1, "email": 1, "phone": 1, "address": 1, "wishlist": 1, "createdAt": 1},
        )
    )

    if not users:
        return pd.DataFrame(columns=["_id", "name", "email"] + FEATURE_NAMES)

    user_ids = [u["_id"] for u in users]
    user_map = {str(u["_id"]): u for u in users}

    # ── 2. Orders aggregation ──
    orders = list(
        db.orders.find(
            {"user": {"$in": user_ids}},
            {"user": 1, "totalPrice": 1, "status": 1, "createdAt": 1},
        )
    )

    # Group orders by user
    orders_by_user = {}
    for o in orders:
        uid = str(o["user"])
        orders_by_user.setdefault(uid, []).append(o)

    # ── 3. AnalyticsEvent aggregation (recent window) ──
    events_recent = list(
        db.analyticsevents.find(
            {
                "userId": {"$in": user_ids},
                "occurredAt": {"$gte": window_start},
            },
            {"userId": 1, "eventName": 1, "occurredAt": 1},
        )
    )

    events_prev = list(
        db.analyticsevents.find(
            {
                "userId": {"$in": user_ids},
                "occurredAt": {"$gte": prev_window_start, "$lt": window_start},
            },
            {"userId": 1, "eventName": 1},
        )
    )

    # Group events by user
    recent_events_by_user = {}
    for e in events_recent:
        uid = str(e.get("userId", ""))
        recent_events_by_user.setdefault(uid, []).append(e)

    prev_events_by_user = {}
    for e in events_prev:
        uid = str(e.get("userId", ""))
        prev_events_by_user.setdefault(uid, []).append(e)

    # ── 4. ChatbotEvent aggregation ──
    chatbot_events = list(
        db.chatbotevents.find(
            {
                "user": {"$in": user_ids},
                "createdAt": {"$gte": window_start},
            },
            {"user": 1, "sessionId": 1, "eventType": 1},
        )
    )

    chatbot_by_user = {}
    for e in chatbot_events:
        uid = str(e.get("user", ""))
        chatbot_by_user.setdefault(uid, []).append(e)

    # ── 5. Build feature rows ──
    rows = []
    for uid_str, user in user_map.items():
        row = {
            "_id": uid_str,
            "name": user.get("name", ""),
            "email": user.get("email", ""),
        }

        # --- RFM features ---
        user_orders = orders_by_user.get(uid_str, [])
        completed_orders = [o for o in user_orders if o.get("status") != "cancelled"]
        cancelled_orders = [o for o in user_orders if o.get("status") == "cancelled"]

        if completed_orders:
            last_order_date = max(o.get("createdAt", now) for o in completed_orders)
            row["recency_days"] = max(0, (now - last_order_date).days) if last_order_date else 999
        else:
            row["recency_days"] = 999

        row["frequency"] = len(completed_orders)
        row["monetary"] = sum(float(o.get("totalPrice", 0)) for o in completed_orders)
        row["avg_order_value"] = _safe_ratio(row["monetary"], row["frequency"])
        row["cancel_rate"] = _safe_ratio(len(cancelled_orders), len(user_orders)) if user_orders else 0.0

        # Order trend: orders in recent window vs previous window
        recent_order_count = sum(
            1 for o in completed_orders
            if o.get("createdAt") and o["createdAt"] >= window_start
        )
        prev_order_count = sum(
            1 for o in completed_orders
            if o.get("createdAt") and prev_window_start <= o["createdAt"] < window_start
        )
        row["order_trend"] = recent_order_count - prev_order_count

        # --- Engagement features ---
        user_recent_events = recent_events_by_user.get(uid_str, [])
        user_prev_events = prev_events_by_user.get(uid_str, [])

        row["product_views_30d"] = sum(1 for e in user_recent_events if e.get("eventName") == "product_view")
        row["add_to_cart_30d"] = sum(1 for e in user_recent_events if e.get("eventName") == "add_to_cart")
        row["wishlist_adds_30d"] = sum(1 for e in user_recent_events if e.get("eventName") == "wishlist_add")
        row["view_to_cart_ratio"] = _safe_ratio(row["add_to_cart_30d"], row["product_views_30d"])

        recent_engagement = len(user_recent_events)
        prev_engagement = len(user_prev_events)
        row["engagement_trend"] = recent_engagement - prev_engagement

        # --- Chatbot features ---
        user_chatbot = chatbot_by_user.get(uid_str, [])
        unique_sessions = set(e.get("sessionId", "") for e in user_chatbot if e.get("sessionId"))
        row["chatbot_sessions_30d"] = len(unique_sessions)
        row["chatbot_queries_30d"] = sum(1 for e in user_chatbot if e.get("eventType") == "message")

        # --- Profile features ---
        created_at = user.get("createdAt")
        row["account_age_days"] = max(0, (now - created_at).days) if created_at else 0

        wishlist = user.get("wishlist", [])
        row["wishlist_size"] = len(wishlist) if isinstance(wishlist, list) else 0

        completeness = 0
        if user.get("name"):
            completeness += 1
        if user.get("phone"):
            completeness += 1
        if user.get("address"):
            completeness += 1
        row["profile_completeness"] = round(completeness / 3, 2)

        rows.append(row)

    df = pd.DataFrame(rows)
    return df


def generate_churn_labels(df):
    """
    Auto-label churn target:
      1 = recency_days > CHURN_INACTIVE_DAYS AND frequency == 0 in recent window
      0 = otherwise
    """
    labels = np.where(
        (df["recency_days"] > CHURN_NO_ORDER_DAYS) & (df["product_views_30d"] == 0),
        1,
        0,
    )
    return labels.astype(int)


def generate_potential_labels(df):
    """
    Auto-label potential score (0-100) as a composite of engagement signals.
    This serves as the training target for the potential model.
    """
    scores = np.zeros(len(df))

    # Normalize each feature to 0-1 range, then weight
    for col, weight in [
        ("product_views_30d", 20),
        ("wishlist_size", 20),
        ("add_to_cart_30d", 20),
        ("monetary", 25),
        ("chatbot_queries_30d", 15),
    ]:
        values = df[col].values.astype(float)
        max_val = values.max()
        if max_val > 0:
            normalized = values / max_val
        else:
            normalized = values
        scores += normalized * weight

    return np.clip(scores, 0, 100).round(2)
