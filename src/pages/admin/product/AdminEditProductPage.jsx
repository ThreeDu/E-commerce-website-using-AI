import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { getAdminProductById, updateAdminProduct } from "../../../services/admin/productService";
import { getAdminCategories } from "../../../services/admin/categoryService";
import { getErrorMessage } from "../../../utils/adminErrorUtils";
import "../../../css/admin/products.css";

const MAX_IMAGE_SIZE_MB = 5;

const isUploadedImageValue = (value) => String(value || "").trim().startsWith("data:image/");

function AdminEditProductPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { auth } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
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

  useEffect(() => {
    const loadProductDetail = async () => {
      if (!auth?.token || !id) {
        return;
      }

      try {
        setLoading(true);
        const data = await getAdminProductById(auth.token, id);
        const product = data.product;

        setFormData({
          name: product.name || "",
          category: product.category || "",
          imageUrl: product.imageUrl || "",
          price: String(product.price ?? ""),
          stock: String(product.stock ?? 0),
          discountPercent: String(product.discountPercent ?? 0),
          description: product.description || "",
        });

        if (isUploadedImageValue(product.imageUrl)) {
          setImageInputMode("upload");
          setUploadedFileName("Ảnh hiện tại");
        } else {
          setImageInputMode("url");
          setUploadedFileName("");
        }
      } catch (error) {
        setMessage(getErrorMessage(error, "Không thể tải thông tin sản phẩm."));
      } finally {
        setLoading(false);
      }
    };

    loadProductDetail();
  }, [auth?.token, id]);

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
    if (mode !== "upload") {
      setUploadedFileName("");
    }
    setFieldErrors((prev) => ({ ...prev, imageUrl: "" }));
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
        imageUrl: trimmedImageUrl,
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

    setSaving(true);

    try {
      await updateAdminProduct(auth.token, id, payload);

      navigate("/admin/products", {
        state: { successMessage: "Cập nhật sản phẩm thành công." },
      });
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể cập nhật sản phẩm."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="container page-content">
        <section className="hero-card">
          <p>Đang tải thông tin sản phẩm...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="container page-content">
      <section className="hero-card">
        <h2>Sửa sản phẩm</h2>
        {message && <p className="form-message">{message}</p>}

        <form className="admin-product-add-form" onSubmit={handleSubmit}>
          <label htmlFor="name">Tên sản phẩm</label>
          <input id="name" name="name" value={formData.name} onChange={handleChange} required />
          {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}

          <label htmlFor="category">Danh mục</label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            disabled={loadingCategories}
            required
          >
            <option value="">{loadingCategories ? "Đang tải danh mục..." : "Chọn danh mục"}</option>
            {categoryOptions.map((item) => (
              <option key={item._id} value={getCategoryPath(item)}>
                {getCategoryPath(item)}
              </option>
            ))}
          </select>
          {fieldErrors.category && <p className="field-error">{fieldErrors.category}</p>}

          <label>Ảnh sản phẩm</label>
          <div className="image-mode-row">
            <label>
              <input
                type="radio"
                name="imageInputMode"
                value="url"
                checked={imageInputMode === "url"}
                onChange={handleImageModeChange}
              />
              Dùng URL
            </label>
            <label>
              <input
                type="radio"
                name="imageInputMode"
                value="upload"
                checked={imageInputMode === "upload"}
                onChange={handleImageModeChange}
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
            />
          ) : (
            <>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                required={!formData.imageUrl}
              />
              {uploadedFileName && <small>Đã chọn: {uploadedFileName}</small>}
              {!uploadedFileName && formData.imageUrl && <small>Đang dùng ảnh hiện tại.</small>}
            </>
          )}
          {fieldErrors.imageUrl && <p className="field-error">{fieldErrors.imageUrl}</p>}

          {imagePreviewSrc ? (
            <div className="admin-image-preview-wrap">
              <img src={imagePreviewSrc} alt="Xem trước ảnh sản phẩm" className="admin-image-preview" />
            </div>
          ) : null}

          <label htmlFor="description">Mô tả sản phẩm</label>
          <textarea
            id="description"
            name="description"
            rows="4"
            value={formData.description}
            onChange={handleChange}
          />

          <label htmlFor="price">Giá</label>
          <input
            id="price"
            name="price"
            type="number"
            min="0"
            value={formData.price}
            onChange={handleChange}
            required
          />
          {fieldErrors.price && <p className="field-error">{fieldErrors.price}</p>}

          <label htmlFor="stock">Số lượng tồn kho</label>
          <input
            id="stock"
            name="stock"
            type="number"
            min="0"
            value={formData.stock}
            onChange={handleChange}
            required
          />
          {fieldErrors.stock && <p className="field-error">{fieldErrors.stock}</p>}

          <label htmlFor="discountPercent">% giảm giá</label>
          <input
            id="discountPercent"
            name="discountPercent"
            type="number"
            min="0"
            max="100"
            value={formData.discountPercent}
            onChange={handleChange}
            required
          />
          {fieldErrors.discountPercent && <p className="field-error">{fieldErrors.discountPercent}</p>}

          <label htmlFor="finalPrice">Giá tiền</label>
          <input id="finalPrice" value={finalPricePreview.toLocaleString("vi-VN")} readOnly />

          <div className="add-form-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu cập nhật"}
            </button>
            <button type="button" className="secondary-btn" onClick={() => navigate("/admin/products")}>
              Quay lại
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default AdminEditProductPage;
