"""
Truy cập Cloud Firestore cho ml-service (thay MongoDB).

Thông tin xác thực, theo thứ tự ưu tiên (giống server Node):
  - FIRESTORE_EMULATOR_HOST: chạy với Firestore Emulator, không cần key
  - FIREBASE_SERVICE_ACCOUNT: nội dung JSON của key
  - GOOGLE_APPLICATION_CREDENTIALS: đường dẫn file key (tương đối với thư mục gốc repo)

Gói Spark chỉ cho 50.000 lượt đọc/ngày nên dữ liệu đọc cho toàn bộ khách được cache CACHE_SECONDS
giây trong bộ nhớ tiến trình, và khi chấm điểm chỉ đọc sự kiện hành vi EVENTS_WINDOW_DAYS ngày gần nhất.
"""

import json
import os
import time
from datetime import datetime, timedelta, timezone

from google.auth.credentials import AnonymousCredentials
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from config import CACHE_SECONDS, EVENTS_WINDOW_DAYS, ROOT_DIR

_client = None
_cache = {}


def get_db():
    global _client
    if _client is None:
        project = os.getenv("FIREBASE_PROJECT_ID", "e-commerce-website-using-ai")
        if os.getenv("FIRESTORE_EMULATOR_HOST"):
            _client = firestore.Client(project=project, credentials=AnonymousCredentials())
        elif os.getenv("FIREBASE_SERVICE_ACCOUNT"):
            _client = firestore.Client.from_service_account_info(json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"]))
        elif os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
            _client = firestore.Client.from_service_account_json(
                os.path.join(ROOT_DIR, os.environ["GOOGLE_APPLICATION_CREDENTIALS"])
            )
        else:
            _client = firestore.Client(project=project)
    return _client


def utcnow():
    """Thời điểm hiện tại dạng UTC naive, cùng kiểu với datetime đọc ra qua to_plain()."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_plain(value):
    """Datetime có múi giờ của Firestore -> UTC naive (đệ quy), để phép trừ ngày như trước vẫn đúng."""
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value
    if isinstance(value, list):
        return [to_plain(v) for v in value]
    if isinstance(value, dict):
        return {k: to_plain(v) for k, v in value.items()}
    return value


def load(collection, where=(), fields=None):
    """Đọc document của một collection thành list dict có "_id". where: các bộ (field, op, value)."""
    query = get_db().collection(collection)
    for field, op, value in where:
        query = query.where(filter=FieldFilter(field, op, value))
    if fields:
        query = query.select(list(fields))
    return [{"_id": snap.id, **to_plain(snap.to_dict())} for snap in query.stream()]


def get(collection, doc_id):
    snap = get_db().collection(collection).document(str(doc_id)).get()
    return {"_id": snap.id, **to_plain(snap.to_dict())} if snap.exists else None


def cached(key, loader):
    """Kết quả loader() được giữ CACHE_SECONDS giây (mỗi tiến trình)."""
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < CACHE_SECONDS:
        return hit[1]
    value = loader()
    _cache[key] = (time.monotonic(), value)
    return value


def clear_cache():
    _cache.clear()


def empty_customer_data():
    return {"users": [], "orders": [], "events": [], "chatbot": []}


USER_FIELDS = ("name", "email", "phone", "address", "createdAt", "role")


def load_customer_data(user_id=None, events_since_days=EVENTS_WINDOW_DAYS):
    """
    Dữ liệu thô của khách hàng (không gồm admin): users, orders, analytics events, chatbot events
    (chỉ loại "message": đặc trưng chatbot chỉ đếm phiên/câu hỏi). Cắt theo mốc as_of làm ở bước
    tính đặc trưng. events_since_days=None: đọc toàn bộ lịch sử sự kiện (dùng khi huấn luyện).
    """
    if user_id is not None:
        user = get("users", user_id)
        if not user or user.get("role") == "admin":
            return empty_customer_data()
        uid = user["_id"]
        since = None if events_since_days is None else utcnow() - timedelta(days=events_since_days)
        events = load("analyticsevents", [("userId", "==", uid)], ("userId", "eventName", "occurredAt"))
        return {
            "users": [user],
            "orders": load("orders", [("user", "==", uid)]),
            # cùng cửa sổ sự kiện với lúc chấm điểm toàn bộ khách
            "events": [e for e in events if since is None or (e.get("occurredAt") and e["occurredAt"] >= since)],
            "chatbot": load("chatbotevents", [("user", "==", uid), ("eventType", "==", "message")],
                            ("user", "sessionId", "eventType", "createdAt")),
        }

    def load_all():
        event_filter = []
        if events_since_days is not None:
            event_filter = [("occurredAt", ">=", utcnow() - timedelta(days=events_since_days))]
        users = [u for u in load("users", fields=USER_FIELDS) if u.get("role") != "admin"]
        ids = {u["_id"] for u in users}
        return {
            "users": users,
            "orders": [o for o in load_orders() if str(o.get("user")) in ids],
            "events": [e for e in load("analyticsevents", event_filter, ("userId", "eventName", "occurredAt"))
                       if str(e.get("userId")) in ids],
            "chatbot": [e for e in load("chatbotevents", [("eventType", "==", "message")],
                                        ("user", "sessionId", "eventType", "createdAt"))
                        if str(e.get("user")) in ids],
        }

    if events_since_days is None:
        return load_all()
    return cached(("customers", events_since_days), load_all)


def load_orders():
    return cached("orders", lambda: load("orders"))


def load_products():
    return cached("products", lambda: load("products", fields=(
        "name", "category", "price", "finalPrice", "discountPercent", "averageRating", "totalViews")))


def load_users():
    return cached("users", lambda: load("users", fields=("name", "email", "role", "wishlist")))
