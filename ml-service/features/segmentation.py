import numpy as np
import pandas as pd

SEGMENTS = {
    "champion": "🏆 Champion — Mua thường xuyên, chi tiêu cao, gần đây",
    "loyal": "💎 Loyal — Mua đều đặn, gắn bó lâu dài",
    "potential_loyalist": "🌟 Potential Loyalist — Khách mới có tiềm năng cao",
    "at_risk": "⚠️ At Risk — Từng mua nhiều nhưng đang giảm hoạt động",
    "hibernating": "😴 Hibernating — Đã lâu không quay lại",
    "lost": "❌ Lost — Hoàn toàn mất liên lạc"
}

def segment_customers(df, churn_scores, potential_scores):
    """
    Classify customers into 6 segments based on RFM features and ML scores.
    
    Parameters:
    - df: DataFrame with feature columns
    - churn_scores: 1D array/series of churn scores (0 to 100)
    - potential_scores: 1D array/series of potential scores (0 to 100)
    
    Returns:
    - DataFrame with an additional 'segment' column and score columns
    """
    df_copy = df.copy()
    df_copy["churn_score"] = churn_scores
    df_copy["potential_score"] = potential_scores
    
    # Calculate monetary threshold for top 20%
    ordered_users = df_copy[df_copy["frequency"] > 0]
    if not ordered_users.empty:
        monetary_80th = ordered_users["monetary"].quantile(0.8)
    else:
        monetary_80th = 0.0

    segments = []
    for _, row in df_copy.iterrows():
        recency = row.get("recency_days", 999)
        freq = row.get("frequency", 0)
        monetary = row.get("monetary", 0.0)
        churn = row.get("churn_score", 0.0)
        potential = row.get("potential_score", 0.0)

        # Champion
        if recency <= 14 and freq >= 5 and monetary >= monetary_80th and freq > 0:
            segments.append("champion")
        # Loyal
        elif recency <= 30 and freq >= 3:
            segments.append("loyal")
        # Potential Loyalist
        elif recency <= 30 and 1 <= freq <= 2 and potential >= 50:
            segments.append("potential_loyalist")
        # At Risk
        elif 31 <= churn <= 70 and freq >= 2:
            segments.append("at_risk")
        # Hibernating
        elif 71 <= churn <= 90 or (recency > 45 and freq >= 1):
            segments.append("hibernating")
        # Lost / Default
        else:
            segments.append("lost")

    df_copy["segment"] = segments
    return df_copy

def get_segment_distribution(df_segmented):
    """
    Return the distribution counts of each segment.
    """
    counts = df_segmented["segment"].value_counts().to_dict()
    dist = {}
    for key in SEGMENTS.keys():
        dist[key] = int(counts.get(key, 0))
    return dist
