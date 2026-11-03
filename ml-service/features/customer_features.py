"""
Đặc trưng khách hàng tính tại một thời điểm ``as_of`` (point-in-time).

Chỉ dùng dữ liệu xảy ra TRƯỚC ``as_of``, nên cùng một hàm phục vụ cả:
  - huấn luyện: tính tại các mốc trong quá khứ rồi gán nhãn bằng hành vi sau mốc;
  - dự đoán: tính tại thời điểm hiện tại.
"""

from datetime import timedelta

import pandas as pd

from config import RECENCY_WINDOW_DAYS, TREND_COMPARE_DAYS

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

# Đặc trưng lấy từ trạng thái HIỆN TẠI của hồ sơ (không có lịch sử), nên không dùng được
# cho snapshot quá khứ: checkout điền SĐT/địa chỉ, làm lộ việc khách sẽ mua sau mốc T.
NOT_POINT_IN_TIME = {"profile_completeness"}

# Đặc trưng cho các mô hình huấn luyện theo thời gian (rời bỏ / tiềm năng / CLV)
MODEL_FEATURES = [name for name in FEATURE_NAMES if name not in NOT_POINT_IN_TIME]

ID_COLUMNS = ["_id", "name", "email"]

# Khách chưa từng có đơn hoàn tất trước as_of
NO_ORDER_RECENCY = 999


def _safe_ratio(numerator, denominator):
    if denominator == 0:
        return 0.0
    return round(numerator / denominator, 4)


def group_by_user(raw):
    """Gom orders / events / chatbot events theo user id (chuỗi). Dùng lại được cho nhiều mốc as_of."""
    grouped = {}

    def bucket(uid):
        return grouped.setdefault(str(uid), {"orders": [], "events": [], "chatbot": []})

    for o in raw["orders"]:
        bucket(o.get("user"))["orders"].append(o)
    for e in raw["events"]:
        bucket(e.get("userId"))["events"].append(e)
    for e in raw["chatbot"]:
        bucket(e.get("user"))["chatbot"].append(e)
    return grouped


def is_completed(order):
    return order.get("status") != "cancelled"


def _customer_features(user, data, as_of):
    window_start = as_of - timedelta(days=RECENCY_WINDOW_DAYS)
    prev_window_start = as_of - timedelta(days=TREND_COMPARE_DAYS)

    orders = [o for o in data["orders"] if o.get("createdAt") and o["createdAt"] < as_of]
    completed = [o for o in orders if is_completed(o)]
    cancelled = len(orders) - len(completed)

    events = [e for e in data["events"] if e.get("occurredAt") and e["occurredAt"] < as_of]
    recent_events = [e for e in events if e["occurredAt"] >= window_start]
    prev_events = [e for e in events if prev_window_start <= e["occurredAt"] < window_start]
    chatbot = [e for e in data["chatbot"] if e.get("createdAt") and window_start <= e["createdAt"] < as_of]

    f = {}
    f["recency_days"] = (as_of - max(o["createdAt"] for o in completed)).days if completed else NO_ORDER_RECENCY
    f["frequency"] = len(completed)
    f["monetary"] = sum(float(o.get("totalPrice", 0)) for o in completed)
    f["avg_order_value"] = _safe_ratio(f["monetary"], f["frequency"])
    f["cancel_rate"] = _safe_ratio(cancelled, len(orders))
    f["order_trend"] = (
        sum(1 for o in completed if o["createdAt"] >= window_start)
        - sum(1 for o in completed if prev_window_start <= o["createdAt"] < window_start)
    )

    def count(evts, name):
        return sum(1 for e in evts if e.get("eventName") == name)

    f["product_views_30d"] = count(recent_events, "product_view")
    f["add_to_cart_30d"] = count(recent_events, "add_to_cart")
    f["wishlist_adds_30d"] = count(recent_events, "wishlist_add")
    f["view_to_cart_ratio"] = _safe_ratio(f["add_to_cart_30d"], f["product_views_30d"])
    f["engagement_trend"] = len(recent_events) - len(prev_events)

    f["chatbot_sessions_30d"] = len({e.get("sessionId") for e in chatbot if e.get("sessionId")})
    f["chatbot_queries_30d"] = sum(1 for e in chatbot if e.get("eventType") == "message")

    created_at = user.get("createdAt")
    f["account_age_days"] = max(0, (as_of - created_at).days) if created_at else 0
    # Wishlist không có lịch sử thay đổi: dùng số lần thêm vào wishlist tới as_of
    # (cùng một định nghĩa khi huấn luyện và khi dự đoán).
    f["wishlist_size"] = count(events, "wishlist_add")
    f["profile_completeness"] = round(sum(1 for k in ("name", "phone", "address") if user.get(k)) / 3, 2)
    return f


def build_customer_features(raw, as_of, grouped=None):
    """
    DataFrame mỗi khách một dòng: ``_id``, ``name``, ``email`` + FEATURE_NAMES, tính tại ``as_of``.
    Khách tạo tài khoản sau ``as_of`` bị bỏ qua.
    """
    grouped = grouped if grouped is not None else group_by_user(raw)
    empty = {"orders": [], "events": [], "chatbot": []}
    rows = []
    for user in raw["users"]:
        created_at = user.get("createdAt")
        if created_at and created_at >= as_of:
            continue
        uid = str(user["_id"])
        rows.append({
            "_id": uid,
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            **_customer_features(user, grouped.get(uid, empty), as_of),
        })
    return pd.DataFrame(rows, columns=ID_COLUMNS + FEATURE_NAMES)
