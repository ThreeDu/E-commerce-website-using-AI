const mongoose = require("mongoose");
require("dotenv").config();

const Product = require("../models/Product");

function normalizeSku(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
}

async function run() {
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/e-commerce-app";
  await mongoose.connect(mongoUri);

  let scanned = 0;
  let updated = 0;
  let duplicatesResolved = 0;

  const cursor = Product.find({}).cursor();
  for await (const product of cursor) {
    scanned += 1;

    const before = {
      brand: String(product.brand || "").trim(),
      series: String(product.series || "").trim(),
      model: String(product.model || "").trim(),
      variant: String(product.variant || "").trim(),
      slug: String(product.slug || "").trim(),
      sku: String(product.sku || "").trim(),
    };

    // Trigger model pre-validate hooks to infer structured fields if missing.
    if (!before.brand) product.brand = "";
    if (!before.series) product.series = "";
    if (!before.model) product.model = "";
    if (!before.variant) product.variant = "";
    if (!before.slug) product.slug = "";
    if (!before.sku) product.sku = "";

    try {
      await product.save();
    } catch (error) {
      if (error?.code === 11000) {
        const suffix = String(product._id).slice(-6).toUpperCase();
        const baseSku = normalizeSku(product.sku || product.name || "PRODUCT");
        product.sku = `${baseSku}-${suffix}`;
        await product.save();
        duplicatesResolved += 1;
      } else {
        throw error;
      }
    }

    const after = {
      brand: String(product.brand || "").trim(),
      series: String(product.series || "").trim(),
      model: String(product.model || "").trim(),
      variant: String(product.variant || "").trim(),
      slug: String(product.slug || "").trim(),
      sku: String(product.sku || "").trim(),
    };

    if (
      before.brand !== after.brand ||
      before.series !== after.series ||
      before.model !== after.model ||
      before.variant !== after.variant ||
      before.slug !== after.slug ||
      before.sku !== after.sku
    ) {
      updated += 1;
    }
  }

  await mongoose.disconnect();

  console.log(
    JSON.stringify(
      {
        scanned,
        updated,
        duplicatesResolved,
      },
      null,
      2
    )
  );
}

run().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    // Ignore disconnect errors in failure path.
  }
  process.exit(1);
});
