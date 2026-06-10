from datetime import datetime, timezone, timedelta
from bson import ObjectId
from features.segmentation import segment_customers

def select_intervention_targets(db, df, churn_scores, clv_scores, churn_threshold=50, cooldown_days=7, max_targets=20):
    """
    Identify at-risk customers for retention intervention campaigns.
    
    Parameters:
    - db: MongoDB database instance
    - df: Customer features DataFrame
    - churn_scores: 1D array/series of churn scores (0 to 100)
    - clv_scores: 1D array/series of CLV scores (0 to 100)
    - churn_threshold: Minimum churn score to trigger intervention
    - cooldown_days: Min days between interventions for the same user
    - max_targets: Max number of targets to return (Comment 2 limit = 20)
    
    Returns:
    - List of target customers dicts
    """
    # 1. Segment customers first using segmentation rules
    df_segmented = segment_customers(df, churn_scores, clv_scores)
    
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    cooldown_cutoff = now - timedelta(days=cooldown_days)
    
    targets = []
    for _, row in df_segmented.iterrows():
        user_id_str = str(row["_id"])
        churn_score = float(row["churn_score"])
        clv_score = float(row["potential_score"])  # CLV score was stored as potential_score in segmentation copy
        segment = row["segment"]
        freq = int(row.get("frequency", 0))
        
        # Condition A: Churn score >= threshold
        if churn_score < churn_threshold:
            continue
            
        # Condition B: Must have at least 1 prior order (not a brand new user who never bought)
        if freq < 1:
            continue
            
        # Condition C: Cooldown check — query notifications collection in MongoDB
        # Check if user has received a churn_intervention notification in the last N days
        try:
            recent_intervention_count = db.notifications.count_documents({
                "user": ObjectId(user_id_str),
                "type": "churn_intervention",
                "createdAt": {"$gte": cooldown_cutoff}
            })
            if recent_intervention_count > 0:
                continue
        except Exception as e:
            # Fallback if query fails
            print(f"Error querying notifications for cooldown of {user_id_str}: {e}")
            
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
