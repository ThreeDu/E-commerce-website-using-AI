"""
Truy cập MongoDB dùng chung: một client cho cả tiến trình và hàm nạp dữ liệu thô
cho feature engineering.
"""

from datetime import datetime, timezone

from bson import ObjectId
from pymongo import MongoClient

from config import MONGO_URI, DB_NAME

_client = None


def get_db():
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI)
    return _client[DB_NAME]


def utcnow():
    """Thời điểm hiện tại dạng UTC naive, cùng kiểu với datetime lưu trong MongoDB."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def empty_customer_data():
    return {"users": [], "orders": [], "events": [], "chatbot": []}


def load_customer_data(db=None, user_id=None):
    """
    Nạp dữ liệu thô của khách hàng (không gồm admin): users, orders, analytics events,
    chatbot events. ``user_id`` để giới hạn cho một khách. Không lọc theo thời gian:
    việc cắt theo mốc as_of làm ở bước tính đặc trưng.
    """
    db = db if db is not None else get_db()
    user_filter = {"role": {"$ne": "admin"}}
    if user_id is not None:
        try:
            user_filter["_id"] = ObjectId(str(user_id))
        except Exception:
            return empty_customer_data()

    users = list(db.users.find(user_filter, {"name": 1, "email": 1, "phone": 1, "address": 1, "createdAt": 1}))
    ids = [u["_id"] for u in users]
    if not ids:
        return empty_customer_data()

    return {
        "users": users,
        "orders": list(db.orders.find({"user": {"$in": ids}}, {"user": 1, "totalPrice": 1, "status": 1, "createdAt": 1})),
        "events": list(db.analyticsevents.find({"userId": {"$in": ids}}, {"userId": 1, "eventName": 1, "occurredAt": 1})),
        "chatbot": list(db.chatbotevents.find({"user": {"$in": ids}}, {"user": 1, "sessionId": 1, "eventType": 1, "createdAt": 1})),
    }
