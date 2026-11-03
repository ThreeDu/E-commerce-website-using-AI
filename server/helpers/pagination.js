/**
 * Đọc page/limit từ query string, kẹp trong khoảng hợp lệ.
 * @returns {{ page: number, limit: number, skip: number }}
 */
function parsePagination({ page, limit } = {}, { defaultLimit = 20, minLimit = 1, maxLimit = 100 } = {}) {
  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedLimit = Math.min(maxLimit, Math.max(minLimit, Number(limit) || defaultLimit));
  return { page: parsedPage, limit: parsedLimit, skip: (parsedPage - 1) * parsedLimit };
}

module.exports = { parsePagination };
