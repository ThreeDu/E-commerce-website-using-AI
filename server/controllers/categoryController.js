const Category = require("../models/Category");

const seedCategories = async (req, res) => {
  const mockCategories = [
    { name: "Điện thoại", description: "Các dòng điện thoại thông minh mới nhất" },
    { name: "Laptop", description: "Máy tính xách tay phục vụ học tập, làm việc và chơi game" },
    { name: "Máy tính bảng", description: "Máy tính bảng iPad, Android đa nhiệm" },
    { name: "Phụ kiện", description: "Tai nghe, chuột, bàn phím, màn hình..." },
  ];

  try {
    await Category.deleteMany({});
    const createdCategories = await Category.insertMany(mockCategories);
    return res.status(201).json({ message: "Seed danh mục thành công!", count: createdCategories.length });
  } catch (error) {
    console.error("Lỗi khi seed danh mục:", error.message);
    return res.status(500).json({ message: "Lỗi khi seed danh mục", error: error.message });
  }
};

const listCategories = async (req, res) => {
  try {
    const categories = await Category.find({});
    return res.json(categories);
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi lấy danh mục" });
  }
};

module.exports = {
  seedCategories,
  listCategories,
};
