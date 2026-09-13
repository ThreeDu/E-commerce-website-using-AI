const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { executeTool } = require("../chatbot-service/chatbotToolExecutor");

async function testQuery(query) {
  console.log("\n========================================");
  console.log(`Query: "${query}"`);
  
  try {
    const result = await executeTool("searchProducts", { keyword: query });
    
    if (result.error) {
      console.error("Tool execution error:", result.error);
      return;
    }

    const products = result.products || [];
    console.log(`Returned ${products.length} recommendations:`);
    products.forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.name} | Price: ${p.price} | Brand: ${p.brand} | Category: ${p.category}`);
    });
  } catch (err) {
    console.error(`Error querying "${query}":`, err.message);
  }
}

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI not configured in env");
    process.exit(1);
  }
  console.log("Connecting to MongoDB...");
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
