require("dotenv").config({ path: __dirname + "/../../.env" });
const mongoose = require("mongoose");

const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const ChatbotEvent = require("../models/ChatbotEvent");
const Cart = require("../models/Cart");
const PointHistory = require("../models/PointHistory");
const Notification = require("../models/Notification");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/e-commerce-app";

async function clearMockData() {
  try {
    console.log("Kết nối MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Đã kết nối MongoDB.");

    // 1. Tìm tất cả User mock (email kết thúc bằng @mock.com)
    console.log("Tìm kiếm tài khoản mock...");
    const mockUsers = await User.find({ email: /@mock\.com$/ });
    const mockUserIds = mockUsers.map(u => u._id);
    console.log(`Tìm thấy ${mockUsers.length} tài khoản mock.`);

    // 2. Tìm tất cả Sản phẩm mock (tên chứa "Sản phẩm Mock" hoặc "Mock Product")
    console.log("Tìm kiếm sản phẩm mock...");
    const mockProducts = await Product.find({
      $or: [
        { name: /Sản phẩm Mock/i },
        { name: /Mock Product/i }
      ]
    });
    const mockProductIds = mockProducts.map(p => p._id);
    console.log(`Tìm thấy ${mockProducts.length} sản phẩm mock.`);

    // 3. Xóa các dữ liệu liên quan đến mock user
    let deletedCarts = 0;
    let deletedAnalytics = 0;
    let deletedChatbot = 0;
    let deletedPoints = 0;
    let deletedNotifications = 0;
    let deletedOrders = 0;
    let deletedUsers = 0;
    let deletedProducts = 0;

    if (mockUserIds.length > 0) {
      console.log("Xóa giỏ hàng của tài khoản mock...");
      const cartRes = await Cart.deleteMany({ user: { $in: mockUserIds } });
      deletedCarts = cartRes.deletedCount;

      console.log("Xóa lịch sử sự kiện phân tích của tài khoản mock...");
      const analyticsRes = await AnalyticsEvent.deleteMany({
        $or: [
          { userId: { $in: mockUserIds } },
          { user: { $in: mockUserIds } }
        ]
      });
      deletedAnalytics = analyticsRes.deletedCount;

      console.log("Xóa sự kiện Chatbot của tài khoản mock...");
      const chatbotRes = await ChatbotEvent.deleteMany({ user: { $in: mockUserIds } });
      deletedChatbot = chatbotRes.deletedCount;

      console.log("Xóa lịch sử điểm tích lũy của tài khoản mock...");
      const pointsRes = await PointHistory.deleteMany({ user: { $in: mockUserIds } });
      deletedPoints = pointsRes.deletedCount;

      console.log("Xóa thông báo của tài khoản mock...");
      const notificationRes = await Notification.deleteMany({ user: { $in: mockUserIds } });
      deletedNotifications = notificationRes.deletedCount;

      console.log("Xóa đơn hàng của tài khoản mock...");
      const orderRes = await Order.deleteMany({ user: { $in: mockUserIds } });
      deletedOrders = orderRes.deletedCount;

      console.log("Xóa tài khoản mock...");
      const userRes = await User.deleteMany({ _id: { $in: mockUserIds } });
      deletedUsers = userRes.deletedCount;
    }

    // 4. Xóa đơn hàng chứa sản phẩm mock (nếu còn sót lại)
    if (mockProductIds.length > 0) {
      console.log("Xóa đơn hàng chứa sản phẩm mock...");
      const orderProdRes = await Order.deleteMany({
        "orderItems.product": { $in: mockProductIds }
      });
      deletedOrders += orderProdRes.deletedCount;

      console.log("Xóa sản phẩm mock...");
      const prodRes = await Product.deleteMany({ _id: { $in: mockProductIds } });
      deletedProducts = prodRes.deletedCount;
    }

    console.log("\n====== KẾT QUẢ DỌN DẸP ======");
    console.log(`- Đã xóa ${deletedUsers} tài khoản mock.`);
    console.log(`- Đã xóa ${deletedProducts} sản phẩm mock.`);
    console.log(`- Đã xóa ${deletedOrders} đơn hàng liên quan.`);
    console.log(`- Đã xóa ${deletedCarts} giỏ hàng liên quan.`);
    console.log(`- Đã xóa ${deletedNotifications} thông báo liên quan.`);
    console.log(`- Đã xóa ${deletedPoints} bản ghi tích điểm liên quan.`);
    console.log(`- Đã xóa ${deletedAnalytics} sự kiện phân tích liên quan.`);
    console.log(`- Đã xóa ${deletedChatbot} sự kiện chatbot liên quan.`);
    console.log("=============================\n");

    console.log("Dọn dẹp dữ liệu mock hoàn tất!");
    process.exit(0);
  } catch (err) {
    console.error("Lỗi khi dọn dẹp dữ liệu mock:", err);
    process.exit(1);
  }
}

clearMockData();
