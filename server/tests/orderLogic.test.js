const test = require("node:test");
const assert = require("node:assert");
const { getUnitPrice, calculateDiscountAmount } = require("../services/orderService");
const { canTransition } = require("../services/orderStatusService");

test("getUnitPrice dùng giá từ DB, ưu tiên finalPrice hợp lệ", () => {
  assert.strictEqual(getUnitPrice({ price: 1000, finalPrice: 800 }), 800);
  assert.strictEqual(getUnitPrice({ price: 1000, finalPrice: 0, discountPercent: 25 }), 750);
  // finalPrice >= price bị bỏ qua, quay về discountPercent
  assert.strictEqual(getUnitPrice({ price: 1000, finalPrice: 1200, discountPercent: 0 }), 1000);
  assert.strictEqual(getUnitPrice({ price: 1000, discountPercent: 150 }), 0);
});

test("canTransition chặn quay vòng trạng thái (farm điểm)", () => {
  assert.ok(canTransition("pending", "confirmed"));
  assert.ok(canTransition("shipping", "delivered"));
  assert.ok(!canTransition("delivered", "confirmed"));
  assert.ok(!canTransition("cancelled", "delivered"));
  assert.ok(!canTransition("pending", "delivered"));
});

test("calculateDiscountAmount: phần trăm có trần, cố định không vượt tạm tính", () => {
  assert.strictEqual(calculateDiscountAmount({ type: "percent", value: 10 }, 1000000), 100000);
  assert.strictEqual(calculateDiscountAmount({ type: "percent", value: 50, maxDiscountValue: 200000 }, 1000000), 200000);
  assert.strictEqual(calculateDiscountAmount({ type: "fixed", value: 500000 }, 300000), 300000);
  assert.strictEqual(calculateDiscountAmount(null, 300000), 0);
});
