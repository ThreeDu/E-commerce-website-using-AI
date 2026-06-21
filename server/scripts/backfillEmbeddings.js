const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Product = require("../models/Product");
const { generateEmbedding } = require("../chatbot-service/llmHelper");
const compareService = require("../chatbot-service/compare");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Compile a rich textual representation of a product for semantic embedding
function compileProductTextForEmbedding(product) {
  const name = product.name || "";
  const brand = product.brand || "";
  const category = product.category || "";
  const description = product.description || "";
  const price = product.price || 0;

  // Extract specifications
  let specText = "";
  try {
    const specs = compareService.extractComparisonSpecSummary(product);
    if (specs) {
      if (specs.isLaptop) {
        specText = `CPU: ${specs.cpu || ""} | GPU: ${specs.gpu || ""} | RAM: ${specs.ram || ""} | Storage: ${specs.storage || ""} | Screen: ${specs.screen || ""} | Battery: ${specs.battery || ""} | OS: ${specs.os || ""}`;
      } else {
        specText = `Chipset/CPU: ${specs.chipset || ""} | RAM: ${specs.ram || ""} | Storage: ${specs.storage || ""} | Screen: ${specs.screen || ""} | Front Camera: ${specs.cameraFront || ""} | Rear Camera: ${specs.cameraRear || ""} | Battery: ${specs.battery || ""}`;
      }
    }
  } catch (err) {
    // Fallback if spec extraction fails
    specText = "";
  }

  return [
    `Name: ${name}`,
    `Category: ${category}`,
    `Brand: ${brand}`,
    `Price: ${price} VND`,
    specText ? `Specifications: ${specText}` : "",
    `Description: ${description}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function run() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/e-commerce-app";
  console.log("Connecting to MongoDB:", uri);
  await mongoose.connect(uri);

  const products = await Product.find({
    $or: [{ embedding: { $exists: false } }, { embedding: null }],
  });

  console.log(`Found ${products.length} products needing embedding generation.`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const text = compileProductTextForEmbedding(product);
    
    console.log(`[${i + 1}/${products.length}] Generating embedding for: "${product.name}"...`);
    
    // Call Gemini/OpenAI embedding generation API
    const vector = await generateEmbedding(text);
    
    if (vector && Array.isArray(vector) && vector.length > 0) {
      product.embedding = vector;
      await product.save();
      successCount++;
      console.log(`Successfully saved embedding (${vector.length} dimensions) for "${product.name}"`);
    } else {
      errorCount++;
      console.error(`Failed to generate embedding for "${product.name}"`);
    }

    // Free tier rate limit throttle: 4 seconds sleep between API requests
    if (i < products.length - 1) {
      console.log("Sleeping 4 seconds to respect API rate limits...");
      await sleep(4000);
    }
  }

  console.log("\n========================================");
  console.log("Embedding backfill complete.");
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
  
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Backfill Script Error:", err);
  mongoose.disconnect();
});
