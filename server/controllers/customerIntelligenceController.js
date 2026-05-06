/**
 * Customer Intelligence Controller.
 *
 * Proxies requests to the Python ML microservice running on port 5001.
 * All endpoints require admin authentication.
 */

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";

const proxyToMlService = async (path, options = {}) => {
  const url = `${ML_SERVICE_URL}${path}`;
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const data = await response.json();
  return { status: response.status, data };
};

const getIntelligenceOverview = async (req, res) => {
  try {
    const { status, data } = await proxyToMlService("/api/intelligence/overview");
    return res.status(status).json(data);
  } catch (error) {
    return res.status(503).json({
      message: "ML service is not available. Make sure the Python service is running on port 5001.",
      error: error.message,
    });
  }
};

const getIntelligenceCustomers = async (req, res) => {
  try {
    const params = new URLSearchParams(req.query).toString();
    const path = `/api/intelligence/customers${params ? `?${params}` : ""}`;
    const { status, data } = await proxyToMlService(path);
    return res.status(status).json(data);
  } catch (error) {
    return res.status(503).json({
      message: "ML service is not available.",
      error: error.message,
    });
  }
};

const triggerTraining = async (req, res) => {
  try {
    const { status, data } = await proxyToMlService("/api/intelligence/train", {
      method: "POST",
    });
    return res.status(status).json(data);
  } catch (error) {
    return res.status(503).json({
      message: "ML service is not available.",
      error: error.message,
    });
  }
};

module.exports = {
  getIntelligenceOverview,
  getIntelligenceCustomers,
  triggerTraining,
};
