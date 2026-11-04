/**
 * Chuyển toàn bộ dữ liệu MongoDB sang Cloud Firestore (chạy một lần, chạy lại an toàn).
 *
 *   node server/scripts/migrate_mongo_to_firestore.js --dry-run
 *   node server/scripts/migrate_mongo_to_firestore.js [--events-since-days=60] [--only=users,orders]
 *
 * - Đọc từ MONGO_URI; ghi vào Firestore theo GOOGLE_APPLICATION_CREDENTIALS / FIREBASE_SERVICE_ACCOUNT
 *   (hoặc FIRESTORE_EMULATOR_HOST để thử trên emulator).
 * - Giữ nguyên _id (ObjectId -> chuỗi 24 hex) làm document ID; mọi ObjectId lồng bên trong cũng thành chuỗi.
 * - Ghi bằng set() theo ID nên chạy lại chỉ ghi đè, không tạo trùng.
 * - Gói Spark chỉ cho 20.000 lượt ghi/ngày: analyticsevents mặc định chỉ chuyển 60 ngày gần nhất
 *   (đủ cho cửa sổ đặc trưng 30/60 ngày của ml-service; ~16k lượt ghi với dữ liệu mẫu hiện tại).
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { getDb } = require("../db/firestore");

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v === undefined ? true : v];
}));
const DRY_RUN = Boolean(args["dry-run"]);
const EVENTS_SINCE_DAYS = Number(args["events-since-days"] || 60);
const ONLY = args.only ? String(args.only).split(",") : null;
const BATCH = 450;
const DAY = 24 * 60 * 60 * 1000;

// TTL như các model Firestore (server/models/Notification.js, ChatSession.js)
const TTL = { notifications: ["createdAt", 30 * DAY], chatsessions: ["updatedAt", 7 * DAY] };

function convert(value) {
  if (value == null) return value;
  if (value._bsontype === "ObjectId" || value._bsontype === "ObjectID") return value.toHexString();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(convert);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k !== "__v") out[k] = convert(v);
    }
    return out;
  }
  return value;
}

async function migrateCollection(mongoDb, name) {
  const filter = name === "analyticsevents"
    ? { occurredAt: { $gte: new Date(Date.now() - EVENTS_SINCE_DAYS * DAY) } }
    : {};
  const total = await mongoDb.collection(name).countDocuments(filter);
  if (DRY_RUN) return total;

  const target = getDb().collection(name);
  let written = 0;
  let batch = getDb().batch();
  let pending = 0;
  for await (const raw of mongoDb.collection(name).find(filter)) {
    const { _id, ...data } = convert(raw);
    if (TTL[name] && data[TTL[name][0]] instanceof Date) {
      data.expireAt = new Date(data[TTL[name][0]].getTime() + TTL[name][1]);
    }
    batch.set(target.doc(String(_id)), data);
    pending += 1;
    if (pending === BATCH) {
      await batch.commit();
      written += pending;
      process.stdout.write(`\r  ${name}: ${written}/${total}`);
      batch = getDb().batch();
      pending = 0;
    }
  }
  if (pending) await batch.commit();
  written += pending;
  process.stdout.write(`\r  ${name}: ${written}/${total}\n`);
  return written;
}

(async () => {
  if (!process.env.MONGO_URI) throw new Error("Thiếu MONGO_URI (nguồn dữ liệu Mongo).");
  await mongoose.connect(process.env.MONGO_URI);
  const mongoDb = mongoose.connection.db;
  const names = (await mongoDb.listCollections().toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith("system.") && (!ONLY || ONLY.includes(n)))
    .sort();

  const target = process.env.FIRESTORE_EMULATOR_HOST ? `emulator ${process.env.FIRESTORE_EMULATOR_HOST}` : "Firestore thật";
  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Mongo -> ${target}; analyticsevents ${EVENTS_SINCE_DAYS} ngày gần nhất`);

  let sum = 0;
  for (const name of names) {
    const n = await migrateCollection(mongoDb, name);
    if (DRY_RUN) console.log(`  ${name}: ${n}`);
    sum += n;
  }
  console.log(`${DRY_RUN ? "Sẽ ghi" : "Đã ghi"} ${sum} document.`);
  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error("Lỗi migrate:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
