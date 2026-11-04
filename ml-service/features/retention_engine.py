from datetime import datetime, timezone, timedelta
from data.firestore import load

def select_intervention_targets(df, churn_threshold=50, cooldown_days=7, max_targets=20):
    """
    Identify at-risk customers for retention intervention campaigns.
    
    Parameters:
    - df: Customer DataFrame đã chấm điểm (churn_score, clv_score, segment, frequency, ...)
    - churn_threshold: Minimum churn score to trigger intervention
    - cooldown_days: Min days between interventions for the same user
    - max_targets: Max number of targets to return (Comment 2 limit = 20)
    
    Returns:
    - List of target customers dicts
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    cooldown_cutoff = now - timedelta(days=cooldown_days)
    
    # Người đã nhận thông báo giữ chân trong thời gian cooldown (đọc một lần thay vì đếm theo từng khách)
    try:
        recently_contacted = {
            str(n.get("user")) for n in load("notifications", [("type", "==", "churn_intervention")], ("user", "createdAt"))
            if n.get("createdAt") and n["createdAt"] >= cooldown_cutoff
        }
    except Exception as e:
        print(f"Error querying churn_intervention notifications for cooldown: {e}")
        recently_contacted = set()

    targets = []
    for _, row in df.iterrows():
        user_id_str = str(row["_id"])
        churn_score = float(row["churn_score"])
        clv_score = float(row["clv_score"])
        segment = row["segment"]
        freq = int(row.get("frequency", 0))
        
        # Condition A: Churn score >= threshold
        if churn_score < churn_threshold:
            continue
            
        # Condition B: Must have at least 1 prior order (not a brand new user who never bought)
        if freq < 1:
            continue
            
        # Condition C: Cooldown check — notifications đã nạp sẵn từ Firestore
        # Check if user has received a churn_intervention notification in the last N days
        if user_id_str in recently_contacted:
            continue
            
        # Determine recommended action and voucher details based on Churn and CLV (ML self-decision)
        recommended_action = "notification_only"
        recommended_discount = None
        
        if clv_score > 60:
            if churn_score > 60:
                recommended_action = "voucher"
                recommended_discount = {
                    "type": "percent",
                    "value": 15,
                    "min_order": 200000
                }
            else: # churn_score is 50-60 (medium)
                recommended_action = "voucher"
                recommended_discount = {
                    "type": "percent",
                    "value": 10,
                    "min_order": 150000
                }
        else:
            # Low-Medium CLV: Only remind via notifications to control discount budget
            recommended_action = "notification_only"
            
        # Calculate target priority to select top N customers if there are more than max_targets
        # Priority = churn_score * CLV score
        priority = churn_score * clv_score
        
        targets.append({
            "user_id": user_id_str,
            "user_name": row.get("name", "Khách hàng"),
            "user_email": row.get("email", ""),
            "churn_score": churn_score,
            "clv_score": clv_score,
            "segment": segment,
            "recommended_action": recommended_action,
            "recommended_discount": recommended_discount,
            "priority": priority
        })
        
    # Sort targets by priority descending
    targets.sort(key=lambda x: x["priority"], reverse=True)
    
    # Apply limit
    return targets[:max_targets]
