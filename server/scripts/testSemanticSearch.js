const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const recommender = require("../chatbot-service/recommender");

async function testQuery(query) {
  console.log("\n========================================");
  console.log(`Query: "${query}"`);
  
  try {
    const results = await recommender.findRecommendedProducts(query, {}, {
      sessionId: "test-semantic-search-session"
    });
    
    console.log(`Returned ${results.length} recommendations:`);
    results.forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.name} | Price: ${p.price} | Similarity: ${(p.similarityScore || 0).toFixed(4)} | LTR Score: ${(p.ltrScore || 0).toFixed(4)}`);
      if (p.reason) {
        console.log(`   Reason: ${p.reason}`);
      }
    });
  } catch (err) {
    console.error(`Error querying "${query}":`, err.message);
  }
}

async function run() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/e-commerce-app";
  console.log("Connecting to MongoDB:", uri);
  await mongoose.connect(uri);
  
  const testCases = [
    "tôi cần mua máy tính xách tay mỏng nhẹ để làm văn phòng",
    "điện thoại nào có camera chụp ảnh xuất sắc để đi du lịch",
    "cần điện thoại cấu hình mạnh nhất để chiến game mượt",
  ];
  
  for (const tc of testCases) {
    await testQuery(tc);
  }
  
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Test Script Error:", err);
  mongoose.disconnect();
});
