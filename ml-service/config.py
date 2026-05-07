import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/e-commerce-app")
DB_NAME = os.getenv("ML_DB_NAME", "e-commerce-app")
ML_PORT = int(os.getenv("ML_SERVICE_PORT", "5001"))

MODEL_DIR = os.path.join(os.path.dirname(__file__), "saved_models")
os.makedirs(MODEL_DIR, exist_ok=True)

# Feature engineering defaults
RECENCY_WINDOW_DAYS = 30
TREND_COMPARE_DAYS = 60
CHURN_INACTIVE_DAYS = 30
CHURN_NO_ORDER_DAYS = 45
