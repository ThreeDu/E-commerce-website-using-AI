/**
 * mlClient.js — HTTP client duy nhất gọi sang Python ML service (ml-service/, cổng 5001).
 * Không tự ném lỗi theo status; mỗi caller tự quyết định cách xử lý.
 */
const ML_SERVICE_URL = () => process.env.ML_SERVICE_URL || "http://localhost:5001";

/**
 * @returns {Promise<{status: number, ok: boolean, data: any}>} data là JSON nếu parse được, ngược lại là text
 */
async function requestMl(path, { method = "GET", body, timeoutMs } = {}) {
  const response = await fetch(`${ML_SERVICE_URL()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      // ml-service trên Vercel bắt buộc khóa này (app.py check_api_key)
      ...(process.env.ML_API_KEY ? { "X-ML-Key": process.env.ML_API_KEY } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
  });

  const text = await response.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    // giữ nguyên text (vd. trang lỗi HTML)
  }

  return { status: response.status, ok: response.ok, data };
}

module.exports = { requestMl };
