// Nạp .env trước mọi require khác: nhiều module đọc process.env lúc load.
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const pointRoutes = require("./routes/pointRoutes");
const chatbotRoutes = require("./chatbot-service/chatbotRoutes");
const adminChatbotRoutes = require("./admin-chatbot/adminChatRoutes");
const chatbotAnalyticsRoutes = require("./routes/chatbotAnalyticsRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const { downloadReport } = require("./admin-chatbot/reportGenerator");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(
  express.json({
    limit: "4mb", // Vercel giới hạn request body 4.5MB
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

app.get("/api/reports/:id", downloadReport);

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/admin/chatbot", adminChatbotRoutes);
app.use("/api/admin/chatbot-analytics", chatbotAnalyticsRoutes);
app.use("/api/points", pointRoutes);
app.use("/api/payments", paymentRoutes);

app.get("/api/health", (req, res) => {
  res.json({ message: "API is running" });
});

// Vercel import app làm serverless function (api/index.js); local thì chạy server như cũ.
// Firestore (server/db/firestore.js) kết nối lười ở lần truy vấn đầu tiên, không cần bước connect.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
