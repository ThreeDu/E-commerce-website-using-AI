import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { createAdminProduct } from "../../services/authService";
import "./AdminPages.css";

function AdminAddProductPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageInputMode, setImageInputMode] = useState("url");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [formData, setFormData] = useState({
    name: "",
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

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageModeChange = (event) => {
    const mode = event.target.value;
    setImageInputMode(mode);
    setUploadedFileName("");
    setFormData((prev) => ({ ...prev, imageUrl: "" }));
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
    setLoading(true);

    try {
      await createAdminProduct(auth.token, {
        name: formData.name,
        imageUrl: formData.imageUrl,
        price: Number(formData.price),
        stock: Number(formData.stock || 0),
        discountPercent: Number(formData.discountPercent || 0),
        description: formData.description,
      });

      navigate("/admin/products", {
        state: { successMessage: "Thêm sản phẩm thành công." },
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container page-content">
      <section className="hero-card">
        <h2>Thêm sản phẩm</h2>
        {message && <p className="form-message">{message}</p>}

        <form className="admin-product-add-form" onSubmit={handleSubmit}>
          <label htmlFor="name">Tên sản phẩm</label>
          <input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />

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
            <button type="submit" disabled={loading}>
              {loading ? "Đang thêm..." : "Thêm sản phẩm"}
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

export default AdminAddProductPage;
