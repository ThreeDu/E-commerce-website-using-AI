const AuditLog = require("../../models/AuditLog");
const { parsePagination } = require("../../helpers/pagination");
const { escapeRegex } = require("../../chatbot-service/textUtils");

const listSystemLogs = async (req, res) => {
  try {
    const {
      page = "1",
      limit = "20",
      action = "all",
      resource = "all",
      q = "",
      adminEmail = "",
    } = req.query;

    const { page: parsedPage, limit: parsedLimit } = parsePagination({ page, limit }, { minLimit: 5 });

    const filter = {};

    if (action !== "all") {
      filter.action = String(action);
    }

    if (resource !== "all") {
      filter.resource = String(resource);
    }

    if (adminEmail && String(adminEmail).trim()) {
      filter.adminEmail = new RegExp(escapeRegex(String(adminEmail).trim()), "i");
    }

    if (q && String(q).trim()) {
      const keyword = new RegExp(escapeRegex(String(q).trim()), "i");
      filter.$or = [{ adminEmail: keyword }, { resourceId: keyword }, { path: keyword }];
    }

    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit)
      .lean();

    return res.json({
      message: "Lấy danh sách log hệ thống thành công.",
      logs,
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / parsedLimit)),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listSystemLogs,
};
