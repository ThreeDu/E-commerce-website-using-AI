require("dotenv").config({ path: __dirname + "/../../.env" });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const ChatbotEvent = require("../models/ChatbotEvent");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/e-commerce-app";

const NUM_USERS = 30;
const NUM_PRODUCTS = 20;

async function seed() {
  try {
    console.log("Kết nối MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Đã kết nối MongoDB.");

    // Delete existing ML mock data if we want a fresh state (optional, but here we just append or clear)
    // To be safe and not delete real admin data, we only delete users with email ending in @mock.com
    console.log("Xoá dữ liệu mock cũ...");
    const mockUsers = await User.find({ email: /@mock\.com$/ });
    const mockUserIds = mockUsers.map(u => u._id);
    
    await Order.deleteMany({ user: { $in: mockUserIds } });
    await AnalyticsEvent.deleteMany({ userId: { $in: mockUserIds } });
    await ChatbotEvent.deleteMany({ user: { $in: mockUserIds } });
    await User.deleteMany({ _id: { $in: mockUserIds } });
    
    // Create Products
    console.log("Tạo sản phẩm mock...");
    const products = [];
    const brands = ["samsung", "iphone", "xiaomi", "macbook", "ipad"];
    for (let i = 1; i <= NUM_PRODUCTS; i++) {
      const brand = brands[Math.floor(Math.random() * brands.length)];
      const price = Math.floor(Math.random() * 20000000) + 5000000;
      
      let p = new Product({
        name: `Sản phẩm Mock ${brand} ${i} Pro 256GB`,
        price: price,
        description: "Đây là sản phẩm tự động tạo ra để test ML.",
        category: brand === "macbook" ? "laptop" : "dien thoai",
        stock: 100,
        finalPrice: price * 0.9,
      });
      await p.save();
      products.push(p);
    }
    
    const passwordHash = await bcrypt.hash("123456", 10);

    // Create Users & Events
    console.log("Tạo user và event mock...");
    const now = new Date();
    
    for (let i = 1; i <= NUM_USERS; i++) {
      // Xác định loại user (1 = High Churn, 2 = High Potential, 3 = Normal)
      const type = i % 3; 
      
      const u = new User({
        name: `Mock User ${i}`,
        email: `user${i}@mock.com`,
        password: passwordHash,
        phone: "0900000000",
        address: "Hà Nội, Việt Nam",
        createdAt: new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000) // 100 ngày trước
      });
      
      // Random wishlist
      if (type === 2) {
        // High potential có nhiều wishlist
        u.wishlist = [
          products[Math.floor(Math.random() * NUM_PRODUCTS)]._id,
          products[Math.floor(Math.random() * NUM_PRODUCTS)]._id,
        ];
      }
      
      await u.save();
      const uid = u._id;

      // Tạo Orders
      if (type === 1) {
        // High Churn: Đơn hàng từ rất lâu (45-60 ngày trước), ko có đơn mới
        const orderDate = new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000);
        await createOrder(uid, products, orderDate);
      } else if (type === 2) {
        // High Potential: Nhiều đơn hàng gần đây
        const orderDate1 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        const orderDate2 = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
        await createOrder(uid, products, orderDate1);
        await createOrder(uid, products, orderDate2);
      } else {
        // Normal: 1 đơn hàng tháng trước
        const orderDate = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
        await createOrder(uid, products, orderDate);
      }
      
      // Tạo Analytics Events
      if (type === 1) {
        // High Churn: Ko có event trong 30 ngày gần đây
        await createEvents(uid, "product_view", 5, 40); 
      } else if (type === 2) {
        // High Potential: Rất nhiều event gần đây
        await createEvents(uid, "product_view", 20, 2);
        await createEvents(uid, "add_to_cart", 8, 2);
        await createEvents(uid, "wishlist_add", 4, 3);
      } else {
        // Normal
        await createEvents(uid, "product_view", 8, 10);
        await createEvents(uid, "add_to_cart", 2, 10);
      }
      
      // Tạo Chatbot Events
      if (type === 2) {
        await createChatbotEvents(uid, 5, 2);
      } else if (type === 0) {
        await createChatbotEvents(uid, 1, 15);
      }
    }
    
    console.log("Hoàn thành bơm dữ liệu!");
    process.exit(0);
  } catch (err) {
    console.error("Lỗi:", err);
    process.exit(1);
  }
}

async function createOrder(userId, products, date) {
  const p = products[Math.floor(Math.random() * products.length)];
  const o = new Order({
    user: userId,
    shippingAddress: { fullName: "Mock User", phone: "090", address: "HN" },
    paymentMethod: "cod",
    orderItems: [{
      name: p.name,
      quantity: 1,
      price: p.finalPrice,
      product: p._id
    }],
    totalPrice: p.finalPrice,
    subtotalPrice: p.finalPrice,
    discountAmount: 0,
    status: "delivered",
    isDelivered: true,
    deliveredAt: new Date(date.getTime() + 2 * 24 * 60 * 60 * 1000),
    createdAt: date,
  });
  await o.save();
}

async function createEvents(userId, eventName, count, daysAgo) {
  const now = new Date();
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  
  const docs = [];
  for(let i = 0; i < count; i++) {
    docs.push({
      eventName,
      userId,
      occurredAt: new Date(date.getTime() + i * 1000)
    });
  }
  if(docs.length > 0) {
    await AnalyticsEvent.insertMany(docs);
  }
}

async function createChatbotEvents(userId, count, daysAgo) {
  const now = new Date();
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  
  const docs = [];
  const sessionId = "sess_" + Math.random().toString(36).substring(7);
  for(let i = 0; i < count; i++) {
    docs.push({
      user: userId,
      sessionId: sessionId,
      eventType: "message",
      message: "Tu van dien thoai",
      createdAt: new Date(date.getTime() + i * 5000)
    });
  }
  if(docs.length > 0) {
    await ChatbotEvent.insertMany(docs);
  }
}

seed();
