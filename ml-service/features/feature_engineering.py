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
from bson import ObjectId

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

RECOMMEND_FEATURE_NAMES = FEATURE_NAMES + [
    "product_price",
    "product_discount",
    "product_rating",
    "product_views",
    "product_purchases",
    "is_preferred_category",
    "user_view_count",
    "user_cart_count",
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


def extract_features_for_user(user_id):
    """
    Return a single-row DataFrame with features for a specific user.
    """
    if not user_id:
        return pd.DataFrame(columns=["_id", "name", "email"] + FEATURE_NAMES)

    try:
        oid = ObjectId(str(user_id))
    except Exception:
        return pd.DataFrame(columns=["_id", "name", "email"] + FEATURE_NAMES)

    db = _get_db()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    window_start = now - timedelta(days=RECENCY_WINDOW_DAYS)
    prev_window_start = now - timedelta(days=TREND_COMPARE_DAYS)

    user = db.users.find_one(
        {"_id": oid, "role": {"$ne": "admin"}},
        {"name": 1, "email": 1, "phone": 1, "address": 1, "wishlist": 1, "createdAt": 1},
    )

    if not user:
        return pd.DataFrame(columns=["_id", "name", "email"] + FEATURE_NAMES)

    orders = list(
        db.orders.find(
            {"user": oid},
            {"user": 1, "totalPrice": 1, "status": 1, "createdAt": 1},
        )
    )

    events_recent = list(
        db.analyticsevents.find(
            {"userId": oid, "occurredAt": {"$gte": window_start}},
            {"userId": 1, "eventName": 1, "occurredAt": 1},
        )
    )

    events_prev = list(
        db.analyticsevents.find(
            {
                "userId": oid,
                "occurredAt": {"$gte": prev_window_start, "$lt": window_start},
            },
            {"userId": 1, "eventName": 1},
        )
    )

    chatbot_events = list(
        db.chatbotevents.find(
            {"user": oid, "createdAt": {"$gte": window_start}},
            {"user": 1, "sessionId": 1, "eventType": 1},
        )
    )

    row = {
        "_id": str(user.get("_id")),
        "name": user.get("name", ""),
        "email": user.get("email", ""),
    }

    completed_orders = [o for o in orders if o.get("status") != "cancelled"]
    cancelled_orders = [o for o in orders if o.get("status") == "cancelled"]

    if completed_orders:
        last_order_date = max(o.get("createdAt", now) for o in completed_orders)
        row["recency_days"] = max(0, (now - last_order_date).days) if last_order_date else 999
    else:
        row["recency_days"] = 999

    row["frequency"] = len(completed_orders)
    row["monetary"] = sum(float(o.get("totalPrice", 0)) for o in completed_orders)
    row["avg_order_value"] = _safe_ratio(row["monetary"], row["frequency"])
    row["cancel_rate"] = _safe_ratio(len(cancelled_orders), len(orders)) if orders else 0.0

    recent_order_count = sum(
        1 for o in completed_orders
        if o.get("createdAt") and o["createdAt"] >= window_start
    )
    prev_order_count = sum(
        1 for o in completed_orders
        if o.get("createdAt") and prev_window_start <= o["createdAt"] < window_start
    )
    row["order_trend"] = recent_order_count - prev_order_count

    row["product_views_30d"] = sum(1 for e in events_recent if e.get("eventName") == "product_view")
    row["add_to_cart_30d"] = sum(1 for e in events_recent if e.get("eventName") == "add_to_cart")
    row["wishlist_adds_30d"] = sum(1 for e in events_recent if e.get("eventName") == "wishlist_add")
    row["view_to_cart_ratio"] = _safe_ratio(row["add_to_cart_30d"], row["product_views_30d"])

    recent_engagement = len(events_recent)
    prev_engagement = len(events_prev)
    row["engagement_trend"] = recent_engagement - prev_engagement

    unique_sessions = set(e.get("sessionId", "") for e in chatbot_events if e.get("sessionId"))
    row["chatbot_sessions_30d"] = len(unique_sessions)
    row["chatbot_queries_30d"] = sum(1 for e in chatbot_events if e.get("eventType") == "message")

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

    return pd.DataFrame([row])


def generate_churn_labels(df):
    """
    Auto-label churn target with probabilistic behavior to avoid perfect separation
    and allow intermediate probabilities (medium churn risk).
    """
    recency = df["recency_days"].values.astype(float)
    views = df["product_views_30d"].values.astype(float)
    
    labels = []
    # Use a fixed seed for deterministic seeding results
    rng = np.random.default_rng(42)
    for r, v in zip(recency, views):
        # Base probability of churn
        p_churn = 0.05 # Baseline risk
        
        # Add risk based on recency
        if r > 45:
            p_churn += 0.55
        elif r > 20:
            p_churn += 0.25
            
        # Add risk based on product views
        if v == 0:
            p_churn += 0.30
        elif v < 5:
            p_churn += 0.15
            
        p_churn = min(0.95, max(0.05, p_churn))
        # Draw label
        label = 1 if rng.random() < p_churn else 0
        labels.append(label)
        
    return np.array(labels, dtype=int)


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


def generate_clv_labels(df):
    """
    Auto-label CLV score (0-100) based on weighted combination of RFM and engagement indicators.
    """
    scores = np.zeros(len(df))

    weights = {
        "monetary": 35,
        "frequency": 25,
        "avg_order_value": 15,
        "order_trend": 10,
        "engagement_trend": 10,
        "account_age_days": 5
    }

    for col, weight in weights.items():
        if col in df.columns:
            values = df[col].values.astype(float)
            min_val = values.min()
            max_val = values.max()
            if max_val - min_val > 0:
                normalized = (values - min_val) / (max_val - min_val)
            else:
                normalized = np.zeros_like(values)
            scores += normalized * weight

    return np.clip(scores, 0, 100).round(2)


def extract_recommendation_dataset():
    """
    Generate user-product pairs dataset for training the Recommendation Model.
    """
    db = _get_db()
    
    # 1. Get all users and their user feature DataFrame
    user_df = extract_features_for_all_users()
    if user_df.empty:
        return np.empty((0, len(RECOMMEND_FEATURE_NAMES))), np.empty((0,))
        
    # 2. Get all products
    products = list(db.products.find({}, {
        "category": 1,
        "price": 1,
        "finalPrice": 1,
        "discountPercent": 1,
        "averageRating": 1,
        "totalViews": 1
    }))
    if not products:
        return np.empty((0, len(RECOMMEND_FEATURE_NAMES))), np.empty((0,))

    product_ids = [p["_id"] for p in products]
    
    # Pre-calculate purchases for each product from non-cancelled orders
    orders = list(db.orders.find({"status": {"$ne": "cancelled"}}, {"orderItems": 1}))
    purchase_counts = {}
    for o in orders:
        for item in o.get("orderItems", []):
            pid = str(item.get("product", ""))
            if pid:
                purchase_counts[pid] = purchase_counts.get(pid, 0) + int(item.get("quantity", 1))

    # 3. Load interactions: AnalyticsEvents and ChatbotEvents
    analytics_events = list(db.analyticsevents.find(
        {"userId": {"$ne": None}, "productId": {"$in": product_ids}},
        {"userId": 1, "productId": 1, "eventName": 1}
    ))
    
    chatbot_events = list(db.chatbotevents.find(
        {"user": {"$ne": None}, "product": {"$in": product_ids}},
        {"user": 1, "product": 1, "eventType": 1}
    ))

    # Pre-aggregate interactions
    view_interactions = {} # (uid, pid) -> count
    cart_interactions = {} # (uid, pid) -> count
    interacted_pairs = set() # (uid, pid)
    
    # Analytics
    for event in analytics_events:
        uid = str(event["userId"])
        pid = str(event["productId"])
        evt = event.get("eventName", "")
        interacted_pairs.add((uid, pid))
        if evt == "product_view":
            view_interactions[(uid, pid)] = view_interactions.get((uid, pid), 0) + 1
        elif evt == "add_to_cart":
            cart_interactions[(uid, pid)] = cart_interactions.get((uid, pid), 0) + 1

    # Chatbot
    for event in chatbot_events:
        uid = str(event["user"])
        pid = str(event["product"])
        evt = event.get("eventType", "")
        interacted_pairs.add((uid, pid))
        if evt in ["view", "click"]:
            view_interactions[(uid, pid)] = view_interactions.get((uid, pid), 0) + 1
        elif evt == "cart":
            cart_interactions[(uid, pid)] = cart_interactions.get((uid, pid), 0) + 1

    # Order item records (explicit interaction)
    user_completed_orders = list(db.orders.find(
        {"user": {"$ne": None}},
        {"user": 1, "orderItems": 1}
    ))
    for o in user_completed_orders:
        uid = str(o["user"])
        for item in o.get("orderItems", []):
            pid = str(item.get("product", ""))
            if pid:
                interacted_pairs.add((uid, pid))

    # 4. Preferred categories per user
    users_raw = list(db.users.find({"role": {"$ne": "admin"}}, {"wishlist": 1}))
    user_wishlists = {str(u["_id"]): [str(pid) for pid in u.get("wishlist", [])] for u in users_raw}

    # Construct the dataset rows
    rows = []
    labels = []
    
    for _, user_row in user_df.iterrows():
        uid = str(user_row["_id"])
        
        # User feature vector (16 values)
        user_feats = [float(user_row[col]) for col in FEATURE_NAMES]
        
        # Determine preferred categories based on user's completed orders
        user_orders = list(db.orders.find({"user": ObjectId(uid), "status": {"$ne": "cancelled"}}, {"orderItems": 1}))
        preferred_cats = set()
        for o in user_orders:
            for item in o.get("orderItems", []):
                p_cat = db.products.find_one({"_id": item.get("product")}, {"category": 1})
                if p_cat:
                    preferred_cats.add(p_cat.get("category", "").lower().strip())
                    
        # Add wishlist categories
        wish_pids = user_wishlists.get(uid, [])
        for wpid in wish_pids:
            wp = db.products.find_one({"_id": ObjectId(wpid)}, {"category": 1})
            if wp:
                preferred_cats.add(wp.get("category", "").lower().strip())

        for p in products:
            pid = str(p["_id"])
            p_cat = str(p.get("category", "")).lower().strip()
            
            # Product features
            price = float(p.get("finalPrice", p.get("price", 0)))
            discount = float(p.get("discountPercent", 0))
            rating = float(p.get("averageRating", 0))
            views = float(p.get("totalViews", 0))
            purchases = float(purchase_counts.get(pid, 0))
            
            # Match features
            is_pref = 1.0 if p_cat in preferred_cats else 0.0
            u_views = float(view_interactions.get((uid, pid), 0))
            u_carts = float(cart_interactions.get((uid, pid), 0))
            
            # Label
            label = 1 if (uid, pid) in interacted_pairs else 0
            
            # Combine all features
            row = user_feats + [
                price,
                discount,
                rating,
                views,
                purchases,
                is_pref,
                u_views,
                u_carts
            ]
            rows.append(row)
            labels.append(label)

    return np.array(rows), np.array(labels)


