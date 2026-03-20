import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { createAdminDiscount } from "../../../services/admin/discountService";
import "../../../css/admin/discounts.css";

const composeDateTime = (date, time) => {
  if (!date) {
    return "";
  }

  const mergedTime = time || "00:00";
  return `${date}T${mergedTime}`;
};

function AdminAddDiscountPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [formData, setFormData] = useState({
    code: "",
    type: "percent",
    value: "",
    minOrderValue: "0",
    maxDiscountValue: "0",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    usageLimit: "0",
    isActive: true,
  });

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    try {
      setSaving(true);
      const startDateTime = composeDateTime(formData.startDate, formData.startTime);
      const endDateTime = composeDateTime(formData.endDate, formData.endTime);
      await createAdminDiscount(auth.token, {
        code: formData.code,
        type: formData.type,
        value: Number(formData.value),
        minOrderValue: Number(formData.minOrderValue || 0),
        maxDiscountValue: Number(formData.maxDiscountValue || 0),
        startDate: startDateTime || null,
        endDate: endDateTime || null,
        usageLimit: Number(formData.usageLimit || 0),
        isActive: formData.isActive,
      });

      navigate("/admin/discounts", {
        state: { successMessage: "Thêm mã giảm giá thành công." },
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="container page-content">
      <section className="hero-card">
        <h2>Thêm mã giảm giá</h2>
        {message && <p className="form-message">{message}</p>}

        <form className="discount-form" onSubmit={handleSubmit}>
          <label htmlFor="code">Mã giảm giá</label>
          <input
            id="code"
            name="code"
            placeholder="Ví dụ: SUMMER20"
            value={formData.code}
            onChange={handleChange}
            required
          />

          <div className="discount-form-grid">
            <div>
              <label htmlFor="type">Loại giảm giá</label>
              <select id="type" name="type" value={formData.type} onChange={handleChange}>
                <option value="percent">Phần trăm (%)</option>
                <option value="fixed">Số tiền (đ)</option>
              </select>
            </div>

            <div>
              <label htmlFor="value">Giá trị giảm</label>
              <input
                id="value"
                name="value"
                type="number"
                min="0"
                value={formData.value}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label htmlFor="minOrderValue">Đơn tối thiểu</label>
              <input
                id="minOrderValue"
                name="minOrderValue"
                type="number"
                min="0"
                value={formData.minOrderValue}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="maxDiscountValue">Giảm tối đa</label>
              <input
                id="maxDiscountValue"
                name="maxDiscountValue"
                type="number"
                min="0"
                value={formData.maxDiscountValue}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="startDate">Ngày bắt đầu</label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                value={formData.startDate}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="startTime">Giờ bắt đầu</label>
              <input
                id="startTime"
                name="startTime"
                type="time"
                value={formData.startTime}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="endDate">Ngày kết thúc</label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                value={formData.endDate}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="endTime">Giờ kết thúc</label>
              <input
                id="endTime"
                name="endTime"
                type="time"
                value={formData.endTime}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="usageLimit">Số lượng</label>
              <input
                id="usageLimit"
                name="usageLimit"
                type="number"
                min="0"
                value={formData.usageLimit}
                onChange={handleChange}
              />
            </div>
          </div>

          <label>
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
            />{" "}
            Kích hoạt mã giảm giá
          </label>

          <div className="add-form-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Đang thêm..." : "Thêm mã giảm giá"}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => navigate("/admin/discounts")}
              disabled={saving}
            >
              Quay lại
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default AdminAddDiscountPage;
