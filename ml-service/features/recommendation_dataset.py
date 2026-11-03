"""
Tập dữ liệu (khách, sản phẩm) cho mô hình gợi ý: nhãn 1 nếu khách đã xem/thêm giỏ/mua sản phẩm.
"""

import numpy as np
from bson import ObjectId

from data.mongo import get_db, load_customer_data, utcnow
from features.customer_features import FEATURE_NAMES, build_customer_features

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


def extract_recommendation_dataset():
    """
    Generate user-product pairs dataset for training the Recommendation Model.
    """
    db = get_db()
    
    # 1. Get all users and their user feature DataFrame
    user_df = build_customer_features(load_customer_data(db), utcnow())
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
