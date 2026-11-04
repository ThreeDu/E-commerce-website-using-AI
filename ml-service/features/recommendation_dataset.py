"""
Tập dữ liệu (khách, sản phẩm) cho mô hình gợi ý: nhãn 1 nếu khách đã xem/thêm giỏ/mua sản phẩm.
"""

import numpy as np

from data.firestore import load, load_customer_data, load_orders, load_products, load_users, utcnow
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
    # 1. Get all users and their user feature DataFrame
    user_df = build_customer_features(load_customer_data(), utcnow())
    if user_df.empty:
        return np.empty((0, len(RECOMMEND_FEATURE_NAMES))), np.empty((0,))

    # 2. Get all products
    products = load_products()
    if not products:
        return np.empty((0, len(RECOMMEND_FEATURE_NAMES))), np.empty((0,))

    product_map = {p["_id"]: p for p in products}

    # Pre-calculate purchases for each product from non-cancelled orders
    all_orders = load_orders()
    orders = [o for o in all_orders if o.get("status") != "cancelled"]
    purchase_counts = {}
    for o in orders:
        for item in o.get("orderItems", []):
            pid = str(item.get("product", ""))
            if pid:
                purchase_counts[pid] = purchase_counts.get(pid, 0) + int(item.get("quantity", 1))

    # 3. Load interactions: AnalyticsEvents and ChatbotEvents
    # AnalyticsEvent (schema server) không có field productId nên truy vấn cũ luôn rỗng;
    # bỏ hẳn để không tốn ~10k lượt đọc Firestore mỗi lần huấn luyện.
    analytics_events = []

    chatbot_events = [
        e for e in load("chatbotevents", fields=("user", "product", "eventType"))
        if e.get("user") is not None and str(e.get("product")) in product_map
    ]

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
    user_completed_orders = [o for o in all_orders if o.get("user") is not None]
    for o in user_completed_orders:
        uid = str(o["user"])
        for item in o.get("orderItems", []):
            pid = str(item.get("product", ""))
            if pid:
                interacted_pairs.add((uid, pid))

    # 4. Preferred categories per user
    users_raw = [u for u in load_users() if u.get("role") != "admin"]
    user_wishlists = {str(u["_id"]): [str(pid) for pid in u.get("wishlist", [])] for u in users_raw}

    # Construct the dataset rows
    rows = []
    labels = []
    
    for _, user_row in user_df.iterrows():
        uid = str(user_row["_id"])
        
        # User feature vector (16 values)
        user_feats = [float(user_row[col]) for col in FEATURE_NAMES]
        
        # Determine preferred categories based on user's completed orders
        user_orders = [o for o in orders if str(o.get("user")) == uid]
        preferred_cats = set()
        for o in user_orders:
            for item in o.get("orderItems", []):
                p_cat = product_map.get(str(item.get("product")))
                if p_cat:
                    preferred_cats.add(p_cat.get("category", "").lower().strip())
                    
        # Add wishlist categories
        wish_pids = user_wishlists.get(uid, [])
        for wpid in wish_pids:
            wp = product_map.get(wpid)
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
