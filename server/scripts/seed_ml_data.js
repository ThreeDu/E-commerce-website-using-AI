require("dotenv").config({ path: __dirname + "/../../.env" });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const ChatbotEvent = require("../models/ChatbotEvent");
const Cart = require("../models/Cart");

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("MONGO_URI not configured in env");
  process.exit(1);
}

const NUM_PRODUCTS = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

// PRNG có seed để mỗi lần chạy sinh cùng một bộ dữ liệu (đổi bằng SEED=<số>)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(Number(process.env.SEED || 42));

/*
 * Mô phỏng ~240 ngày lịch sử cho mỗi khách theo persona: khách mua lặp lại theo quá trình
 * Poisson trong giai đoạn còn hoạt động; khách rời bỏ giảm dần hoạt động ~3 tuần trước khi
 * ngừng hẳn. Nhờ vậy mô hình rời bỏ / tiềm năng / CLV (nhãn theo thời gian) có tín hiệu thật.
 *   ordersPer30 / viewsPerDay / chatbotPer30: [min, max] cho mỗi khách
 *   lapseAgo: ngừng mua cách đây [min, max] ngày (không có = vẫn đang hoạt động)
 */
const PERSONAS = [
  { key: "champion", count: 20, signupAgo: [150, 240], ordersPer30: [3, 5], viewsPerDay: [1.5, 3], chatbotPer30: [1, 2], cancelRate: 0.03 },
  { key: "loyal", count: 35, signupAgo: [90, 220], ordersPer30: [1.2, 2.5], viewsPerDay: [0.6, 1.5], chatbotPer30: [0.5, 1], cancelRate: 0.05 },
  { key: "new_customer", count: 25, signupAgo: [10, 45], ordersPer30: [1, 3], viewsPerDay: [1, 2.5], chatbotPer30: [1, 3], cancelRate: 0.05 },
  { key: "at_risk", count: 30, signupAgo: [100, 220], lapseAgo: [10, 30], ordersPer30: [1, 2], viewsPerDay: [0.5, 1.2], chatbotPer30: [0.3, 1], cancelRate: 0.1 },
  { key: "churned", count: 45, signupAgo: [120, 240], lapseAgo: [40, 180], ordersPer30: [0.8, 2], viewsPerDay: [0.3, 1], chatbotPer30: [0, 0.5], cancelRate: 0.1 },
  { key: "browser", count: 20, signupAgo: [20, 120], ordersPer30: [0, 0], viewsPerDay: [0.5, 1.5], chatbotPer30: [0.5, 2], cancelRate: 0, abandonedCart: true },
  { key: "dormant", count: 25, signupAgo: [20, 200], ordersPer30: [0, 0], viewsPerDay: [0, 0], chatbotPer30: [0, 0], cancelRate: 0 },
];
const DECAY_DAYS = 21;        // số ngày hoạt động giảm dần trước khi rời bỏ
const RESIDUAL_VIEWS = 0.03;  // lượt xem lác đác/ngày sau khi rời bỏ
const CART_RATE = 0.25;       // xác suất một lượt xem dẫn tới thêm giỏ
const WISHLIST_RATE = 0.05;


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

    // Chỉ xoá user có email @mock.com (và dữ liệu của họ) để không đụng dữ liệu thật
    console.log("Xoá dữ liệu mock cũ...");
    const mockUsers = await User.find({ email: /@mock\.com$/ });
    const mockUserIds = mockUsers.map((u) => u._id);

    await Order.deleteMany({ user: { $in: mockUserIds } });
    await AnalyticsEvent.deleteMany({ userId: { $in: mockUserIds } });
    await ChatbotEvent.deleteMany({ user: { $in: mockUserIds } });
    await Cart.deleteMany({ user: { $in: mockUserIds } });
    await User.deleteMany({ _id: { $in: mockUserIds } });

    console.log("Xoá sản phẩm mock cũ...");
    await Product.deleteMany({
      $or: [
        { name: /Sản phẩm Mock/i },
        { name: /Mock Product/i }
      ]
    });

    console.log("Tạo sản phẩm mock với cấu hình chi tiết...");
    const products = [];
    const brands = ["samsung", "iphone", "xiaomi", "macbook", "ipad", "acer", "dell", "oppo"];
    for (let i = 1; i <= NUM_PRODUCTS; i++) {
      const brand = pickOne(brands);
      const price = randInt(5000000, 25000000);
      const specs = generateProductSpecs(brand, i);
      const p = new Product({
        name: specs.name,
        price,
        description: specs.description,
        category: specs.category,
        stock: 100,
        discountPercent: 10,
        finalPrice: Math.round(price * 0.9),
      });
      await p.save();
      products.push(p);
    }

    const passwordHash = await bcrypt.hash("123456", 10);
    const now = Date.now();
    const totals = { users: 0, orders: 0, events: 0, chatbot: 0 };

    console.log("Mô phỏng lịch sử mua sắm của user mock...");
    let userIndex = 1;
    for (const persona of PERSONAS) {
      for (let i = 0; i < persona.count; i++, userIndex++) {
        const plan = makePlan(persona, now);
        const buyer = plan.ordersPer30 > 0;

        const u = new User({
          name: `Mock User ${userIndex}`,
          email: `user${userIndex}@mock.com`,
          password: passwordHash,
          phone: buyer || random() < 0.5 ? `090${randInt(1000000, 9999999)}` : "",
          address: buyer ? "Hà Nội, Việt Nam" : "",
          createdAt: new Date(plan.signup),
        });

        const events = simulateEvents(u._id, products, plan, now);
        const orders = buyer ? simulateOrders(u._id, products, plan, events) : [];
        const chatbot = simulateChatbot(u._id, products, plan, now);

        const wishlisted = [...new Set(events.filter((e) => e.eventName === "wishlist_add").map((e) => String(e.productId)))];
        u.wishlist = wishlisted.slice(0, 8);
        await u.save();

        // productId chỉ dùng nội bộ để dựng wishlist; AnalyticsEvent không có field này
        if (events.length) await AnalyticsEvent.insertMany(events.map(({ productId, ...e }) => e));
        if (orders.length) await Order.insertMany(orders);
        if (chatbot.length) await ChatbotEvent.insertMany(chatbot);

        if (persona.abandonedCart) {
          const staleTime = new Date(now - randInt(25, 75) * 60 * 60 * 1000);
          await Cart.collection.insertOne({
            user: u._id,
            items: pickManyUnique(products, randInt(1, 3)).map((p) => ({ product: p._id, quantity: randInt(1, 2) })),
            createdAt: staleTime,
            updatedAt: staleTime,
          });
        }

        totals.users += 1;
        totals.orders += orders.length;
        totals.events += events.length;
        totals.chatbot += chatbot.length;
      }
    }

    console.log(`Hoàn thành bơm dữ liệu: ${JSON.stringify(totals)}`);
    process.exit(0);
  } catch (err) {
    console.error("Lỗi:", err);
    process.exit(1);
  }
}

function randInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return min + random() * (max - min);
}

function pickOne(items) {
  return items[Math.floor(random() * items.length)];
}

function pickManyUnique(items, count) {
  const shuffled = [...items].sort(() => 0.5 - random());
  return shuffled.slice(0, Math.min(count, items.length));
}

function poisson(lambda) {
  if (lambda <= 0) return 0;
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= random();
  } while (p > limit);
  return k - 1;
}

function makePlan(persona, now) {
  const signup = now - randFloat(...persona.signupAgo) * DAY_MS;
  const activeStart = signup + randFloat(0, 5) * DAY_MS;
  const lapseAt = persona.lapseAgo ? now - randFloat(...persona.lapseAgo) * DAY_MS : now;
  return {
    signup,
    activeStart,
    activeEnd: Math.min(now, Math.max(lapseAt, activeStart + 20 * DAY_MS)),
    lapsing: Boolean(persona.lapseAgo),
    ordersPer30: randFloat(...persona.ordersPer30),
    viewsPerDay: randFloat(...persona.viewsPerDay),
    chatbotPer30: randFloat(...persona.chatbotPer30),
    cancelRate: persona.cancelRate,
  };
}

// Cường độ hoạt động tại thời điểm t: 1 khi còn hoạt động, giảm dần trong DECAY_DAYS trước khi rời bỏ
function intensity(plan, t) {
  if (t < plan.activeStart || t >= plan.activeEnd) return 0;
  if (!plan.lapsing) return 1;
  const daysLeft = (plan.activeEnd - t) / DAY_MS;
  return daysLeft >= DECAY_DAYS ? 1 : 0.25 + 0.75 * (daysLeft / DECAY_DAYS);
}

function simulateEvents(userId, products, plan, now) {
  const events = [];
  for (let day = plan.activeStart; day < now; day += DAY_MS) {
    const rate = day < plan.activeEnd
      ? plan.viewsPerDay * intensity(plan, day)
      : (plan.viewsPerDay > 0 ? RESIDUAL_VIEWS : 0);
    for (let v = poisson(rate); v > 0; v--) {
      const at = new Date(day + random() * DAY_MS);
      if (at.getTime() >= now) continue;
      const productId = pickOne(products)._id;
      events.push({ eventName: "product_view", userId, occurredAt: at, productId });
      if (random() < CART_RATE) {
        events.push({ eventName: "add_to_cart", userId, occurredAt: new Date(at.getTime() + 60000), productId });
      }
      if (random() < WISHLIST_RATE) {
        events.push({ eventName: "wishlist_add", userId, occurredAt: new Date(at.getTime() + 30000), productId });
      }
    }
  }
  return events;
}

function simulateOrders(userId, products, plan, events) {
  const orders = [];
  const meanGapDays = 30 / plan.ordersPer30;
  let t = plan.activeStart + randFloat(0, meanGapDays) * DAY_MS;
  while (t < plan.activeEnd) {
    const p = pickOne(products);
    const quantity = randInt(1, 2);
    const price = Number(p.finalPrice || p.price || 0);
    const cancelled = random() < plan.cancelRate;
    orders.push({
      user: userId,
      shippingAddress: { fullName: "Mock User", phone: "0900000000", address: "Hà Nội" },
      paymentMethod: "cod",
      orderItems: [{ name: p.name, quantity, price, product: p._id }],
      totalPrice: price * quantity,
      subtotalPrice: price * quantity,
      discountAmount: 0,
      status: cancelled ? "cancelled" : "delivered",
      isDelivered: !cancelled,
      deliveredAt: cancelled ? undefined : new Date(t + 2 * DAY_MS),
      cancelledAt: cancelled ? new Date(t + DAY_MS) : undefined,
      createdAt: new Date(t),
    });
    // khách thêm giỏ ngay trước khi đặt
    events.push({ eventName: "add_to_cart", userId, occurredAt: new Date(t - 10 * 60000), productId: p._id });

    // khoảng cách tới đơn kế tiếp ~ phân phối mũ, giãn ra khi khách đang giảm hoạt động
    const gap = (-Math.log(1 - random()) * meanGapDays) / Math.max(intensity(plan, t), 0.25);
    t += Math.max(gap, 1) * DAY_MS;
  }
  return orders;
}

function simulateChatbot(userId, products, plan, now) {
  const docs = [];
  const activeDays = Math.max(0, (Math.min(plan.activeEnd, now) - plan.activeStart) / DAY_MS);
  const sessions = poisson((plan.chatbotPer30 * activeDays) / 30);
  for (let s = 0; s < sessions; s++) {
    const sessionId = "sess_" + Math.floor(random() * 1e12).toString(36);
    const start = new Date(plan.activeStart + random() * activeDays * DAY_MS);
    for (let i = 0; i < randInt(1, 3); i++) {
      const msgTime = new Date(start.getTime() + i * 60000);
      docs.push({ user: userId, sessionId, eventType: "message", message: "Tu van san pham", createdAt: msgTime });
      const shown = pickManyUnique(products, randInt(2, 4));
      shown.forEach((p, j) => {
        docs.push({ user: userId, sessionId, eventType: "impression", product: p._id, createdAt: new Date(msgTime.getTime() + 2000 + j * 500) });
      });
      if (random() > 0.5) {
        const clicked = pickOne(shown);
        const clickTime = new Date(msgTime.getTime() + 10000);
        docs.push({ user: userId, sessionId, eventType: "click", product: clicked._id, createdAt: clickTime });
        if (random() > 0.8) {
          docs.push({ user: userId, sessionId, eventType: "cart", product: clicked._id, createdAt: new Date(clickTime.getTime() + 5000) });
        }
      }
    }
  }
  return docs;
}

if (require.main === module) {
  seed();
}

module.exports = { PERSONAS, DAY_MS, makePlan, intensity, simulateEvents, simulateOrders, simulateChatbot };
