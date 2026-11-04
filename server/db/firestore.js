/**
 * Kết nối Cloud Firestore (firebase-admin) dùng chung cho server.
 *
 * Thông tin xác thực, theo thứ tự ưu tiên:
 *   - FIREBASE_SERVICE_ACCOUNT: nội dung JSON của key (dùng trên Vercel)
 *   - GOOGLE_APPLICATION_CREDENTIALS: đường dẫn file key (dùng local)
 *   - FIRESTORE_EMULATOR_HOST: chạy với Firestore Emulator, không cần key
 */
const crypto = require("crypto");
const path = require("path");
const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

function credentialOptions() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return { credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) };
  }
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath && !process.env.FIRESTORE_EMULATOR_HOST) {
    return { credential: cert(require(path.resolve(__dirname, "..", "..", keyPath))) };
  }
  // Emulator chỉ cần projectId
  return { projectId: process.env.FIREBASE_PROJECT_ID || "e-commerce-website-using-ai" };
}

let firestore = null;

function getDb() {
  if (!firestore) {
    const app = getApps()[0] || initializeApp(credentialOptions());
    firestore = getFirestore(app);
    firestore.settings({ ignoreUndefinedProperties: true });
  }
  return firestore;
}

// ID 24 ký tự hex như ObjectId cũ: giữ tương thích JWT, URL, mã chuyển khoản VietQR / webhook BeePay
const ID_PATTERN = /^[0-9a-f]{24}$/i;

function newId() {
  return crypto.randomBytes(12).toString("hex");
}

function isId(value) {
  return ID_PATTERN.test(String(value || ""));
}

/** Timestamp của Firestore -> Date (đệ quy) để code tính ngày giữ nguyên như khi dùng Mongo. */
function toPlain(value) {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = toPlain(v);
    return out;
  }
  return value;
}

module.exports = { getDb, newId, isId, toPlain };
