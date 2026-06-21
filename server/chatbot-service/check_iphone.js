const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

async function run() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/e-commerce-app";
  await mongoose.connect(uri);
  
  const Product = require("../models/Product");
  const products = await Product.find({ name: { $regex: /iPhone\s*17/i } });
  
  console.log("Found products:", products.length);
  for (const p of products) {
    console.log("----------------------------------------");
    console.log("Name:", p.name);
    console.log("Description:", p.description);
  }
  
  await mongoose.disconnect();
}

run().catch(console.error);
