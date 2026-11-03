/**
 * Schema các tool admin chatbot ({ name, description, parameters }) cho llmHelper.
 */
// ─── Tool definitions for LLM function calling ────────────────────────────────
// Gemini format: functionDeclarations with uppercase types
// OpenAI format: tools with type: 'function' wrapper

const toolSchemas = [
  {
    name: 'getDashboardStats',
    description: 'Lấy thống kê tổng quan dashboard: tổng đơn hàng, doanh thu, người dùng mới, sản phẩm mới theo khoảng thời gian.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week', 'month'],
          description: 'Khoảng thời gian thống kê: today (hôm nay), week (7 ngày), month (30 ngày).',
        },
      },
    },
  },
  {
    name: 'searchOrders',
    description: 'Tìm kiếm đơn hàng theo ID, trạng thái, hoặc khoảng thời gian.',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'ID đơn hàng cụ thể cần tra cứu (tùy chọn).',
        },
        status: {
          type: 'string',
          enum: ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'],
          description: 'Lọc theo trạng thái đơn hàng (tùy chọn).',
        },
        dateFrom: {
          type: 'string',
          description: 'Ngày bắt đầu lọc, ISO format (tùy chọn).',
        },
        dateTo: {
          type: 'string',
          description: 'Ngày kết thúc lọc, ISO format (tùy chọn).',
        },
        limit: {
          type: 'number',
          description: 'Số lượng kết quả tối đa, mặc định 10.',
        },
      },
    },
  },
  {
    name: 'updateOrderStatus',
    description: 'Cập nhật trạng thái đơn hàng. Yêu cầu xác nhận từ admin trước khi thực hiện.',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'ID đơn hàng cần cập nhật.',
        },
        newStatus: {
          type: 'string',
          enum: ['confirmed', 'shipping', 'delivered', 'cancelled'],
          description: 'Trạng thái mới cho đơn hàng.',
        },
        reason: {
          type: 'string',
          description: 'Lý do cập nhật (bắt buộc khi hủy đơn).',
        },
      },
      required: ['orderId', 'newStatus'],
    },
  },
  {
    name: 'searchProducts',
    description: 'Tìm kiếm sản phẩm theo tên, thương hiệu, hoặc lọc sản phẩm sắp hết hàng.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Từ khóa tìm kiếm theo tên sản phẩm (tùy chọn).',
        },
        brand: {
          type: 'string',
          description: 'Lọc theo thương hiệu (tùy chọn).',
        },
        lowStock: {
          type: 'boolean',
          description: 'Nếu true, chỉ lấy sản phẩm có tồn kho <= 5.',
        },
        limit: {
          type: 'number',
          description: 'Số lượng kết quả tối đa, mặc định 10.',
        },
      },
    },
  },
  {
    name: 'updateProduct',
    description: 'Cập nhật thông tin sản phẩm (giá, tồn kho, giảm giá). Yêu cầu xác nhận từ admin trước khi thực hiện.',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'ID sản phẩm cần cập nhật.',
        },
        price: {
          type: 'number',
          description: 'Giá mới (tùy chọn).',
        },
        stock: {
          type: 'number',
          description: 'Số lượng tồn kho mới (tùy chọn).',
        },
        discountPercent: {
          type: 'number',
          description: 'Phần trăm giảm giá mới, 0-100 (tùy chọn).',
        },
      },
      required: ['productId'],
    },
  },
  {
    name: 'searchUsers',
    description: 'Tìm kiếm khách hàng theo tên hoặc email, bao gồm thống kê đơn hàng của họ.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Từ khóa tìm kiếm theo tên hoặc email.',
        },
        limit: {
          type: 'number',
          description: 'Số lượng kết quả tối đa, mặc định 10.',
        },
      },
    },
  },
  {
    name: 'getRecentLogs',
    description: 'Lấy lịch sử hoạt động quản trị (audit logs) gần đây.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Số lượng kết quả tối đa, mặc định 20.',
        },
        actionType: {
          type: 'string',
          description: 'Lọc theo loại hành động (ví dụ: UPDATE_ORDER_STATUS, UPDATE_PRODUCT).',
        },
      },
    },
  },
  {
    name: 'createProduct',
    description: 'Tạo sản phẩm mới trong hệ thống. Yêu cầu xác nhận từ admin trước khi thực hiện.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Tên sản phẩm (bắt buộc).',
        },
        price: {
          type: 'number',
          description: 'Giá sản phẩm tính bằng VND (bắt buộc).',
        },
        description: {
          type: 'string',
          description: 'Mô tả chi tiết sản phẩm (bắt buộc).',
        },
        category: {
          type: 'string',
          description: 'Danh mục sản phẩm, ví dụ: "Điện thoại", "Laptop", "Tablet" (bắt buộc).',
        },
        stock: {
          type: 'number',
          description: 'Số lượng tồn kho ban đầu, mặc định 0.',
        },
        image: {
          type: 'string',
          description: 'URL ảnh sản phẩm (tùy chọn).',
        },
        discountPercent: {
          type: 'number',
          description: 'Phần trăm giảm giá 0-100 (tùy chọn).',
        },
      },
      required: ['name', 'price', 'description', 'category'],
    },
  },
  {
    name: 'createDiscount',
    description: 'Tạo mã giảm giá mới. Yêu cầu xác nhận từ admin trước khi thực hiện.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Mã giảm giá (sẽ tự động chuyển thành chữ in hoa, bắt buộc).',
        },
        type: {
          type: 'string',
          enum: ['percent', 'fixed'],
          description: 'Loại giảm giá: percent (phần trăm) hoặc fixed (số tiền cố định). Mặc định percent.',
        },
        value: {
          type: 'number',
          description: 'Giá trị giảm giá (bắt buộc). Nếu type=percent thì là phần trăm (1-100), nếu type=fixed thì là số tiền VND.',
        },
        minOrderValue: {
          type: 'number',
          description: 'Giá trị đơn hàng tối thiểu để áp dụng mã (tùy chọn, mặc định 0).',
        },
        maxDiscountValue: {
          type: 'number',
          description: 'Giá trị giảm tối đa (tùy chọn, dùng cho type=percent).',
        },
        startDate: {
          type: 'string',
          description: 'Ngày bắt đầu hiệu lực, ISO format (tùy chọn).',
        },
        endDate: {
          type: 'string',
          description: 'Ngày kết thúc hiệu lực, ISO format (tùy chọn).',
        },
        usageLimit: {
          type: 'number',
          description: 'Giới hạn số lần sử dụng tổng cộng (tùy chọn, 0 = không giới hạn).',
        },
        usageLimitPerUser: {
          type: 'number',
          description: 'Giới hạn số lần mỗi user được sử dụng (tùy chọn, 0 = không giới hạn).',
        },
      },
      required: ['code', 'value'],
    },
  },
  {
    name: 'exportReport',
    description: 'Xuất báo cáo thống kê dưới dạng file Excel để tải về.',
    parameters: {
      type: 'object',
      properties: {
        reportType: {
          type: 'string',
          enum: ['orders', 'products', 'revenue'],
          description: 'Loại báo cáo cần xuất: orders (đơn hàng), products (sản phẩm), revenue (doanh thu).',
        },
      },
      required: ['reportType'],
    },
  },
  {
    name: 'batchUpdateProducts',
    description: 'Cập nhật hàng loạt nhiều sản phẩm theo danh mục hoặc thương hiệu. Yêu cầu admin xác nhận.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Tên danh mục sản phẩm.' },
        brand: { type: 'string', description: 'Tên thương hiệu.' },
        discountPercent: { type: 'number', description: 'Phần trăm giảm giá mới (0-100).' },
        priceMultiplier: { type: 'number', description: 'Hệ số điều chỉnh giá (ví dụ 1.05 để tăng 5%).' },
      },
    },
  },
  {
    name: 'batchUpdateOrders',
    description: 'Cập nhật hàng loạt trạng thái đơn hàng. Yêu cầu admin xác nhận.',
    parameters: {
      type: 'object',
      properties: {
        fromStatus: { type: 'string', description: 'Trạng thái cũ của đơn hàng.' },
        toStatus: { type: 'string', description: 'Trạng thái mới cần chuyển sang.' },
      },
      required: ['fromStatus', 'toStatus'],
    },
  }
];

module.exports = { TOOL_SCHEMAS: toolSchemas };
