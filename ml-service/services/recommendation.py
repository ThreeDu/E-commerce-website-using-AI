"""
Chấm điểm gợi ý sản phẩm cho một khách (logic giữ nguyên từ app.py cũ).
"""

import numpy as np
import pandas as pd
from bson import ObjectId

from data.mongo import get_db
from features.customer_features import FEATURE_NAMES
from services import scoring
from services.scoring import customer_features


def score_products(user_id, product_ids):
    """Trả về dict product_id -> xác suất khách quan tâm sản phẩm (0-1)."""
    if not product_ids:
        return {}
        
    db = get_db()
    
    # Get user feature vector
    user_df = pd.DataFrame()
    if user_id:
        try:
            user_df = customer_features(user_id)
        except Exception:
            pass
            
    if user_df.empty:
        # Fallback for anonymous
        user_feats = [0.0] * len(FEATURE_NAMES)
        preferred_cats = set()
    else:
        user_row = user_df.iloc[0]
        user_feats = [float(user_row[col]) for col in FEATURE_NAMES]
        
        # Fetch preferred categories and wishlist for user
        uid_obj = ObjectId(str(user_id))
        user_orders = list(db.orders.find({"user": uid_obj, "status": {"$ne": "cancelled"}}, {"orderItems": 1}))
        preferred_cats = set()
        for o in user_orders:
            for item in o.get("orderItems", []):
                p_cat = db.products.find_one({"_id": item.get("product")}, {"category": 1})
                if p_cat:
                    preferred_cats.add(p_cat.get("category", "").lower().strip())
                    
        user_raw = db.users.find_one({"_id": uid_obj}, {"wishlist": 1})
        user_wishlist = [str(pid) for pid in user_raw.get("wishlist", [])] if user_raw else []
        for wpid in user_wishlist:
            try:
                wp = db.products.find_one({"_id": ObjectId(wpid)}, {"category": 1})
                if wp:
                    preferred_cats.add(wp.get("category", "").lower().strip())
            except Exception:
                pass

    # Pre-calculate purchases for each product
    product_object_ids = []
    for pid in product_ids:
        try:
            product_object_ids.append(ObjectId(str(pid)))
        except Exception:
            pass
            
    orders = list(db.orders.find(
        {"status": {"$ne": "cancelled"}, "orderItems.product": {"$in": product_object_ids}},
        {"orderItems": 1}
    ))
    purchase_counts = {}
    for o in orders:
        for item in o.get("orderItems", []):
            p_id_str = str(item.get("product", ""))
            purchase_counts[p_id_str] = purchase_counts.get(p_id_str, 0) + int(item.get("quantity", 1))

    # Fetch all candidate products
    products = list(db.products.find(
        {"_id": {"$in": product_object_ids}},
        {"category": 1, "price": 1, "finalPrice": 1, "discountPercent": 1, "averageRating": 1, "totalViews": 1}
    ))
    product_map = {str(p["_id"]): p for p in products}

    # Load user specific interactions with these products if user exists
    view_counts = {}
    cart_counts = {}
    if user_id:
        try:
            # AnalyticsEvents
            ae_list = list(db.analyticsevents.find(
                {"userId": ObjectId(user_id), "productId": {"$in": product_object_ids}},
                {"productId": 1, "eventName": 1}
            ))
            for e in ae_list:
                pid_str = str(e["productId"])
                evt = e.get("eventName", "")
                if evt == "product_view":
                    view_counts[pid_str] = view_counts.get(pid_str, 0) + 1
                elif evt == "add_to_cart":
                    cart_counts[pid_str] = cart_counts.get(pid_str, 0) + 1
        except Exception:
            pass
            
        try:
            # ChatbotEvents
            ce_list = list(db.chatbotevents.find(
                {"user": ObjectId(user_id), "product": {"$in": product_object_ids}},
                {"product": 1, "eventType": 1}
            ))
            for e in ce_list:
                pid_str = str(e["product"])
                evt = e.get("eventType", "")
                if evt in ["view", "click"]:
                    view_counts[pid_str] = view_counts.get(pid_str, 0) + 1
                elif evt == "cart":
                    cart_counts[pid_str] = cart_counts.get(pid_str, 0) + 1
        except Exception:
            pass

    # Prepare feature vectors for the Random Forest model
    X_list = []
    pids_to_predict = []
    
    for pid_str in product_ids:
        p = product_map.get(pid_str)
        if not p:
            continue
            
        pids_to_predict.append(pid_str)
        
        # Product features
        price = float(p.get("finalPrice", p.get("price", 0)))
        discount = float(p.get("discountPercent", 0))
        rating = float(p.get("averageRating", 0))
        views = float(p.get("totalViews", 0))
        purchases = float(purchase_counts.get(pid_str, 0))
        
        # Match features
        p_cat = str(p.get("category", "")).lower().strip()
        is_pref = 1.0 if p_cat in preferred_cats else 0.0
        u_views = float(view_counts.get(pid_str, 0))
        u_carts = float(cart_counts.get(pid_str, 0))
        
        feats = user_feats + [
            price,
            discount,
            rating,
            views,
            purchases,
            is_pref,
            u_views,
            u_carts
        ]
        X_list.append(feats)

    scores = {}
    if X_list and scoring.recommendation_model.is_trained:
        probs = scoring.recommendation_model.predict(np.array(X_list))
        for pid_str, prob in zip(pids_to_predict, probs):
            scores[pid_str] = round(float(prob), 4)
    else:
        # Fallback score if not trained
        for pid_str in product_ids:
            p = product_map.get(pid_str)
            if p:
                rating = float(p.get("averageRating", 0))
                views = float(p.get("totalViews", 0))
                scores[pid_str] = round((rating / 5.0) * 0.5 + min(0.5, views / 100.0) * 0.5, 4)
            else:
                scores[pid_str] = 0.0

    return scores
