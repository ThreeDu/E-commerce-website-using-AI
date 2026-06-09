require("dotenv").config({ path: __dirname + "/../../.env" });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const ChatbotEvent = require("../models/ChatbotEvent");
const Cart = require("../models/Cart");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/e-commerce-app";

const NUM_USERS = 160; // Increase size to seed more cases
const NUM_PRODUCTS = 50;
const RECENT_WINDOW_DAYS = 30;
const PREV_WINDOW_START_DAYS = 60;


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
    await Cart.deleteMany({ user: { $in: mockUserIds } });
    await User.deleteMany({ _id: { $in: mockUserIds } });

    
    // Create Products
    console.log("Tạo sản phẩm mock...");
    const products = [];
    const brands = ["samsung", "iphone", "xiaomi", "macbook", "ipad", "acer", "dell", "oppo"];
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

    const scenarios = [
      {
        key: "champion",
        count: 15,
        profile: { completeness: 1, wishlistSize: 5, accountAgeDaysRange: [150, 300] },
        orders: { completed: 6, cancelled: 0, completedDaysAgoRange: [1, 12] },
        events: { recent: { product_view: 35, add_to_cart: 15, wishlist_add: 5 }, prev: { product_view: 20 } },
        chatbot: { sessions: 1, messagesPerSession: 2, daysAgoRange: [1, 10] },
      },
      {
        key: "loyal",
        count: 25,
        profile: { completeness: 1, wishlistSize: 3, accountAgeDaysRange: [100, 250] },
        orders: { completed: 4, cancelled: 0, completedDaysAgoRange: [5, 28] },
        events: { recent: { product_view: 22, add_to_cart: 8, wishlist_add: 3 }, prev: { product_view: 12 } },
        chatbot: { sessions: 1, messagesPerSession: 2, daysAgoRange: [5, 25] },
      },
      {
        key: "potential_loyalist",
        count: 25,
        profile: { completeness: 1, wishlistSize: 5, accountAgeDaysRange: [15, 45] },
        orders: { completed: 2, cancelled: 0, completedDaysAgoRange: [2, 20] },
        events: { recent: { product_view: 45, add_to_cart: 14, wishlist_add: 6 }, prev: { product_view: 5 } },
        chatbot: { sessions: 3, messagesPerSession: 4, daysAgoRange: [1, 15] },
      },
      {
        key: "at_risk",
        count: 25,
        profile: { completeness: 1, wishlistSize: 1, accountAgeDaysRange: [90, 180] },
        orders: { completed: 3, cancelled: 1, completedDaysAgoRange: [35, 60], cancelledDaysAgoRange: [32, 50] },
        events: { recent: { product_view: 1, add_to_cart: 0, wishlist_add: 0 }, prev: { product_view: 18, add_to_cart: 6 } },
        chatbot: { sessions: 0, messagesPerSession: 0, daysAgoRange: [10, 20] },
      },
      {
        key: "hibernating",
        count: 25,
        profile: { completeness: 0.66, wishlistSize: 0, accountAgeDaysRange: [100, 200] },
        orders: { completed: 1, cancelled: 0, completedDaysAgoRange: [50, 85] },
        events: { recent: { product_view: 0, add_to_cart: 0, wishlist_add: 0 }, prev: { product_view: 8, add_to_cart: 1 } },
        chatbot: { sessions: 0, messagesPerSession: 0, daysAgoRange: [20, 30] },
      },
      {
        key: "lost",
        count: 25,
        profile: { completeness: 0.33, wishlistSize: 0, accountAgeDaysRange: [150, 300] },
        orders: { completed: 1, cancelled: 0, completedDaysAgoRange: [100, 180] },
        events: { recent: { product_view: 0, add_to_cart: 0, wishlist_add: 0 }, prev: { product_view: 0, add_to_cart: 0 } },
        chatbot: { sessions: 0, messagesPerSession: 0, daysAgoRange: [30, 60] },
      },
      {
        key: "cart_abandoners",
        count: 20,
        profile: { completeness: 0.66, wishlistSize: 2, accountAgeDaysRange: [30, 90] },
        orders: { completed: 0, cancelled: 0 },
        events: { recent: { product_view: 28, add_to_cart: 11, wishlist_add: 2 }, prev: { product_view: 6 } },
        chatbot: { sessions: 1, messagesPerSession: 2, daysAgoRange: [2, 10] },
      },
    ];

    let userIndex = 1;
    for (const scenario of scenarios) {
      for (let i = 0; i < scenario.count; i++) {
        const accountAgeDays = randInt(
          scenario.profile.accountAgeDaysRange?.[0] || 30,
          scenario.profile.accountAgeDaysRange?.[1] || 120
        );
        const u = new User({
          name: `Mock User ${userIndex}`,
          email: `user${userIndex}@mock.com`,
          password: passwordHash,
          phone: scenario.profile.completeness >= 0.66 ? `090${randInt(1000000, 9999999)}` : "",
          address: scenario.profile.completeness >= 1 ? "Hà Nội, Việt Nam" : "",
          createdAt: new Date(now.getTime() - accountAgeDays * 24 * 60 * 60 * 1000),
        });

        const wishlistSize = scenario.profile.wishlistSize || 0;
        if (wishlistSize > 0) {
          u.wishlist = pickManyUnique(products, wishlistSize).map((p) => p._id);
        }

        await u.save();
        const uid = u._id;

        // If cart_abandoners, create an abandoned Cart document (updated 24-72 hours ago)
        if (scenario.key === "cart_abandoners") {
          const cartProducts = pickManyUnique(products, randInt(1, 3));
          const items = cartProducts.map(p => ({
            product: p._id,
            quantity: randInt(1, 2)
          }));
          const staleTime = new Date(now.getTime() - randInt(25, 75) * 60 * 60 * 1000); // 25-75 hours ago
          
          await Cart.collection.insertOne({
            user: uid,
            items,
            createdAt: staleTime,
            updatedAt: staleTime
          });
        }

        if (scenario.orders?.completed || scenario.orders?.cancelled) {
          await createOrders(uid, products, {
            completed: scenario.orders.completed || 0,
            cancelled: scenario.orders.cancelled || 0,
            completedDaysAgoRange: scenario.orders.completedDaysAgoRange || [5, 45],
            cancelledDaysAgoRange: scenario.orders.cancelledDaysAgoRange || [5, 45],
          });
        }

        await createAnalyticsEvents(uid, scenario.events || {});
        await createChatbotEvents(uid, scenario.chatbot || {});

        userIndex += 1;
      }
    }

    if (userIndex - 1 < NUM_USERS) {
      for (; userIndex <= NUM_USERS; userIndex++) {
        const u = new User({
          name: `Mock User ${userIndex}`,
          email: `user${userIndex}@mock.com`,
          password: passwordHash,
          phone: "",
          address: "",
          createdAt: new Date(now.getTime() - randInt(20, 80) * 24 * 60 * 60 * 1000),
        });
        await u.save();
      }
    }

    
    console.log("Hoàn thành bơm dữ liệu!");
    process.exit(0);
  } catch (err) {
    console.error("Lỗi:", err);
    process.exit(1);
  }
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function pickManyUnique(items, count) {
  const shuffled = [...items].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, items.length));
}

function randomDateDaysAgo(minDays, maxDays) {
  const daysAgo = randInt(minDays, maxDays);
  const now = Date.now();
  const offset = daysAgo * 24 * 60 * 60 * 1000;
  const jitter = randInt(0, 6 * 60 * 60 * 1000);
  return new Date(now - offset + jitter);
}

async function createOrders(userId, products, config) {
  const completed = Number(config.completed || 0);
  const cancelled = Number(config.cancelled || 0);
  const completedRange = config.completedDaysAgoRange || [5, 45];
  const cancelledRange = config.cancelledDaysAgoRange || [5, 45];

  const orders = [];

  for (let i = 0; i < completed; i++) {
    const p = pickOne(products);
    const quantity = randInt(1, 3);
    const price = Number(p.finalPrice || p.price || 0);
    const createdAt = randomDateDaysAgo(completedRange[0], completedRange[1]);
    orders.push({
      user: userId,
      shippingAddress: { fullName: "Mock User", phone: "090", address: "HN" },
      paymentMethod: "cod",
      orderItems: [{
        name: p.name,
        quantity,
        price,
        product: p._id,
      }],
      totalPrice: price * quantity,
      subtotalPrice: price * quantity,
      discountAmount: 0,
      status: "delivered",
      isDelivered: true,
      deliveredAt: new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000),
      createdAt,
    });
  }

  for (let i = 0; i < cancelled; i++) {
    const p = pickOne(products);
    const quantity = randInt(1, 2);
    const price = Number(p.finalPrice || p.price || 0);
    const createdAt = randomDateDaysAgo(cancelledRange[0], cancelledRange[1]);
    orders.push({
      user: userId,
      shippingAddress: { fullName: "Mock User", phone: "090", address: "HN" },
      paymentMethod: "cod",
      orderItems: [{
        name: p.name,
        quantity,
        price,
        product: p._id,
      }],
      totalPrice: price * quantity,
      subtotalPrice: price * quantity,
      discountAmount: 0,
      status: "cancelled",
      isDelivered: false,
      createdAt,
    });
  }

  if (orders.length > 0) {
    await Order.insertMany(orders);
  }
}

async function createAnalyticsEvents(userId, config) {
  const recent = config.recent || {};
  const prev = config.prev || {};
  const docs = [];

  for (const [eventName, count] of Object.entries(recent)) {
    for (let i = 0; i < Number(count || 0); i++) {
      docs.push({
        eventName,
        userId,
        occurredAt: randomDateDaysAgo(1, RECENT_WINDOW_DAYS),
      });
    }
  }

  for (const [eventName, count] of Object.entries(prev)) {
    for (let i = 0; i < Number(count || 0); i++) {
      docs.push({
        eventName,
        userId,
        occurredAt: randomDateDaysAgo(RECENT_WINDOW_DAYS + 1, PREV_WINDOW_START_DAYS),
      });
    }
  }

  if (docs.length > 0) {
    await AnalyticsEvent.insertMany(docs);
  }
}

async function createChatbotEvents(userId, config) {
  const sessions = Number(config.sessions || 0);
  const messagesPerSession = Number(config.messagesPerSession || 0);
  const daysRange = config.daysAgoRange || [2, 20];
  const docs = [];

  for (let s = 0; s < sessions; s++) {
    const sessionId = "sess_" + Math.random().toString(36).substring(7);
    const baseDate = randomDateDaysAgo(daysRange[0], daysRange[1]);
    for (let i = 0; i < messagesPerSession; i++) {
      docs.push({
        user: userId,
        sessionId,
        eventType: "message",
        message: "Tu van san pham",
        createdAt: new Date(baseDate.getTime() + i * 30000),
      });
    }
  }

  if (docs.length > 0) {
    await ChatbotEvent.insertMany(docs);
  }
}

seed();
