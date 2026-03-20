import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { getAdminProductById, updateAdminProduct } from "../../../services/admin/productService";
import { getAdminCategories } from "../../../services/admin/categoryService";
import "../../../css/admin-pages.css";

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
        setMessage(error.message);
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
      } catch (error) {
        setMessage(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadProductDetail();
  }, [auth?.token, id]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageModeChange = (event) => {
    const mode = event.target.value;
    setImageInputMode(mode);
    setUploadedFileName("");
    if (mode === "upload") {
      setFormData((prev) => ({ ...prev, imageUrl: "" }));
    }
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, imageUrl: String(reader.result || "") }));
      setUploadedFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setSaving(true);

    try {
      await updateAdminProduct(auth.token, id, {
        name: formData.name,
        category: formData.category,
        imageUrl: formData.imageUrl,
        price: Number(formData.price),
        stock: Number(formData.stock || 0),
        discountPercent: Number(formData.discountPercent || 0),
        description: formData.description,
      });

      navigate("/admin/products", {
        state: { successMessage: "Cập nhật sản phẩm thành công." },
      });
    } catch (error) {
      setMessage(error.message);
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
              <input type="file" accept="image/*" onChange={handleImageUpload} required />
              {uploadedFileName && <small>Đã chọn: {uploadedFileName}</small>}
            </>
          )}

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
