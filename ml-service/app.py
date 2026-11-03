"""
Customer Intelligence ML Service (Flask).

Dự đoán rời bỏ, khả năng mua (tiềm năng), CLV và điểm gợi ý sản phẩm cho server Node.
Routes: api/routes.py · Chấm điểm: services/scoring.py · Huấn luyện: training/train.py
"""

from flask import Flask
from flask_cors import CORS

from api.routes import bp
from config import FLASK_DEBUG, ML_PORT
from services import scoring


def create_app():
    flask_app = Flask(__name__)
    CORS(flask_app)
    flask_app.register_blueprint(bp)
    return flask_app


_status = scoring.load_models()
if all(_status.values()):
    print("[OK] Loaded saved models from disk (Churn, Potential, CLV, Recommendation).")
else:
    missing = ", ".join(name for name, ok in _status.items() if not ok)
    print(f"[WARN] Missing models: {missing}. Run training first (POST /api/intelligence/train).")

app = create_app()

if __name__ == "__main__":
    print(f"ML Intelligence Service starting on port {ML_PORT}...")
    app.run(host="0.0.0.0", port=ML_PORT, debug=FLASK_DEBUG)
