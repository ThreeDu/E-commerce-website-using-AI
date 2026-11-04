import os
from dotenv import load_dotenv

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

# Firestore (gói Spark: 50k lượt đọc/ngày): cache dữ liệu đọc cho toàn bộ khách và chỉ đọc
# sự kiện hành vi trong cửa sổ gần nhất khi chấm điểm (đủ cho cửa sổ đặc trưng 30/60 ngày)
CACHE_SECONDS = int(os.getenv("ML_CACHE_SECONDS", "600"))
EVENTS_WINDOW_DAYS = 60
ML_PORT = int(os.getenv("ML_SERVICE_PORT", "5001"))
FLASK_DEBUG = os.getenv("FLASK_DEBUG") == "1"

MODEL_DIR = os.path.join(os.path.dirname(__file__), "saved_models")
os.makedirs(MODEL_DIR, exist_ok=True)

# Cửa sổ tính đặc trưng hành vi (tính lùi từ thời điểm as_of)
RECENCY_WINDOW_DAYS = 30
TREND_COMPARE_DAYS = 60

# Nhãn theo thời gian: hành vi thật trong N ngày SAU mốc snapshot
CHURN_HORIZON_DAYS = 45      # rời bỏ = khách đã từng mua nhưng không mua lại trong 45 ngày
POTENTIAL_HORIZON_DAYS = 30  # tiềm năng = xác suất phát sinh đơn trong 30 ngày tới
# 60 thay vì 90 ngày: dữ liệu đơn/hành vi hiện chỉ trải ~6 tháng, 90 ngày để lại quá ít mốc có đặc trưng.
CLV_HORIZON_DAYS = int(os.getenv("CLV_HORIZON_DAYS", "60"))

SNAPSHOT_STEP_DAYS = 7   # khoảng cách giữa các mốc snapshot khi dựng tập huấn luyện
MIN_HISTORY_DAYS = 30    # mốc đầu tiên cách đơn hàng đầu tiên trong hệ thống ít nhất N ngày

# Ngưỡng phân mức điểm 0-100: (0,30] thấp, (30,60] trung bình, (60,100] cao
LEVEL_MEDIUM_ABOVE = 30
LEVEL_HIGH_ABOVE = 60
