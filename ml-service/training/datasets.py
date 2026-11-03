"""
Tập huấn luyện theo thời gian (snapshot).

Tại mỗi mốc T trong quá khứ: đặc trưng tính bằng dữ liệu trước T, nhãn lấy từ hành vi
thật trong [T, T + horizon). Chỉ dùng các mốc có T + horizon <= now để nhãn đã "chốt".
"""

from datetime import timedelta

import numpy as np
import pandas as pd

from config import SNAPSHOT_STEP_DAYS, MIN_HISTORY_DAYS
from features.customer_features import build_customer_features, group_by_user, is_completed

# target -> mô tả nhãn
TARGETS = {
    "churn": "1 nếu khách đã từng mua trước T nhưng không có đơn hoàn tất nào trong cửa sổ",
    "purchase": "1 nếu có ít nhất một đơn hoàn tất trong cửa sổ",
    "spend": "tổng giá trị đơn hoàn tất trong cửa sổ (VND)",
}


def snapshot_cutoffs(raw, horizon_days, now):
    """Các mốc T cách nhau SNAPSHOT_STEP_DAYS, từ (đơn đầu tiên + MIN_HISTORY_DAYS) tới (now - horizon)."""
    order_dates = [o["createdAt"] for o in raw["orders"] if o.get("createdAt")]
    if not order_dates:
        return []
    first = min(order_dates) + timedelta(days=MIN_HISTORY_DAYS)
    last = now - timedelta(days=horizon_days)
    cutoffs = []
    t = last
    while t >= first:
        cutoffs.append(t)
        t -= timedelta(days=SNAPSHOT_STEP_DAYS)
    return sorted(cutoffs)


def build_snapshot_dataset(raw, target, horizon_days, now):
    """
    Ghép các snapshot thành một DataFrame: đặc trưng + cột ``snapshot`` (mốc T) + ``target``.
    Một khách xuất hiện ở nhiều mốc; khi đánh giá phải tách train/test theo ``_id``.
    """
    if target not in TARGETS:
        raise ValueError(f"Unknown target: {target}")

    grouped = group_by_user(raw)
    frames = []
    for cutoff in snapshot_cutoffs(raw, horizon_days, now):
        df = build_customer_features(raw, cutoff, grouped)
        if df.empty:
            continue
        end = cutoff + timedelta(days=horizon_days)

        def future_orders(uid):
            orders = grouped.get(uid, {}).get("orders", [])
            return [o for o in orders if is_completed(o) and o.get("createdAt") and cutoff <= o["createdAt"] < end]

        future = [future_orders(uid) for uid in df["_id"]]
        if target == "churn":
            df["target"] = [0 if f else 1 for f in future]
            df = df[df["frequency"] > 0]  # chỉ khách đã từng mua mới có thể "rời bỏ"
        elif target == "purchase":
            df["target"] = [1 if f else 0 for f in future]
        else:
            df["target"] = [sum(float(o.get("totalPrice", 0)) for o in f) for f in future]

        df["snapshot"] = cutoff
        frames.append(df)

    if not frames:
        return pd.DataFrame()
    data = pd.concat(frames, ignore_index=True)
    if target != "spend":
        data["target"] = data["target"].astype(np.int64)
    return data
