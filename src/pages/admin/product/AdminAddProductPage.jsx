import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useStatusMessageBridge } from "../../../hooks/useStatusMessageBridge";
import { createAdminProduct } from "../../../services/admin/productService";
import { getAdminCategories } from "../../../services/admin/categoryService";
import { getErrorMessage } from "../../../utils/adminErrorUtils";
const MAX_IMAGE_SIZE_MB = 5;

function AdminAddProductPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categories, setCategories] = useState([]);
  const [imageInputMode, setImageInputMode] = useState("url");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    imageUrl: "",
    price: "",
    stock: "",
    discountPercent: "0",
    description: "",
  });

  useStatusMessageBridge(message, { title: "Sản phẩm" });

  useEffect(() => {
    const loadCategories = async () => {
      if (!auth?.token) {
        return;
      }

      try {
        setLoadingCategories(true);
        const data = await getAdminCategories(auth.token);
        setCategories(data.categories || []);
      } catch (error) {
        setMessage(getErrorMessage(error, "Không thể tải danh mục."));
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, [auth?.token]);

  const finalPricePreview = useMemo(() => {
    const price = Number(formData.price || 0);
    const discountPercent = Number(formData.discountPercent || 0);
    if (Number.isNaN(price) || Number.isNaN(discountPercent)) {
      return 0;
    }

    return Math.max(0, Math.round(price * (1 - discountPercent / 100)));
  }, [formData.price, formData.discountPercent]);

  const imagePreviewSrc = formData.imageUrl?.trim();

  const categoriesById = useMemo(() => {
    const map = new Map();
    categories.forEach((item) => {
      map.set(String(item._id), item);
    });
    return map;
  }, [categories]);

  const getCategoryPath = useCallback((category) => {
    const path = [category.name];
    let cursor = category;
    const visited = new Set();

    while (cursor?.parentId) {
      const parentId = String(cursor.parentId);
      if (visited.has(parentId)) {
        break;
      }

      visited.add(parentId);
      const parent = categoriesById.get(parentId);
      if (!parent) {
        break;
      }

      path.unshift(parent.name);
      cursor = parent;
    }

    return path.join(" > ");
  }, [categoriesById]);

  const categoryOptions = useMemo(() => {
    const sorted = [...categories];
    sorted.sort((a, b) => getCategoryPath(a).localeCompare(getCategoryPath(b), "vi"));
    return sorted;
  }, [categories, getCategoryPath]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageModeChange = (event) => {
    const mode = event.target.value;
    setImageInputMode(mode);
    setUploadedFileName("");
    setFieldErrors((prev) => ({ ...prev, imageUrl: "" }));
    setFormData((prev) => ({ ...prev, imageUrl: "" }));
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setFieldErrors((prev) => ({ ...prev, imageUrl: "Chỉ chấp nhận tệp hình ảnh." }));
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setFieldErrors((prev) => ({
        ...prev,
        imageUrl: `Ảnh không được lớn hơn ${MAX_IMAGE_SIZE_MB}MB.`,
      }));
      return;
    }

    setFieldErrors((prev) => ({ ...prev, imageUrl: "" }));

    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, imageUrl: String(reader.result || "") }));
      setUploadedFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const validateForm = () => {
    const errors = {};
    const trimmedName = formData.name.trim();
    const trimmedCategory = formData.category.trim();
    const trimmedImageUrl = formData.imageUrl.trim();
    const price = Number(formData.price);
    const stock = Number(formData.stock);
    const discountPercent = Number(formData.discountPercent || 0);

    if (!trimmedName) {
      errors.name = "Tên sản phẩm không được để trống.";
    }

    if (!trimmedCategory) {
      errors.category = "Vui lòng chọn danh mục.";
    }

    if (!trimmedImageUrl) {
      errors.imageUrl = "Vui lòng nhập hoặc tải ảnh sản phẩm.";
    }

    if (imageInputMode === "url" && trimmedImageUrl) {
      try {
        const parsedUrl = new URL(trimmedImageUrl);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          errors.imageUrl = "URL ảnh phải bắt đầu bằng http:// hoặc https://.";
        }
      } catch (error) {
        errors.imageUrl = "URL ảnh không hợp lệ.";
      }
    }

    if (Number.isNaN(price) || price <= 0) {
      errors.price = "Giá sản phẩm phải lớn hơn 0.";
    }

    if (Number.isNaN(stock) || stock < 0) {
      errors.stock = "Số lượng tồn kho không hợp lệ.";
    }

    if (Number.isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      errors.discountPercent = "Phần trăm giảm giá phải trong khoảng 0 - 100.";
    }

    return {
      errors,
      payload: {
        name: trimmedName,
        category: trimmedCategory,
        image: trimmedImageUrl,
        price,
        stock: Number(formData.stock || 0),
        discountPercent,
        description: formData.description,
      },
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setFieldErrors({});

    const { errors, payload } = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setMessage("Vui lòng kiểm tra lại các trường dữ liệu.");
      return;
    }

    setLoading(true);

    try {
      await createAdminProduct(auth.token, payload);

      navigate("/admin/products", {
        state: { successMessage: "Thêm sản phẩm thành công." },
      });
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể thêm sản phẩm."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
      <section className="relative border border-shop-line rounded-lg p-6 shadow-admin bg-gradient-to-br from-white to-[#f8fbff] animate-admin-rise">
        <h2 className="text-[1.55rem] font-bold tracking-wide text-[#13263a] m-0">Thêm sản phẩm</h2>
        <p className="mt-2 mb-0 max-w-[760px] text-[#5a6d84] text-sm leading-relaxed">Tạo sản phẩm mới với danh mục, giá và ảnh minh họa trước khi đưa lên gian hàng.</p>
        {message && <p className="mt-3 rounded-xl p-[10px_12px] border border-[#ffd8a8] bg-[#fff8ef] text-[#9a3412] text-sm">{message}</p>}

        <form className="mt-4 max-w-[700px] grid gap-2.5" onSubmit={handleSubmit}>
          <label htmlFor="name" className="text-[#1f3348] text-[13px] font-bold tracking-wide block mt-2.5 mb-1">Tên sản phẩm</label>
          <input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
          />
          {fieldErrors.name && <p className="mt-1 text-[#b42318] text-xs font-semibold">{fieldErrors.name}</p>}

          <label htmlFor="category" className="text-[#1f3348] text-[13px] font-bold tracking-wide block mt-2.5 mb-1">Danh mục</label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            disabled={loadingCategories}
            required
            className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
          >
            <option value="">{loadingCategories ? "Đang tải danh mục..." : "Chọn danh mục"}</option>
            {categoryOptions.map((item) => (
              <option key={item._id} value={getCategoryPath(item)}>
                {getCategoryPath(item)}
              </option>
            ))}
          </select>
          {fieldErrors.category && <p className="mt-1 text-[#b42318] text-xs font-semibold">{fieldErrors.category}</p>}

          <label className="text-[#1f3348] text-[13px] font-bold tracking-wide block mt-2.5 mb-1">Ảnh sản phẩm</label>
          <div className="flex gap-4.5 items-center my-1">
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-[#1f3348] text-[13px] font-semibold">
              <input
                type="radio"
                name="imageInputMode"
                value="url"
                checked={imageInputMode === "url"}
                onChange={handleImageModeChange}
                className="w-4 h-4 text-admin-primary border-admin-line focus:ring-admin-primary"
              />
              Dùng URL
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-[#1f3348] text-[13px] font-semibold">
              <input
                type="radio"
                name="imageInputMode"
                value="upload"
                checked={imageInputMode === "upload"}
                onChange={handleImageModeChange}
                className="w-4 h-4 text-admin-primary border-admin-line focus:ring-admin-primary"
              />
              Tải lên
            </label>
          </div>

          {imageInputMode === "url" ? (
            <input
              id="imageUrl"
              name="imageUrl"
              placeholder="https://..."
              value={formData.imageUrl}
              onChange={handleChange}
              required
              className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
            />
          ) : (
            <div className="flex flex-col gap-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                required
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-admin-soft-blue file:text-admin-primary hover:file:bg-teal-100 file:cursor-pointer cursor-pointer"
              />
              {uploadedFileName && <small className="text-xs text-admin-muted block mt-1">Đã chọn: {uploadedFileName}</small>}
            </div>
          )}
          {fieldErrors.imageUrl && <p className="mt-1 text-[#b42318] text-xs font-semibold">{fieldErrors.imageUrl}</p>}

          {imagePreviewSrc ? (
            <div className="mt-1">
              <img src={imagePreviewSrc} alt="Xem trước ảnh sản phẩm" className="w-[180px] h-[180px] object-cover rounded-xl border border-[#d6dfeb]" />
            </div>
          ) : null}

          <label htmlFor="description" className="text-[#1f3348] text-[13px] font-bold tracking-wide block mt-2.5 mb-1">Mô tả sản phẩm</label>
          <textarea
            id="description"
            name="description"
            rows="4"
            value={formData.description}
            onChange={handleChange}
            className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] resize-y"
          />

          <label htmlFor="price" className="text-[#1f3348] text-[13px] font-bold tracking-wide block mt-2.5 mb-1">Giá</label>
          <input
            id="price"
            name="price"
            type="number"
            min="0"
            value={formData.price}
            onChange={handleChange}
            required
            className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
          />
          {fieldErrors.price && <p className="mt-1 text-[#b42318] text-xs font-semibold">{fieldErrors.price}</p>}

          <label htmlFor="stock" className="text-[#1f3348] text-[13px] font-bold tracking-wide block mt-2.5 mb-1">Số lượng tồn kho</label>
          <input
            id="stock"
            name="stock"
            type="number"
            min="0"
            value={formData.stock}
            onChange={handleChange}
            required
            className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
          />
          {fieldErrors.stock && <p className="mt-1 text-[#b42318] text-xs font-semibold">{fieldErrors.stock}</p>}

          <label htmlFor="discountPercent" className="text-[#1f3348] text-[13px] font-bold tracking-wide block mt-2.5 mb-1">% giảm giá</label>
          <input
            id="discountPercent"
            name="discountPercent"
            type="number"
            min="0"
            max="100"
            value={formData.discountPercent}
            onChange={handleChange}
            required
            className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
          />
          {fieldErrors.discountPercent && <p className="mt-1 text-[#b42318] text-xs font-semibold">{fieldErrors.discountPercent}</p>}

          <label htmlFor="finalPrice" className="text-[#1f3348] text-[13px] font-bold tracking-wide block mt-2.5 mb-1">Giá tiền</label>
          <input
            id="finalPrice"
            value={finalPricePreview.toLocaleString("vi-VN") + " đ"}
            readOnly
            className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-slate-50 text-admin-muted focus:outline-none"
          />

          <div className="flex flex-wrap gap-2.5 mt-4">
            <button
              type="submit"
              disabled={loading}
              className="min-w-[124px] rounded-full p-[10px_14px] bg-[#10375c] text-white font-semibold cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_9px_16px_rgba(9,26,44,0.14)] active:translate-y-0 transition-all duration-160 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
            >
              {loading ? "Đang thêm..." : "Thêm sản phẩm"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin/products/import")}
              className="min-w-[124px] rounded-full p-[10px_14px] bg-[#e8edf3] text-[#0f2233] font-semibold cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_9px_16px_rgba(9,26,44,0.14)] active:translate-y-0 transition-all duration-160 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
            >
              Import Excel
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin/products")}
              className="min-w-[124px] rounded-full p-[10px_14px] bg-[#e8edf3] text-[#0f2233] font-semibold cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_9px_16px_rgba(9,26,44,0.14)] active:translate-y-0 transition-all duration-160 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
            >
              Quay lại
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default AdminAddProductPage;
