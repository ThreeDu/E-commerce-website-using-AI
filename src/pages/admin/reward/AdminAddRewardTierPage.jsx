import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useNotification } from "../../../context/NotificationContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faGift } from "@fortawesome/free-solid-svg-icons";
import "../../../css/admin/rewards.css";

const API_BASE = "/api/auth/admin/rewards";

const EMPTY_FORM = {
  name: "",
  pointsRequired: "",
  discountType: "percent",
  discountValue: "",
  maxDiscountValue: "",
  minOrderValue: "",
  voucherValidDays: "30",
  isActive: true,
};

function AdminAddRewardTierPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const { success, error } = useNotification();

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      error("Vui lòng nhập tên mức đổi thưởng.");
      return;
    }

    if (!form.pointsRequired || Number(form.pointsRequired) <= 0) {
      error("Điểm cần phải lớn hơn 0.");
      return;
    }

    if (!form.discountValue || Number(form.discountValue) <= 0) {
      error("Giá trị giảm phải lớn hơn 0.");
      return;
    }

    if (form.discountType === "percent" && Number(form.discountValue) > 100) {
      error("Giá trị giảm theo phần trăm không được vượt quá 100%.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      pointsRequired: Number(form.pointsRequired),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      maxDiscountValue: Number(form.maxDiscountValue || 0),
      minOrderValue: Number(form.minOrderValue || 0),
      voucherValidDays: Number(form.voucherValidDays || 30),
      isActive: form.isActive,
    };

    try {
      setSubmitting(true);
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth?.token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Không thể thêm mức đổi thưởng.");
      }

      success("Thêm mức đổi thưởng thành công.");
      navigate("/admin/rewards");
    } catch (err) {
      error(err.message || "Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="container page-content admin-products-page admin-rewards-page">
      <section className="hero-card dashboard-surface admin-page-enter">
        <div className="dashboard-header-row" style={{ marginBottom: "20px" }}>
          <div>
            <h2>
              <FontAwesomeIcon icon={faGift} style={{ marginRight: "10px", color: "var(--primary-color, #4f46e5)" }} />
              Thêm mức đổi thưởng mới
            </h2>
            <p className="dashboard-subtitle">
              Cấu hình các mức điểm và phần thưởng voucher cho người dùng.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "600px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label htmlFor="name" style={{ fontWeight: "600", fontSize: "14px", color: "#374151" }}>Tên mức đổi thưởng *</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Nhập tên mức đổi thưởng..."
              value={form.name}
              onChange={handleChange}
              style={{
                padding: "10px 14px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "14px",
                width: "100%",
                boxSizing: "border-box"
              }}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="pointsRequired" style={{ fontWeight: "600", fontSize: "14px", color: "#374151" }}>Điểm cần *</label>
              <input
                id="pointsRequired"
                name="pointsRequired"
                type="number"
                placeholder="Ví dụ: 100"
                min="1"
                value={form.pointsRequired}
                onChange={handleChange}
                style={{
                  padding: "10px 14px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  width: "100%",
                  boxSizing: "border-box"
                }}
                required
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="discountType" style={{ fontWeight: "600", fontSize: "14px", color: "#374151" }}>Loại giảm giá</label>
              <select
                id="discountType"
                name="discountType"
                value={form.discountType}
                onChange={handleChange}
                style={{
                  padding: "10px 14px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  width: "100%",
                  backgroundColor: "#fff",
                  boxSizing: "border-box"
                }}
              >
                <option value="percent">Phần trăm (%)</option>
                <option value="fixed">Cố định (VNĐ)</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="discountValue" style={{ fontWeight: "600", fontSize: "14px", color: "#374151" }}>Giá trị giảm *</label>
              <input
                id="discountValue"
                name="discountValue"
                type="number"
                placeholder="Ví dụ: 10 hoặc 50000"
                min="1"
                value={form.discountValue}
                onChange={handleChange}
                style={{
                  padding: "10px 14px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  width: "100%",
                  boxSizing: "border-box"
                }}
                required
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="maxDiscountValue" style={{ fontWeight: "600", fontSize: "14px", color: "#374151" }}>Giảm tối đa (VNĐ)</label>
              <input
                id="maxDiscountValue"
                name="maxDiscountValue"
                type="number"
                placeholder="Nhập số tiền giảm tối đa..."
                min="0"
                value={form.maxDiscountValue}
                onChange={handleChange}
                style={{
                  padding: "10px 14px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  width: "100%",
                  boxSizing: "border-box"
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="minOrderValue" style={{ fontWeight: "600", fontSize: "14px", color: "#374151" }}>Đơn tối thiểu (VNĐ)</label>
              <input
                id="minOrderValue"
                name="minOrderValue"
                type="number"
                placeholder="Nhập giá trị đơn tối thiểu..."
                min="0"
                value={form.minOrderValue}
                onChange={handleChange}
                style={{
                  padding: "10px 14px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  width: "100%",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="voucherValidDays" style={{ fontWeight: "600", fontSize: "14px", color: "#374151" }}>Hiệu lực (ngày)</label>
              <input
                id="voucherValidDays"
                name="voucherValidDays"
                type="number"
                placeholder="Mặc định: 30 ngày"
                min="1"
                value={form.voucherValidDays}
                onChange={handleChange}
                style={{
                  padding: "10px 14px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  width: "100%",
                  boxSizing: "border-box"
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
            <input
              id="isActive"
              name="isActive"
              type="checkbox"
              checked={form.isActive}
              onChange={handleChange}
              style={{ width: "16px", height: "16px", cursor: "pointer" }}
            />
            <label htmlFor="isActive" style={{ fontWeight: "600", fontSize: "14px", color: "#374151", cursor: "pointer" }}>
              Kích hoạt mức đổi thưởng này
            </label>
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
            <button
              type="submit"
              disabled={submitting}
              className="primary-link-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 20px",
                border: "none",
                borderRadius: "6px",
                fontWeight: "600",
                fontSize: "14px",
                cursor: "pointer",
                backgroundColor: "var(--primary-color, #4f46e5)",
                color: "#fff"
              }}
            >
              <FontAwesomeIcon icon={faPlus} />
              {submitting ? "Đang lưu..." : "Thêm mới"}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => navigate("/admin/rewards")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 20px",
                borderRadius: "6px",
                fontWeight: "600",
                fontSize: "14px",
                cursor: "pointer"
              }}
            >
              Hủy
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default AdminAddRewardTierPage;
