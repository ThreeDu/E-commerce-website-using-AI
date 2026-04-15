const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Product = require("../models/Product");
const {
  createToken,
  getTokenFromHeader,
  verifyAdminRequest,
  verifyUserRequest,
} = require("../routes/helpers/authHelpers");

const WISHLIST_PRODUCT_SELECT = "_id name image price category";

const mapWishlistItems = (wishlistProducts) => {
  return (Array.isArray(wishlistProducts) ? wishlistProducts : []).map((product) => ({
    _id: product._id,
    name: product.name,
    image: product.image,
    price: product.price,
    category: product.category,
  }));
};

const register = async (req, res) => {
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
        phone: newUser.phone,
        address: newUser.address,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const login = async (req, res) => {
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
        phone: user.phone,
        address: user.address,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const verifyAdmin = async (req, res) => {
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
};

const verifyToken = async (req, res) => {
  try {
    const token = getTokenFromHeader(req);
    if (!token) {
      return res.status(401).json({ message: "Thiếu token xác thực." });
    }

    const secret = process.env.JWT_SECRET || "dev_secret_change_me";
    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.userId).select("_id name email role phone address");
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
};

const getProfile = async (req, res) => {
  const user = await verifyUserRequest(req, res);
  if (!user) {
    return;
  }

  return res.json({
    message: "Lấy hồ sơ thành công.",
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || "",
      address: user.address || "",
    },
  });
};

const updateProfile = async (req, res) => {
  const user = await verifyUserRequest(req, res);
  if (!user) {
    return;
  }

  try {
    const { name, phone, address } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Họ tên là bắt buộc." });
    }

    user.name = String(name).trim();
    user.phone = String(phone || "").trim();
    user.address = String(address || "").trim();
    await user.save();

    return res.json({
      message: "Cập nhật hồ sơ thành công.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const changePassword = async (req, res) => {
  const authUser = await verifyUserRequest(req, res);
  if (!authUser) {
    return;
  }

  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Mật khẩu hiện tại và mật khẩu mới là bắt buộc." });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "Mật khẩu mới phải có ít nhất 6 ký tự." });
    }

    const user = await User.findById(authUser._id).select("password");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản." });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ message: "Mật khẩu hiện tại không đúng." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return res.json({ message: "Đổi mật khẩu thành công." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getWishlist = async (req, res) => {
  const authUser = await verifyUserRequest(req, res);
  if (!authUser) {
    return;
  }

  try {
    const user = await User.findById(authUser._id)
      .select("wishlist")
      .populate("wishlist", WISHLIST_PRODUCT_SELECT);

    return res.json({
      message: "Lấy danh sách yêu thích thành công.",
      wishlist: mapWishlistItems(user?.wishlist),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const addWishlist = async (req, res) => {
  const authUser = await verifyUserRequest(req, res);
  if (!authUser) {
    return;
  }

  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ message: "Thiếu productId." });
    }

    const product = await Product.findById(productId).select("_id");
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại." });
    }

    await User.findByIdAndUpdate(authUser._id, {
      $addToSet: { wishlist: product._id },
    });

    const updatedUser = await User.findById(authUser._id)
      .select("wishlist")
      .populate("wishlist", WISHLIST_PRODUCT_SELECT);

    return res.json({
      message: "Đã thêm vào yêu thích.",
      wishlist: mapWishlistItems(updatedUser?.wishlist),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const removeWishlist = async (req, res) => {
  const authUser = await verifyUserRequest(req, res);
  if (!authUser) {
    return;
  }

  try {
    const { productId } = req.params;
    await User.findByIdAndUpdate(authUser._id, {
      $pull: { wishlist: productId },
    });

    const updatedUser = await User.findById(authUser._id)
      .select("wishlist")
      .populate("wishlist", WISHLIST_PRODUCT_SELECT);

    return res.json({
      message: "Đã xóa khỏi yêu thích.",
      wishlist: mapWishlistItems(updatedUser?.wishlist),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  register,
  login,
  verifyAdmin,
  verifyToken,
  getProfile,
  updateProfile,
  changePassword,
  getWishlist,
  addWishlist,
  removeWishlist,
};
