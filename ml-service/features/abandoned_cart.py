from data.firestore import load, load_orders, load_products, load_users
from datetime import datetime, timezone, timedelta

def detect_abandoned_carts(churn_scores_dict=None, hours_threshold=24):
    """
    Detect abandoned carts from Firestore.
    
    Parameters:
    - churn_scores_dict: Dict of user_id (str) -> churn_score (float)
    - hours_threshold: Number of hours to consider a cart stale/abandoned
    
    Returns:
    - List of abandoned cart details, sorted by priority_score descending
    """
    if churn_scores_dict is None:
        churn_scores_dict = {}

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    threshold_time = now - timedelta(hours=hours_threshold)
    
    # Giỏ chưa cập nhật từ trước ngưỡng và còn sản phẩm
    carts = [
        c for c in load("carts")
        if c.get("updatedAt") and c["updatedAt"] < threshold_time and c.get("items")
    ]
    
    results = []
    
    if not carts:
        return results

    # Users / products / orders nạp một lần (có cache) rồi tra bằng dict, thay vì truy vấn theo từng giỏ
    user_map = {u["_id"]: u for u in load_users()}
    product_map = {p["_id"]: p for p in load_products()}
    order_times_by_user = {}
    for o in load_orders():
        if o.get("createdAt"):
            order_times_by_user.setdefault(str(o.get("user")), []).append(o["createdAt"])
    
    for cart in carts:
        user_id_str = str(cart["user"])
        user_info = user_map.get(user_id_str)
        
        # If user no longer exists, skip
        if not user_info:
            continue
            
        # Check if the user has created any orders after the cart was last updated
        cart_updated_at = cart["updatedAt"]
        new_orders_count = sum(1 for t in order_times_by_user.get(user_id_str, []) if t > cart_updated_at)
        
        if new_orders_count > 0:
            # User completed a purchase or ordered something else after this cart update
            continue
            
        # Process cart items
        items_list = []
        estimated_value = 0.0
        
        for item in cart.get("items", []):
            prod_id_str = str(item.get("product"))
            prod_info = product_map.get(prod_id_str, {})
            price = prod_info.get("price", 0.0)
            name = prod_info.get("name", "Sản phẩm không tên")
            qty = item.get("quantity", 1)
            
            estimated_value += price * qty
            items_list.append({
                "product_id": prod_id_str,
                "product_name": name,
                "quantity": qty,
                "price": price
            })
            
        if not items_list:
            continue
            
        hours_abandoned = round((now - cart_updated_at).total_seconds() / 3600.0, 1)
        churn_score = float(churn_scores_dict.get(user_id_str, 50.0))
        
        # Calculate Priority Score (0-100)
        # 1. Cart Value Weight (40%): Max 40 points for 2,000,000 VND
        val_points = min(estimated_value / 2000000.0, 1.0) * 40.0
        
        # 2. Abandoned Time Weight (30%): 30 points if 24-72 hours, decays afterwards
        if 24 <= hours_abandoned <= 72:
            time_points = 30.0
        elif hours_abandoned < 24:
            # Less than 24h gets slightly lower points since they might still buy
            time_points = (hours_abandoned / 24.0) * 30.0
        else:
            # Decay points after 72h (3 days)
            days_after_3 = (hours_abandoned - 72.0) / 24.0
            time_points = max(30.0 - (days_after_3 * 5.0), 5.0)
            
        # 3. Churn score weight (30%): Low-medium churn is easier to win back (higher priority)
        # Churn score of 0 gives 30 points, Churn score of 100 gives 0 points
        churn_points = (1.0 - (churn_score / 100.0)) * 30.0
        
        priority_score = round(val_points + time_points + churn_points, 1)
        
        results.append({
            "user_id": user_id_str,
            "user_name": user_info.get("name", "Khách hàng"),
            "user_email": user_info.get("email", ""),
            "items": items_list,
            "estimated_value": estimated_value,
            "hours_abandoned": hours_abandoned,
            "priority_score": priority_score,
            "churn_score": churn_score
        })
        
    # Sort by priority score descending
    results.sort(key=lambda x: x["priority_score"], reverse=True)
    return results
