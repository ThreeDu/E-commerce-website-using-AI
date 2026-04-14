import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { createAdminDiscount } from "../../../services/admin/discountService";
import { getErrorMessage } from "../../../utils/adminErrorUtils";
import "../../../css/admin/discounts.css";

const composeUtcDateTime = (date, time) => {
  if (!date) {
    return "";
  }

  const mergedTime = time || "00:00";
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = mergedTime.split(":").map(Number);

  if (
    [year, month, day, hours, minutes].some((part) => Number.isNaN(part)) ||
    !year ||
    !month ||
    !day
  ) {
    return "";
  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString();
};

function AdminAddDiscountPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
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
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const validateForm = () => {
    const errors = {};
    const code = formData.code.trim().toUpperCase();
    const value = Number(formData.value);
    const minOrderValue = Number(formData.minOrderValue || 0);
    const maxDiscountValue = Number(formData.maxDiscountValue || 0);
    const usageLimit = Number(formData.usageLimit || 0);
    const hasStartDate = Boolean(formData.startDate);
    const hasEndDate = Boolean(formData.endDate);

    if (!code) {
      errors.code = "Mã giảm giá không được để trống.";
    }

    if (Number.isNaN(value) || value <= 0) {
      errors.value = "Giá trị giảm phải lớn hơn 0.";
    }

    if (formData.type === "percent" && value > 100) {
      errors.value = "Giảm giá theo phần trăm không được lớn hơn 100.";
    }

    if (Number.isNaN(minOrderValue) || minOrderValue < 0) {
      errors.minOrderValue = "Đơn tối thiểu không hợp lệ.";
    }

    if (Number.isNaN(maxDiscountValue) || maxDiscountValue < 0) {
      errors.maxDiscountValue = "Giảm tối đa không hợp lệ.";
    }

    if (Number.isNaN(usageLimit) || usageLimit < 0) {
      errors.usageLimit = "Số lượng không hợp lệ.";
    }

    if (hasStartDate !== hasEndDate) {
      errors.startDate = "Cần nhập đủ ngày bắt đầu và ngày kết thúc.";
      errors.endDate = "Cần nhập đủ ngày bắt đầu và ngày kết thúc.";
    }

    if (!hasStartDate && formData.startTime) {
      errors.startDate = "Vui lòng chọn ngày bắt đầu trước khi nhập giờ.";
    }

    if (!hasEndDate && formData.endTime) {
      errors.endDate = "Vui lòng chọn ngày kết thúc trước khi nhập giờ.";
    }

    const startDateTime = composeUtcDateTime(formData.startDate, formData.startTime);
    const endDateTime = composeUtcDateTime(formData.endDate, formData.endTime);
    if (startDateTime && endDateTime && new Date(startDateTime) > new Date(endDateTime)) {
      errors.endDate = "Ngày kết thúc phải sau ngày bắt đầu.";
    }

    return { errors, code, startDateTime, endDateTime };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setFieldErrors({});

    const { errors, code, startDateTime, endDateTime } = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setMessage("Vui lòng kiểm tra lại các trường dữ liệu.");
      return;
    }

    try {
      setSaving(true);
      await createAdminDiscount(auth.token, {
        code,
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
      setMessage(getErrorMessage(error, "Không thể thêm mã giảm giá."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="container page-content">
      <section className="hero-card admin-form-surface">
        <h2>Thêm mã giảm giá</h2>
        <p className="admin-surface-subtitle">Thiết lập chương trình khuyến mãi với thời gian áp dụng, điều kiện và giới hạn sử dụng rõ ràng.</p>
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
          {fieldErrors.code && <p className="field-error">{fieldErrors.code}</p>}

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
              {fieldErrors.value && <p className="field-error">{fieldErrors.value}</p>}
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
              {fieldErrors.minOrderValue && <p className="field-error">{fieldErrors.minOrderValue}</p>}
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
              {fieldErrors.maxDiscountValue && <p className="field-error">{fieldErrors.maxDiscountValue}</p>}
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
              {fieldErrors.startDate && <p className="field-error">{fieldErrors.startDate}</p>}
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
              {fieldErrors.endDate && <p className="field-error">{fieldErrors.endDate}</p>}
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
              {fieldErrors.usageLimit && <p className="field-error">{fieldErrors.usageLimit}</p>}
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
