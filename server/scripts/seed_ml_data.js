require("dotenv").config({ path: __dirname + "/../../.env" });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const ChatbotEvent = require("../chatbot-service/models/ChatbotEvent");
const Cart = require("../models/Cart");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/e-commerce-app";

const NUM_USERS = 200; // Increase size to seed more cases
const NUM_PRODUCTS = 50;
const RECENT_WINDOW_DAYS = 30;
const PREV_WINDOW_START_DAYS = 60;


function generateProductSpecs(brand, index) {
  const brandLower = brand.toLowerCase();
  
  if (brandLower === "iphone") {
    const models = ["15 Pro Max", "15 Pro", "14 Pro Max", "13 Pro"];
    const model = models[index % models.length];
    const storages = ["128GB", "256GB", "512GB"];
    const storage = storages[index % storages.length];
    const name = `Sản phẩm Mock iPhone ${model} ${storage}`;
    const desc = `Điện thoại thông minh Apple iPhone cao cấp chính hãng. 
Thông số kỹ thuật chi tiết:
- Bộ vi xử lý (Chip): Apple A17 Pro (3nm) siêu tiết kiệm điện và hiệu năng đồ họa đỉnh cao.
- Màn hình: 6.7 inch Super Retina XDR OLED, tần số quét 120Hz ProMotion, độ sáng 2000 nits.
- Camera sau: Cụm 3 camera 48MP (chính) + 12MP (góc siêu rộng) + 12MP (telephoto zoom quang 5x), hỗ trợ quay video ProRes 4K.
- Camera trước: 12MP TrueDepth hỗ trợ nhận diện khuôn mặt Face ID.
- Bộ nhớ RAM: 8GB LPDDR5.
- Dung lượng pin: 4441 mAh, hỗ trợ sạc nhanh PD 25W và sạc không dây MagSafe 15W.
- Hệ điều hành: iOS 17.`;
    return { name, category: "dien thoai", description: desc };
  }
  
  if (brandLower === "samsung") {
    const models = ["Galaxy S24 Ultra", "Galaxy S23 Ultra", "Galaxy A54", "Galaxy Z Fold5"];
    const model = models[index % models.length];
    const storages = ["256GB", "512GB"];
    const storage = storages[index % storages.length];
    const name = `Sản phẩm Mock Samsung ${model} ${storage}`;
    const desc = `Điện thoại di động Samsung chính hãng tích hợp trí tuệ nhân tạo Galaxy AI.
Thông số kỹ thuật chi tiết:
- Bộ vi xử lý (Chip): Snapdragon 8 Gen 3 for Galaxy (4nm) xử lý AI siêu nhanh.
- Màn hình: 6.8 inch Dynamic AMOLED 2X, tần số quét 120Hz thích ứng, độ phân giải QHD+.
- Camera sau: 4 camera gồm 200MP (chính) + 50MP + 12MP + 10MP, zoom quang học 5x và 10x, zoom kỹ thuật số 100x.
- Camera trước: 12MP Dual Pixel tự động lấy nét.
- Bộ nhớ RAM: 12GB.
- Dung lượng pin: 5000 mAh, sạc nhanh 45W, sạc ngược không dây.
- Hệ điều hành: Android 14 với giao diện One UI 6.1.`;
    return { name, category: "dien thoai", description: desc };
  }
  
  if (brandLower === "xiaomi") {
    const models = ["14 Pro", "Redmi Note 13 Pro", "Poco F6", "Xiaomi 13T"];
    const model = models[index % models.length];
    const storages = ["256GB", "512GB"];
    const storage = storages[index % storages.length];
    const name = `Sản phẩm Mock Xiaomi ${model} ${storage}`;
    const desc = `Điện thoại di động Xiaomi cấu hình mạnh mẽ, camera Leica đẳng cấp.
Thông số kỹ thuật chi tiết:
- Bộ vi xử lý (Chip): Snapdragon 8 Gen 3 xử lý đa nhiệm mượt mà.
- Màn hình: 6.73 inch LTPO AMOLED, tần số quét 120Hz, độ phân giải 2K+.
- Camera sau: Cụm 3 camera Leica 50MP (chính) + 50MP (tele) + 50MP (siêu rộng).
- Camera trước: 32MP chụp selfie sắc nét.
- Bộ nhớ RAM: 12GB LPDDR5X.
- Dung lượng pin: 4880 mAh, hỗ trợ sạc siêu nhanh HyperCharge 120W (sạc đầy trong 18 phút).
- Hệ điều hành: Xiaomi HyperOS trên nền Android 14.`;
    return { name, category: "dien thoai", description: desc };
  }

  if (brandLower === "oppo") {
    const models = ["Find X7 Ultra", "Reno11 Pro", "A78", "Find N3 Flip"];
    const model = models[index % models.length];
    const storages = ["256GB", "512GB"];
    const storage = storages[index % storages.length];
    const name = `Sản phẩm Mock Oppo ${model} ${storage}`;
    const desc = `Điện thoại di động Oppo chính hãng chụp ảnh chân dung siêu đẹp.
Thông số kỹ thuật chi tiết:
- Bộ vi xử lý (Chip): MediaTek Dimensity 9300 hiệu năng vượt trội và mát mẻ.
- Màn hình: 6.82 inch AMOLED, 120Hz, độ sáng tối đa 4500 nits siêu sáng dưới trời nắng.
- Camera sau: Hệ thống 4 camera Hasselblad 50MP + 50MP + 50MP + 50MP zoom kính tiềm vọng kép.
- Camera trước: 32MP cảm biến Sony IMX709.
- Bộ nhớ RAM: 16GB.
- Dung lượng pin: 5000 mAh, sạc nhanh SuperVOOC 100W.
- Hệ điều hành: ColorOS 14 (Android 14).`;
    return { name, category: "dien thoai", description: desc };
  }

  if (brandLower === "macbook") {
    const models = ["MacBook Pro 14 M3", "MacBook Air 13 M2", "MacBook Pro 16 M3 Max"];
    const model = models[index % models.length];
    const storages = ["512GB SSD", "1TB SSD"];
    const storage = storages[index % storages.length];
    const name = `Sản phẩm Mock Apple ${model} ${storage}`;
    const desc = `Máy tính xách tay Apple MacBook chính hãng cấu hình mạnh mẽ cho công việc đồ họa.
Thông số kỹ thuật chi tiết:
- Bộ vi xử lý (Chip): Apple M3 (8-core CPU, 10-core GPU) xử lý đồ họa mượt mà.
- Màn hình: 14.2 inch Liquid Retina XDR, độ phân giải 3024 x 1964, công nghệ ProMotion 120Hz.
- Camera: 1080p FaceTime HD camera.
- Bộ nhớ RAM: 16GB Unified Memory.
- Lưu trữ: SSD dung lượng cao ${storage}.
- Dung lượng pin: Pin Lithium-polymer thời lượng sử dụng lên đến 22 giờ liên tục.
- Hệ điều hành: macOS Sonoma.`;
    return { name, category: "laptop", description: desc };
  }

  if (brandLower === "ipad") {
    const models = ["iPad Pro 11 M2", "iPad Air 5", "iPad Gen 10"];
    const model = models[index % models.length];
    const storages = ["128GB", "256GB"];
    const storage = storages[index % storages.length];
    const name = `Sản phẩm Mock Apple ${model} ${storage}`;
    const desc = `Máy tính bảng Apple iPad chính hãng hỗ trợ Apple Pencil đắc lực cho vẽ và ghi chép.
Thông số kỹ thuật chi tiết:
- Bộ vi xử lý (Chip): Apple M2 8-core CPU mang lại sức mạnh vượt bậc.
- Màn hình: 11 inch Liquid Retina, công nghệ True Tone, ProMotion 120Hz mượt mà.
- Camera sau: 12MP Wide + 10MP Ultra Wide và cảm biến quét chiều sâu LiDAR.
- Camera trước: 12MP Ultra Wide với tính năng Center Stage tự động căn giữa cuộc gọi.
- Bộ nhớ RAM: 8GB RAM.
- Lưu trữ: Bộ nhớ trong dung lượng cao ${storage}.
- Dung lượng pin: 28.65 watt-hour sử dụng liên tục 10 giờ qua Wi-Fi.
- Hệ điều hành: iPadOS 17.`;
    return { name, category: "tablet", description: desc };
  }

  if (brandLower === "acer") {
    const models = ["Nitro 5 Gaming", "Aspire 7", "Swift Go 14"];
    const model = models[index % models.length];
    const storages = ["512GB SSD", "1TB SSD"];
    const storage = storages[index % storages.length];
    const name = `Sản phẩm Mock Acer ${model} ${storage}`;
    const desc = `Máy tính xách tay Acer hiệu năng cao dành cho game thủ và lập trình viên.
Thông số kỹ thuật chi tiết:
- Bộ vi xử lý (Chip): Intel Core i5-12500H (12 nhân, 16 luồng) tốc độ lên tới 4.5GHz.
- Card đồ họa (GPU): NVIDIA GeForce RTX 3050 4GB chiến tốt mọi tựa game.
- Màn hình: 15.6 inch IPS FHD, tần số quét 144Hz chống xé hình khi chơi game.
- Camera: HD Webcam tích hợp.
- Bộ nhớ RAM: 16GB DDR4 3200MHz.
- Lưu trữ: SSD 512GB PCIe NVMe.
- Dung lượng pin: 57.5 Whr, đi kèm tản nhiệt hai quạt CoolBoost độc quyền.
- Hệ điều hành: Windows 11 Home bản quyền.`;
    return { name, category: "laptop", description: desc };
  }

  if (brandLower === "dell") {
    const models = ["XPS 13 9315", "Inspiron 15 3520", "Vostro 3430"];
    const model = models[index % models.length];
    const storages = ["512GB SSD", "1TB SSD"];
    const storage = storages[index % storages.length];
    const name = `Sản phẩm Mock Dell ${model} ${storage}`;
    const desc = `Máy tính xách tay Dell chính hãng, bền bỉ và ổn định cao cho doanh nghiệp và văn phòng.
Thông số kỹ thuật chi tiết:
- Bộ vi xử lý (Chip): Intel Core i7-1250U hiệu suất cao, tiết kiệm điện năng.
- Card đồ họa: Intel Iris Xe Graphics.
- Màn hình: 13.4 inch FHD+ IPS, độ sáng 500 nits, chống chói Anti-Reflective.
- Camera: IR Webcam 720p hỗ trợ nhận diện khuôn mặt Windows Hello.
- Bộ nhớ RAM: 16GB LPDDR5 5200MHz kênh đôi siêu tốc.
- Lưu trữ: SSD PCIe NVMe siêu tốc ${storage}.
- Dung lượng pin: 51 Whr sử dụng bền bỉ cả ngày.
- Hệ điều hành: Windows 11 Home kèm bản quyền Office Home & Student.`;
    return { name, category: "laptop", description: desc };
  }

  return {
    name: `Sản phẩm Mock ${brand} Pro ${index}`,
    category: "dien thoai",
    description: `Sản phẩm Mock ${brand} cấu hình cao. Thông số kỹ thuật chi tiết: Chipset 8 nhân mạnh mẽ, Màn hình Full HD+ sắc nét, Camera độ phân giải cao 50MP, RAM 8GB, Bộ nhớ trong 128GB, Pin 5000 mAh.`,
  };
}

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

    // Xóa sản phẩm mock cũ
    console.log("Xoá sản phẩm mock cũ...");
    await Product.deleteMany({
      $or: [
        { name: /Sản phẩm Mock/i },
        { name: /Mock Product/i }
      ]
    });

    // Create Products
    console.log("Tạo sản phẩm mock với cấu hình chi tiết...");
    const products = [];
    const brands = ["samsung", "iphone", "xiaomi", "macbook", "ipad", "acer", "dell", "oppo"];
    for (let i = 1; i <= NUM_PRODUCTS; i++) {
      const brand = brands[Math.floor(Math.random() * brands.length)];
      const price = Math.floor(Math.random() * 20000000) + 5000000;
      const specs = generateProductSpecs(brand, i);
      
      let p = new Product({
        name: specs.name,
        price: price,
        description: specs.description,
        category: specs.category,
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
        key: "medium_risk",
        count: 35,
        profile: { completeness: 0.8, wishlistSize: 2, accountAgeDaysRange: [60, 120] },
        orders: { completed: 2, cancelled: 0, completedDaysAgoRange: [22, 40] },
        events: { recent: { product_view: 8, add_to_cart: 2, wishlist_add: 1 }, prev: { product_view: 15, add_to_cart: 4 } },
        chatbot: { sessions: 1, messagesPerSession: 1, daysAgoRange: [10, 20] },
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

  const products = await Product.find({}).select("_id").limit(100).lean();

  for (let s = 0; s < sessions; s++) {
    const sessionId = "sess_" + Math.random().toString(36).substring(7);
    const baseDate = randomDateDaysAgo(daysRange[0], daysRange[1]);
    for (let i = 0; i < messagesPerSession; i++) {
      const msgTime = new Date(baseDate.getTime() + i * 60000);
      docs.push({
        user: userId,
        sessionId,
        eventType: "message",
        message: "Tu van san pham",
        createdAt: msgTime,
      });

      if (products.length > 0) {
        const numImpressions = Math.floor(Math.random() * 3) + 2; 
        const selectedProducts = [];
        for (let j = 0; j < numImpressions; j++) {
          const randomProduct = products[Math.floor(Math.random() * products.length)];
          selectedProducts.push(randomProduct._id);
          docs.push({
            user: userId,
            sessionId,
            eventType: "impression",
            product: randomProduct._id,
            createdAt: new Date(msgTime.getTime() + 2000 + j * 500),
          });
        }

        if (Math.random() > 0.5) {
          const clickProdId = selectedProducts[Math.floor(Math.random() * selectedProducts.length)];
          const clickTime = new Date(msgTime.getTime() + 10000 + Math.floor(Math.random() * 5000));
          docs.push({
            user: userId,
            sessionId,
            eventType: "click",
            product: clickProdId,
            createdAt: clickTime,
          });

          if (Math.random() > 0.8) {
            docs.push({
              user: userId,
              sessionId,
              eventType: "cart",
              product: clickProdId,
              createdAt: new Date(clickTime.getTime() + 5000 + Math.floor(Math.random() * 5000)),
            });
          }
        }
      }
    }
  }

  if (docs.length > 0) {
    await ChatbotEvent.insertMany(docs);
  }
}

seed();
