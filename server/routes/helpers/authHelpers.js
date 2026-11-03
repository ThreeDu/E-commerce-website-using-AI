const jwt = require("jsonwebtoken");
const User = require("../../models/User");

const createToken = (user) => {
  const secret = process.env.JWT_SECRET;

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

const verifyUserRequest = async (req, res) => {
  const token = getTokenFromHeader(req);
  if (!token) {
    res.status(401).json({ message: "Thiếu token xác thực." });
    return null;
  }

  try {
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.userId).select("_id name email role phone address");

    if (!user) {
      res.status(401).json({ message: "Tài khoản không tồn tại." });
      return null;
    }

    return user;
  } catch (error) {
    res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn." });
    return null;
  }
};

const verifyAdminRequest = async (req, res) => {
  const token = getTokenFromHeader(req);
  if (!token) {
    res.status(401).json({ message: "Thiếu token xác thực." });
    return null;
  }

  try {
    const secret = process.env.JWT_SECRET;
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

// userId từ token nếu có và hợp lệ, ngược lại null (cho các route không bắt buộc đăng nhập).
const getOptionalUserId = (req) => {
  const token = getTokenFromHeader(req);
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded?.userId || null;
  } catch (error) {
    return null;
  }
};

const requireUser = async (req, res, next) => {
  const user = await verifyUserRequest(req, res);
  if (!user) {
    return;
  }

  req.user = user;
  next();
};

const requireAdmin = async (req, res, next) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  req.adminUser = adminUser;
  next();
};

module.exports = {
  createToken,
  getTokenFromHeader,
  getOptionalUserId,
  verifyUserRequest,
  verifyAdminRequest,
  requireUser,
  requireAdmin,
};
