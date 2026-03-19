const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Product = require("../models/Product");
const Category = require("../models/Category");

const router = express.Router();

const createToken = (user) => {
  const secret = process.env.JWT_SECRET || "dev_secret_change_me";

  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
      email: user.email,
    },
    secret,
    { expiresIn: "7d" }
  );
};

const getTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.split(" ")[1];
};

const verifyAdminRequest = async (req, res) => {
  const token = getTokenFromHeader(req);
  if (!token) {
    res.status(401).json({ message: "Thiếu token xác thực." });
    return null;
  }

  try {
    const secret = process.env.JWT_SECRET || "dev_secret_change_me";
    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.userId).select("_id name email role");

    if (!user) {
      res.status(401).json({ message: "Tài khoản không tồn tại." });
      return null;
    }

    if (user.role !== "admin") {
      res.status(403).json({ message: "Bạn không có quyền admin." });
      return null;
    }

    return user;
  } catch (error) {
    res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn." });
    return null;
  }
};

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Họ tên, email và mật khẩu là bắt buộc." });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Mật khẩu phải có ít nhất 6 ký tự." });
    }

    const existedUser = await User.findOne({ email });
    if (existedUser) {
      return res.status(409).json({ message: "Email đã tồn tại." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "user",
    });

    return res.status(201).json({
      message: "Đăng ký thành công.",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email và mật khẩu là bắt buộc." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Thông tin đăng nhập không hợp lệ." });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Thông tin đăng nhập không hợp lệ." });
    }

    const token = createToken(user);

    return res.json({
      message: "Đăng nhập thành công.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/verify-admin", async (req, res) => {
  try {
    const adminUser = await verifyAdminRequest(req, res);
    if (!adminUser) {
      return;
    }

    return res.json({
      message: "Xác thực admin thành công.",
      user: adminUser,
    });
  } catch (error) {
    return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn." });
  }
});

router.get("/verify-token", async (req, res) => {
  try {
    const token = getTokenFromHeader(req);
    if (!token) {
      return res.status(401).json({ message: "Thiếu token xác thực." });
    }

    const secret = process.env.JWT_SECRET || "dev_secret_change_me";
    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.userId).select("_id name email role");
    if (!user) {
      return res.status(401).json({ message: "Tài khoản không tồn tại." });
    }

    return res.json({
      message: "Token hợp lệ.",
      user,
    });
  } catch (error) {
    return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn." });
  }
});

router.get("/admin/users", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const users = await User.find()
      .select("_id name email role createdAt")
      .sort({ createdAt: -1 });

    return res.json({
      message: "Lấy danh sách người dùng thành công.",
      users,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put("/admin/users/:id", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const { id } = req.params;
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
      return res
        .status(400)
        .json({ message: "Họ tên, email và vai trò là bắt buộc." });
    }

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ message: "Vai trò không hợp lệ." });
    }

    const existedEmail = await User.findOne({ email, _id: { $ne: id } });
    if (existedEmail) {
      return res.status(409).json({ message: "Email đã tồn tại." });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { name, email, role },
      { new: true, runValidators: true }
    ).select("_id name email role createdAt");

    if (!updatedUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    return res.json({
      message: "Cập nhật người dùng thành công.",
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete("/admin/users/:id", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const { id } = req.params;

    if (String(adminUser._id) === String(id)) {
      return res.status(400).json({ message: "Không thể tự xóa tài khoản admin hiện tại." });
    }

    const deletedUser = await User.findByIdAndDelete(id).select("_id name email role");

    if (!deletedUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    return res.json({
      message: "Xóa người dùng thành công.",
      user: deletedUser,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/admin/products", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const products = await Product.find().sort({ createdAt: -1 });

    return res.json({
      message: "Lấy danh sách sản phẩm thành công.",
      products,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/admin/products/:id", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }

    return res.json({
      message: "Lấy chi tiết sản phẩm thành công.",
      product,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/admin/products", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const { name, imageUrl, price, discountPercent, category, stock, description } = req.body;

    if (!name || !imageUrl || price === undefined || price === null) {
      return res.status(400).json({ message: "Tên, ảnh và giá sản phẩm là bắt buộc." });
    }

    const numericPrice = Number(price);
    const numericDiscount =
      discountPercent === undefined || discountPercent === null
        ? 0
        : Number(discountPercent);
    const numericStock = stock === undefined || stock === null ? 0 : Number(stock);

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ message: "Giá sản phẩm không hợp lệ." });
    }

    if (Number.isNaN(numericDiscount) || numericDiscount < 0 || numericDiscount > 100) {
      return res.status(400).json({ message: "% giảm giá không hợp lệ." });
    }

    if (Number.isNaN(numericStock) || numericStock < 0) {
      return res.status(400).json({ message: "Số lượng tồn không hợp lệ." });
    }

    const computedFinalPrice = Math.round(numericPrice * (1 - numericDiscount / 100));

    const newProduct = await Product.create({
      name,
      imageUrl,
      price: numericPrice,
      discountPercent: numericDiscount,
      finalPrice: computedFinalPrice,
      category: category || "Chưa phân loại",
      stock: numericStock,
      description: description || "",
    });

    return res.status(201).json({
      message: "Thêm sản phẩm thành công.",
      product: newProduct,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put("/admin/products/:id", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const { id } = req.params;
    const { name, imageUrl, price, discountPercent, stock, description } = req.body;

    if (!name || !imageUrl || price === undefined || price === null) {
      return res.status(400).json({ message: "Tên, ảnh và giá sản phẩm là bắt buộc." });
    }

    const numericPrice = Number(price);
    const numericDiscount =
      discountPercent === undefined || discountPercent === null
        ? 0
        : Number(discountPercent);
    const numericStock = stock === undefined || stock === null ? 0 : Number(stock);

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ message: "Giá sản phẩm không hợp lệ." });
    }

    if (Number.isNaN(numericDiscount) || numericDiscount < 0 || numericDiscount > 100) {
      return res.status(400).json({ message: "% giảm giá không hợp lệ." });
    }

    if (Number.isNaN(numericStock) || numericStock < 0) {
      return res.status(400).json({ message: "Số lượng tồn không hợp lệ." });
    }

    const computedFinalPrice = Math.round(numericPrice * (1 - numericDiscount / 100));

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name,
        imageUrl,
        price: numericPrice,
        discountPercent: numericDiscount,
        finalPrice: computedFinalPrice,
        stock: numericStock,
        description: description || "",
      },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }

    return res.json({
      message: "Cập nhật sản phẩm thành công.",
      product: updatedProduct,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete("/admin/products/:id", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const { id } = req.params;
    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }

    return res.json({
      message: "Xóa sản phẩm thành công.",
      product: deletedProduct,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/admin/categories", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const categories = await Category.find().sort({ createdAt: -1 });

    return res.json({
      message: "Lấy danh sách danh mục thành công.",
      categories,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/admin/categories", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const { name, parentId } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Tên danh mục là bắt buộc." });
    }

    let normalizedParentId = null;
    if (parentId) {
      const parentCategory = await Category.findById(parentId);
      if (!parentCategory) {
        return res.status(404).json({ message: "Không tìm thấy danh mục chính." });
      }

      if (parentCategory.parentId) {
        return res.status(400).json({ message: "Chỉ hỗ trợ tối đa 2 cấp danh mục." });
      }

      normalizedParentId = parentCategory._id;
    }

    const existedCategory = await Category.findOne({
      name: String(name).trim(),
      parentId: normalizedParentId,
    });
    if (existedCategory) {
      return res.status(409).json({ message: "Danh mục đã tồn tại ở cấp này." });
    }

    const category = await Category.create({
      name: String(name).trim(),
      parentId: normalizedParentId,
    });

    return res.status(201).json({
      message: "Thêm danh mục thành công.",
      category,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put("/admin/categories/:id", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const { id } = req.params;
    const { name, parentId } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Tên danh mục là bắt buộc." });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Không tìm thấy danh mục." });
    }

    let normalizedParentId = null;
    if (parentId) {
      const parentCategory = await Category.findById(parentId);
      if (!parentCategory) {
        return res.status(404).json({ message: "Không tìm thấy danh mục chính." });
      }

      if (String(parentCategory._id) === String(id)) {
        return res.status(400).json({ message: "Danh mục không thể là cha của chính nó." });
      }

      if (parentCategory.parentId) {
        return res.status(400).json({ message: "Chỉ hỗ trợ tối đa 2 cấp danh mục." });
      }

      normalizedParentId = parentCategory._id;
    }

    const existedCategory = await Category.findOne({
      _id: { $ne: id },
      name: String(name).trim(),
      parentId: normalizedParentId,
    });
    if (existedCategory) {
      return res.status(409).json({ message: "Danh mục đã tồn tại ở cấp này." });
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      {
        name: String(name).trim(),
        parentId: normalizedParentId,
      },
      { new: true, runValidators: true }
    );

    return res.json({
      message: "Cập nhật danh mục thành công.",
      category: updatedCategory,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete("/admin/categories/:id", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({ message: "Không tìm thấy danh mục." });
    }

    const hasChildren = await Category.exists({ parentId: category._id });
    if (hasChildren) {
      return res.status(400).json({
        message: "Danh mục chính đang có danh mục phụ. Vui lòng xóa danh mục phụ trước.",
      });
    }

    await Category.findByIdAndDelete(id);

    return res.json({
      message: "Xóa danh mục thành công.",
      category,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
