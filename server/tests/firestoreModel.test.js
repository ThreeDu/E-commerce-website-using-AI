const test = require("node:test");
const assert = require("node:assert");
const { matches, applyUpdate, sortDocs } = require("../db/model");

test("matches: ngữ nghĩa bộ lọc Mongo dùng trong code", () => {
  const doc = {
    _id: "a1", status: "pending", stock: 5, tags: ["x", "y"], user: null,
    createdAt: new Date("2026-05-02"), orderItems: [{ product: "p1" }, { product: "p2" }], name: "Laptop Dell",
  };
  assert.ok(matches(doc, { status: "pending", stock: { $gte: 5 } }));
  assert.ok(!matches(doc, { stock: { $gt: 5 } }));
  assert.ok(matches(doc, { tags: "x" }), "mảng chứa giá trị");
  assert.ok(matches(doc, { "orderItems.product": { $in: ["p2", "p9"] } }), "path xuyên mảng con");
  assert.ok(matches(doc, { status: { $ne: "cancelled" } }));
  assert.ok(matches(doc, { user: null }) && matches(doc, { missing: null }), "null khớp field rỗng/thiếu");
  assert.ok(matches(doc, { missing: { $exists: false }, stock: { $exists: true } }));
  assert.ok(matches(doc, { $or: [{ stock: 0 }, { name: /dell/i }] }));
  assert.ok(matches(doc, { createdAt: { $gte: new Date("2026-05-01"), $lt: new Date("2026-06-01") } }));
  assert.ok(matches(doc, { tags: { $size: 2 } }) && !matches(doc, { tags: { $nin: ["y"] } }));
  assert.ok(matches({ usedCount: 2, usageLimit: 3 }, { $expr: { $lt: [{ $ifNull: ["$usedCount", 0] }, "$usageLimit"] } }));
  assert.ok(!matches({ usedCount: 3, usageLimit: 3 }, { $expr: { $lt: [{ $ifNull: ["$usedCount", 0] }, "$usageLimit"] } }));
});

test("applyUpdate: $inc / $set / $addToSet / $pull / object thường", () => {
  const doc = { stock: 5, wishlist: ["p1"], a: { b: 1 } };
  applyUpdate(doc, { $inc: { stock: -2 }, $set: { "a.b": 2 }, $addToSet: { wishlist: "p1" } });
  assert.deepStrictEqual(doc, { stock: 3, wishlist: ["p1"], a: { b: 2 } });
  applyUpdate(doc, { $addToSet: { wishlist: "p2" } });
  applyUpdate(doc, { $pull: { wishlist: "p1" } });
  assert.deepStrictEqual(doc.wishlist, ["p2"]);
  applyUpdate(doc, { status: "delivered" });
  assert.strictEqual(doc.status, "delivered");
});

test("sortDocs: nhiều khoá, ngày, chuỗi '-field'", () => {
  const docs = [{ n: 1, d: new Date(2) }, { n: 2, d: new Date(1) }, { n: 2, d: new Date(3) }];
  assert.deepStrictEqual(sortDocs([...docs], { n: -1, d: 1 }).map((x) => x.d.getTime()), [1, 3, 2]);
  assert.deepStrictEqual(sortDocs([...docs], "-d").map((x) => x.n), [2, 1, 2]);
});

// Các test dưới đây cần Firestore Emulator: npx firebase-tools emulators:start --only firestore
const emulator = process.env.FIRESTORE_EMULATOR_HOST;

test("emulator: CRUD, unique, cập nhật nguyên tử, populate", { skip: !emulator && "cần FIRESTORE_EMULATOR_HOST" }, async () => {
  const { defineModel } = require("../db/model");
  const suffix = Date.now().toString(36);
  const Owner = defineModel(`TestOwner_${suffix}`, { collection: `t_owner_${suffix}`, lower: ["email"], unique: [["email"]] });
  const Item = defineModel(`TestItem_${suffix}`, {
    collection: `t_item_${suffix}`,
    defaults: { stock: 0, tags: [] },
    arrays: ["tags"],
    hidden: ["secret"],
    refs: { owner: `TestOwner_${suffix}` },
  });

  const owner = await Owner.create({ email: "A@Mock.com", name: "A" });
  assert.strictEqual(owner.email, "a@mock.com");
  assert.match(owner._id, /^[0-9a-f]{24}$/);
  await assert.rejects(Owner.create({ email: "a@mock.com" }), (e) => e.code === 11000);

  const draft = new Owner({ email: "draft@mock.com" });
  assert.match(draft._id, /^[0-9a-f]{24}$/, "có _id ngay khi khởi tạo, trước save()");
  await draft.save();
  assert.strictEqual((await Owner.findById(draft._id)).email, "draft@mock.com");

  const item = await Item.create({ name: "Laptop", stock: 2, owner: owner._id, secret: "x" });
  assert.ok(item.createdAt instanceof Date);

  // trừ kho có điều kiện: lần 3 phải thất bại như findOneAndUpdate({stock: {$gte: 1}}) của Mongo
  const take = () => Item.findOneAndUpdate({ _id: item._id, stock: { $gte: 1 } }, { $inc: { stock: -1 } }, { new: true });
  const results = await Promise.all([take(), take(), take()]);
  assert.strictEqual(results.filter(Boolean).length, 2);
  assert.strictEqual((await Item.findById(item._id)).stock, 0);

  const found = await Item.findOne({ name: "Laptop" }).populate("owner", "email");
  assert.strictEqual(found.owner.email, "a@mock.com");
  assert.strictEqual(found.owner.name, undefined, "select chỉ lấy email");
  assert.strictEqual(found.secret, undefined, "field ẩn");
  assert.strictEqual((await Item.findById(item._id).select("+secret")).secret, "x");

  found.tags.push("new");
  found.name = "Laptop 2";
  await found.save();
  const reloaded = await Item.findById(item._id);
  assert.deepStrictEqual([reloaded.name, reloaded.tags, String(reloaded.owner)], ["Laptop 2", ["new"], owner._id]);

  assert.strictEqual(await Item.countDocuments({ name: "Laptop 2" }), 1);
  await Item.create([{ name: "B", rank: 2 }, { name: "C", rank: 3 }]);
  const page = await Item.find({}).sort({ rank: -1 }).skip(1).limit(1);
  assert.deepStrictEqual(page.map((d) => d.name), ["B"], "phân trang đẩy xuống Firestore");
  await Item.deleteMany({ rank: { $exists: true } });
  await Item.updateOne({ name: "Missing" }, { $set: { stock: 9, updatedAt: Date.now() } }, { upsert: true });
  const upserted = await Item.findOne({ name: "Missing" });
  assert.strictEqual(upserted.stock, 9);
  assert.ok(upserted.updatedAt instanceof Date, "updatedAt dạng số được ép thành Date");
  assert.strictEqual((await Item.deleteMany({})).deletedCount, 2);
  await Owner.deleteMany({});
});
