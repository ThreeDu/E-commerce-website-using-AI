"""
Customer Intelligence ML Service (Flask).

Dự đoán rời bỏ, khả năng mua (tiềm năng), CLV và điểm gợi ý sản phẩm cho server Node.
Routes: api/routes.py · Chấm điểm: services/scoring.py · Huấn luyện: training/train.py
"""

import hmac

from flask import Flask, jsonify, request
from flask_cors import CORS

from api.routes import bp
from config import FLASK_DEBUG, ML_API_KEY, ML_PORT, ON_VERCEL
from services import scoring


def check_api_key():
    """Chặn request không có X-ML-Key đúng. Local không đặt ML_API_KEY thì bỏ qua; trên Vercel bắt buộc."""
    if request.path.endswith("/health"):
        return None
    if not ML_API_KEY:
        if ON_VERCEL:
            return jsonify({"message": "ML_API_KEY chưa được cấu hình."}), 503
        return None
    if not hmac.compare_digest(request.headers.get("X-ML-Key", ""), ML_API_KEY):
        return jsonify({"message": "Unauthorized"}), 401
    return None


def create_app():
    flask_app = Flask(__name__)
    CORS(flask_app)
    flask_app.before_request(check_api_key)
    flask_app.register_blueprint(bp)
    return flask_app


_status = scoring.load_models()
if all(_status.values()):
    print("[OK] Loaded saved models from disk (Churn, Potential, CLV, Recommendation).")
else:
    missing = ", ".join(name for name, ok in _status.items() if not ok)
    print(f"[WARN] Missing models: {missing}. Run training first: python ml-service/training/train.py")

app = create_app()

if __name__ == "__main__":
    print(f"ML Intelligence Service starting on port {ML_PORT}...")
    app.run(host="0.0.0.0", port=ML_PORT, debug=FLASK_DEBUG)
