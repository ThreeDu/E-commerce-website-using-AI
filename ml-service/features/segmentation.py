SEGMENTS = {
    "champion": "🏆 Champion — Mua thường xuyên, chi tiêu cao, gần đây",
    "loyal": "💎 Loyal — Mua đều đặn, gắn bó lâu dài",
    "potential_loyalist": "🌟 Potential Loyalist — Khách mới có tiềm năng cao",
    "at_risk": "⚠️ At Risk — Từng mua nhiều nhưng đang giảm hoạt động",
    "hibernating": "😴 Hibernating — Đã lâu không quay lại",
    "lost": "❌ Lost — Hoàn toàn mất liên lạc"
}


# Trên ngưỡng này khách được coi là có nguy cơ rời bỏ (khớp churn_threshold mặc định của retention)
HIGH_CHURN = 50


def _segment(row, monetary_80th):
    recency = row.get("recency_days", 999)
    freq = row.get("frequency", 0)
    monetary = row.get("monetary", 0.0)
    churn = row.get("churn_score", 0.0)
    potential = row.get("potential_score", 0.0)
    likely_to_stay = churn <= HIGH_CHURN

    # Nhóm "tốt" chỉ dành cho khách mô hình dự đoán còn ở lại; RFM gần đây thôi chưa đủ
    if likely_to_stay and freq > 0 and recency <= 14 and freq >= 5 and monetary >= monetary_80th:
        return "champion"
    if likely_to_stay and recency <= 30 and freq >= 3:
        return "loyal"
    if likely_to_stay and recency <= 30 and 1 <= freq <= 2 and potential >= 50:
        return "potential_loyalist"
    # Mới mua gần đây nhưng mô hình báo sắp rời bỏ -> cần giữ chân ngay
    if freq >= 1 and recency <= 45 and not likely_to_stay:
        return "at_risk"
    if 30 < churn <= 70 and freq >= 2:
        return "at_risk"
    if 70 < churn <= 90 or (recency > 45 and freq >= 1):
        return "hibernating"
    # Không rơi vào nhóm nào ở trên nhưng mô hình dự đoán còn ở lại: không phải "lost"
    if likely_to_stay and freq >= 3:
        return "loyal"
    if likely_to_stay and potential >= 50:
        return "potential_loyalist"  # gồm cả khách mới đăng ký chưa mua nhưng khả năng mua cao
    return "lost"


def segment_customers(df):
    """
    Gán cột ``segment`` (6 nhóm) dựa trên RFM và điểm ML.
    ``df`` cần các cột recency_days, frequency, monetary, churn_score, potential_score.
    """
    df_copy = df.copy()
    ordered_users = df_copy[df_copy["frequency"] > 0]
    monetary_80th = ordered_users["monetary"].quantile(0.8) if not ordered_users.empty else 0.0
    df_copy["segment"] = [_segment(row, monetary_80th) for _, row in df_copy.iterrows()]
    return df_copy


def get_segment_distribution(df_segmented):
    """Số khách trong mỗi nhóm (đủ 6 nhóm, kể cả nhóm rỗng)."""
    counts = df_segmented["segment"].value_counts().to_dict()
    return {key: int(counts.get(key, 0)) for key in SEGMENTS}
