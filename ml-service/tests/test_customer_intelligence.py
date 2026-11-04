"""
Chạy: cd ml-service && python -m unittest discover -s tests
Không cần database: dữ liệu thô được dựng trong bộ nhớ.
"""

import tempfile
import unittest
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from features.customer_features import FEATURE_NAMES, NO_ORDER_RECENCY, build_customer_features
from features.segmentation import segment_customers
from models.tabular import TabularModel
from training.datasets import build_snapshot_dataset, snapshot_cutoffs

NOW = datetime(2026, 11, 1)


def day(n):
    """Ngày thứ n tính từ NOW (âm = quá khứ)."""
    return NOW + timedelta(days=n)


def make_raw():
    loyal, lapsed, newbie, late = ("a" * 24, "b" * 24, "c" * 24, "d" * 24)
    users = [
        {"_id": loyal, "name": "Loyal", "email": "l@x", "phone": "1", "address": "a", "createdAt": day(-200)},
        {"_id": lapsed, "name": "Lapsed", "email": "p@x", "createdAt": day(-200)},
        {"_id": newbie, "name": "New", "email": "n@x", "createdAt": day(-100)},
        {"_id": late, "name": "Late", "email": "t@x", "createdAt": day(-5)},
    ]
    orders = [
        {"user": loyal, "totalPrice": 100, "status": "delivered", "createdAt": day(-150)},
        {"user": loyal, "totalPrice": 200, "status": "delivered", "createdAt": day(-80)},
        {"user": loyal, "totalPrice": 300, "status": "delivered", "createdAt": day(-40)},
        {"user": loyal, "totalPrice": 50, "status": "cancelled", "createdAt": day(-35)},
        {"user": loyal, "totalPrice": 400, "status": "delivered", "createdAt": day(-10)},
        {"user": lapsed, "totalPrice": 500, "status": "delivered", "createdAt": day(-170)},
    ]
    events = [
        {"userId": newbie, "eventName": "product_view", "occurredAt": day(-20)},
        {"userId": newbie, "eventName": "wishlist_add", "occurredAt": day(-20)},
        {"userId": newbie, "eventName": "product_view", "occurredAt": day(-3)},  # sau mốc -15
    ]
    chatbot = [{"user": newbie, "sessionId": "s1", "eventType": "message", "createdAt": day(-18)}]
    return {"users": users, "orders": orders, "events": events, "chatbot": chatbot}, (loyal, lapsed, newbie, late)


class CustomerFeaturesTest(unittest.TestCase):
    def test_only_uses_data_before_as_of(self):
        raw, (loyal, lapsed, newbie, late) = make_raw()
        df = build_customer_features(raw, day(-60)).set_index("_id")

        row = df.loc[str(loyal)]
        self.assertEqual(row["frequency"], 2)            # đơn ở -40, -10 nằm sau mốc
        self.assertEqual(row["monetary"], 300)
        self.assertEqual(row["recency_days"], 20)        # đơn gần nhất trước mốc: -80
        self.assertEqual(row["cancel_rate"], 0)          # đơn hủy ở -35 chưa xảy ra
        self.assertEqual(row["account_age_days"], 140)
        self.assertNotIn(str(late), df.index)            # tạo tài khoản sau mốc

    def test_behaviour_windows(self):
        raw, (_, lapsed, newbie, _) = make_raw()
        df = build_customer_features(raw, day(-15)).set_index("_id")

        self.assertEqual(df.loc[str(newbie), "product_views_30d"], 1)   # lượt xem -3 chưa xảy ra
        self.assertEqual(df.loc[str(newbie), "wishlist_size"], 1)
        self.assertEqual(df.loc[str(newbie), "chatbot_queries_30d"], 1)
        self.assertEqual(df.loc[str(newbie), "recency_days"], NO_ORDER_RECENCY)
        self.assertEqual(df.loc[str(lapsed), "recency_days"], 155)
        self.assertEqual(list(df.columns), ["name", "email"] + FEATURE_NAMES)


class SnapshotDatasetTest(unittest.TestCase):
    def test_cutoffs_leave_room_for_the_horizon(self):
        raw, _ = make_raw()
        cutoffs = snapshot_cutoffs(raw, horizon_days=45, now=NOW)
        self.assertTrue(cutoffs)
        self.assertLessEqual(max(cutoffs), day(-45))
        self.assertGreaterEqual(min(cutoffs), day(-170 + 30))

    def test_labels_come_from_behaviour_after_the_cutoff(self):
        raw, (loyal, lapsed, newbie, _) = make_raw()
        churn = build_snapshot_dataset(raw, "churn", 45, NOW)
        purchase = build_snapshot_dataset(raw, "purchase", 30, NOW)
        spend = build_snapshot_dataset(raw, "spend", 60, NOW)

        def label(data, uid, cutoff):
            row = data[(data["_id"] == str(uid)) & (data["snapshot"] == cutoff)]
            return row["target"].iloc[0] if len(row) else None

        cutoff = day(-45)
        self.assertEqual(label(churn, loyal, cutoff), 0)    # mua lại ở -40, -10
        self.assertEqual(label(churn, lapsed, cutoff), 1)   # không mua lại
        self.assertIsNone(label(churn, newbie, cutoff))     # chưa từng mua -> không thuộc tập rời bỏ
        self.assertEqual(label(purchase, newbie, day(-30)), 0)
        self.assertEqual(label(purchase, loyal, day(-30)), 1)
        self.assertEqual(label(spend, loyal, day(-60)), 700)  # 300 + 400, bỏ đơn hủy


class TabularModelTest(unittest.TestCase):
    def test_learns_separable_signal_and_round_trips(self):
        rng = np.random.default_rng(0)
        n = 400
        X = pd.DataFrame(rng.normal(size=(n, len(FEATURE_NAMES))), columns=FEATURE_NAMES)
        y = (X["recency_days"] > 0).astype(int).to_numpy()
        groups = np.arange(n) // 2

        with tempfile.TemporaryDirectory() as tmp:
            model = TabularModel("churn", "classifier", FEATURE_NAMES, baseline=("recency_days", 1), model_dir=tmp)
            metrics = model.fit_evaluate(X, y, groups)
            self.assertGreater(metrics["roc_auc"], 0.9)
            self.assertEqual(max(model.importance, key=model.importance.get), "recency_days")
            model.save()

            loaded = TabularModel("churn", "classifier", FEATURE_NAMES, model_dir=tmp)
            self.assertTrue(loaded.load())
            np.testing.assert_allclose(loaded.predict(X), model.predict(X))

    def test_regressor_predicts_non_negative_spend(self):
        rng = np.random.default_rng(1)
        X = pd.DataFrame(rng.normal(size=(200, len(FEATURE_NAMES))), columns=FEATURE_NAMES)
        y = np.where(X["monetary"] > 0, 1_000_000, 0)
        with tempfile.TemporaryDirectory() as tmp:
            model = TabularModel("clv", "regressor", FEATURE_NAMES, model_dir=tmp)
            metrics = model.fit_evaluate(X, y, np.arange(200))
            self.assertGreater(metrics["spearman"], 0.8)
            self.assertTrue((model.predict(X) >= 0).all())


class SegmentationTest(unittest.TestCase):
    def test_recent_buyers_with_high_churn_are_at_risk_not_loyal(self):
        df = pd.DataFrame([
            {"recency_days": 10, "frequency": 6, "monetary": 900, "churn_score": 5, "potential_score": 90},
            {"recency_days": 20, "frequency": 4, "monetary": 400, "churn_score": 20, "potential_score": 70},
            {"recency_days": 20, "frequency": 4, "monetary": 400, "churn_score": 95, "potential_score": 5},
            {"recency_days": 25, "frequency": 1, "monetary": 100, "churn_score": 80, "potential_score": 60},
            {"recency_days": 120, "frequency": 2, "monetary": 200, "churn_score": 99, "potential_score": 1},
            {"recency_days": 34, "frequency": 16, "monetary": 900, "churn_score": 1, "potential_score": 96},
            {"recency_days": 999, "frequency": 0, "monetary": 0, "churn_score": 20, "potential_score": 66},
            {"recency_days": 999, "frequency": 0, "monetary": 0, "churn_score": 99, "potential_score": 1},
        ])
        self.assertEqual(
            list(segment_customers(df)["segment"]),
            ["champion", "loyal", "at_risk", "at_risk", "hibernating", "loyal", "potential_loyalist", "lost"],
        )


if __name__ == "__main__":
    unittest.main()
