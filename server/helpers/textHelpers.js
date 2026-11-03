// Chuẩn hóa text tiếng Việt (bỏ dấu, lowercase) dùng cho slug/brand/model sản phẩm.
function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return normalizeText(value).replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

module.exports = { normalizeText, slugify };
