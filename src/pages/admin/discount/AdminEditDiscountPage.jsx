import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useStatusMessageBridge } from "../../../hooks/useStatusMessageBridge";
import { getAdminDiscountById, updateAdminDiscount } from "../../../services/admin/discountService";
import { getErrorMessage } from "../../../utils/adminErrorUtils";
import UserMultiSelect from "../../../components/admin/UserMultiSelect";
const toInputDateParts = (value) => {
  if (!value) {
    return { date: "", time: "" };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: "", time: "" };
  }

  const pad = (num) => String(num).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return {
    date: `${yyyy}-${mm}-${dd}`,
    time: `${hh}:${min}`,
  };
};

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

function AdminEditDiscountPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { auth } = useAuth();

  const [loading, setLoading] = useState(true);
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
    usageLimitPerUser: "0",
    allowedUsers: [],
    isActive: true,
  });

  useStatusMessageBridge(message, { title: "Mã giảm giá" });

  useEffect(() => {
    const loadDiscount = async () => {
      if (!auth?.token || !id) {
        return;
      }

      try {
        setLoading(true);
        const data = await getAdminDiscountById(auth.token, id);
        const discount = data.discount;
        const startParts = toInputDateParts(discount.startDate);
        const endParts = toInputDateParts(discount.endDate);

        setFormData({
          code: discount.code || "",
          type: discount.type || "percent",
          value: String(discount.value ?? ""),
          minOrderValue: String(discount.minOrderValue ?? 0),
          maxDiscountValue: String(discount.maxDiscountValue ?? 0),
          startDate: startParts.date,
          startTime: startParts.time,
          endDate: endParts.date,
          endTime: endParts.time,
          usageLimit: String(discount.usageLimit ?? 0),
          usageLimitPerUser: String(discount.usageLimitPerUser ?? 0),
          allowedUsers: (discount.allowedUsers || []).map((u) => ({
            value: u._id,
            label: `${u.name} (${u.email})`,
          })),
          isActive: Boolean(discount.isActive),
        });
      } catch (error) {
        setMessage(getErrorMessage(error, "Không thể tải thông tin mã giảm giá."));
      } finally {
        setLoading(false);
      }
    };

    loadDiscount();
  }, [auth?.token, id]);

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

  const handleAllowedUsersChange = (selectedOptions) => {
    setFormData((prev) => ({
      ...prev,
      allowedUsers: selectedOptions || [],
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

    const usageLimitPerUser = Number(formData.usageLimitPerUser || 0);
    if (Number.isNaN(usageLimitPerUser) || usageLimitPerUser < 0) {
      errors.usageLimitPerUser = "Giới hạn mỗi người không hợp lệ.";
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
      await updateAdminDiscount(auth.token, id, {
        code,
        type: formData.type,
        value: Number(formData.value),
        minOrderValue: Number(formData.minOrderValue || 0),
        maxDiscountValue: Number(formData.maxDiscountValue || 0),
        startDate: startDateTime || null,
        endDate: endDateTime || null,
        usageLimit: Number(formData.usageLimit || 0),
        usageLimitPerUser: Number(formData.usageLimitPerUser || 0),
        allowedUsers: formData.allowedUsers.map(opt => opt.value),
        isActive: formData.isActive,
      });

      navigate("/admin/discounts", {
        state: { successMessage: "Cập nhật mã giảm giá thành công." },
      });
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể cập nhật mã giảm giá."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
        <section className="relative border border-shop-line rounded-2xl p-6 shadow-admin bg-gradient-to-br from-white to-[#f8fbff] animate-admin-rise">
          <p className="text-center py-6 text-admin-muted text-sm">Đang tải thông tin mã giảm giá...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
      <section className="relative border border-shop-line rounded-2xl p-6 shadow-admin bg-gradient-to-br from-white to-[#f8fbff] animate-admin-rise">
        <h2 className="text-xl font-bold text-admin-ink tracking-tight">Sửa mã giảm giá</h2>
        <p className="text-sm text-admin-muted mt-1.5 mb-0 max-w-[760px] leading-relaxed">Điều chỉnh hiệu lực, mức giảm và trạng thái mã để chương trình vận hành đúng kế hoạch.</p>
        {message && <p className="mt-3 border border-[#ffd8a8] rounded-xl p-2.5 px-3 bg-[#fff8ef] text-[#9a3412] text-sm">{message}</p>}

        <form className="max-w-[760px] grid gap-2.5 mt-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="code" className="text-[13px] font-bold text-[#1f3348] tracking-wide block mb-1">Mã giảm giá</label>
            <input
              id="code"
              name="code"
              className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] hover:border-[#b6c9dd] transition-colors"
              value={formData.code}
              onChange={handleChange}
              required
            />
            {fieldErrors.code && <p className="mt-1 text-xs font-semibold text-[#b42318]">{fieldErrors.code}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            <div>
              <label htmlFor="type" className="text-[13px] font-bold text-[#1f3348] tracking-wide block mb-1">Loại giảm giá</label>
              <select
                id="type"
                name="type"
                className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] hover:border-[#b6c9dd] transition-colors admin-select-styled"
                value={formData.type}
                onChange={handleChange}
              >
                <option value="percent">Phần trăm (%)</option>
                <option value="fixed">Số tiền (đ)</option>
              </select>
            </div>

            <div>
              <label htmlFor="value" className="text-[13px] font-bold text-[#1f3348] tracking-wide block mb-1">Giá trị giảm</label>
              <input
                id="value"
                name="value"
                type="number"
                min="0"
                className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] hover:border-[#b6c9dd] transition-colors"
                value={formData.value}
                onChange={handleChange}
                required
              />
              {fieldErrors.value && <p className="mt-1 text-xs font-semibold text-[#b42318]">{fieldErrors.value}</p>}
            </div>

            <div>
              <label htmlFor="minOrderValue" className="text-[13px] font-bold text-[#1f3348] tracking-wide block mb-1">Đơn tối thiểu</label>
              <input
                id="minOrderValue"
                name="minOrderValue"
                type="number"
                min="0"
                className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] hover:border-[#b6c9dd] transition-colors"
                value={formData.minOrderValue}
                onChange={handleChange}
              />
              {fieldErrors.minOrderValue && <p className="mt-1 text-xs font-semibold text-[#b42318]">{fieldErrors.minOrderValue}</p>}
            </div>

            <div>
              <label htmlFor="maxDiscountValue" className="text-[13px] font-bold text-[#1f3348] tracking-wide block mb-1">Giảm tối đa</label>
              <input
                id="maxDiscountValue"
                name="maxDiscountValue"
                type="number"
                min="0"
                className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] hover:border-[#b6c9dd] transition-colors"
                value={formData.maxDiscountValue}
                onChange={handleChange}
              />
              {fieldErrors.maxDiscountValue && <p className="mt-1 text-xs font-semibold text-[#b42318]">{fieldErrors.maxDiscountValue}</p>}
            </div>

            <div>
              <label htmlFor="startDate" className="text-[13px] font-bold text-[#1f3348] tracking-wide block mb-1">Ngày bắt đầu</label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] hover:border-[#b6c9dd] transition-colors"
                value={formData.startDate}
                onChange={handleChange}
              />
              {fieldErrors.startDate && <p className="mt-1 text-xs font-semibold text-[#b42318]">{fieldErrors.startDate}</p>}
            </div>

            <div>
              <label htmlFor="startTime" className="text-[13px] font-bold text-[#1f3348] tracking-wide block mb-1">Giờ bắt đầu</label>
              <input
                id="startTime"
                name="startTime"
                type="time"
                className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] hover:border-[#b6c9dd] transition-colors"
                value={formData.startTime}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="endDate" className="text-[13px] font-bold text-[#1f3348] tracking-wide block mb-1">Ngày kết thúc</label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] hover:border-[#b6c9dd] transition-colors"
                value={formData.endDate}
                onChange={handleChange}
              />
              {fieldErrors.endDate && <p className="mt-1 text-xs font-semibold text-[#b42318]">{fieldErrors.endDate}</p>}
            </div>

            <div>
              <label htmlFor="endTime" className="text-[13px] font-bold text-[#1f3348] tracking-wide block mb-1">Giờ kết thúc</label>
              <input
                id="endTime"
                name="endTime"
                type="time"
                className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] hover:border-[#b6c9dd] transition-colors"
                value={formData.endTime}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="usageLimit" className="text-[13px] font-bold text-[#1f3348] tracking-wide block mb-1">Tổng số lượt dùng</label>
              <input
                id="usageLimit"
                name="usageLimit"
                type="number"
                min="0"
                className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] hover:border-[#b6c9dd] transition-colors"
                value={formData.usageLimit}
                onChange={handleChange}
              />
              {fieldErrors.usageLimit && <p className="mt-1 text-xs font-semibold text-[#b42318]">{fieldErrors.usageLimit}</p>}
            </div>

            <div>
              <label htmlFor="usageLimitPerUser" className="text-[13px] font-bold text-[#1f3348] tracking-wide block mb-1">Lượt dùng / Người</label>
              <input
                id="usageLimitPerUser"
                name="usageLimitPerUser"
                type="number"
                min="0"
                className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] hover:border-[#b6c9dd] transition-colors"
                value={formData.usageLimitPerUser}
                onChange={handleChange}
                placeholder="0 = không giới hạn"
              />
              {fieldErrors.usageLimitPerUser && <p className="mt-1 text-xs font-semibold text-[#b42318]">{fieldErrors.usageLimitPerUser}</p>}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-[13px] font-bold text-[#1f3348] tracking-wide mb-2">Tài khoản được chỉ định (để trống nếu áp dụng cho mọi người)</label>
            <UserMultiSelect 
              value={formData.allowedUsers} 
              onChange={handleAllowedUsersChange} 
              token={auth?.token}
            />
          </div>

          <label className="flex items-center gap-2 text-[13px] font-bold text-[#1f3348] tracking-wide cursor-pointer my-2">
            <input
              type="checkbox"
              name="isActive"
              className="w-4 h-4 rounded text-admin-primary focus:ring-admin-primary"
              checked={formData.isActive}
              onChange={handleChange}
            />
            Kích hoạt mã giảm giá
          </label>

          <div className="flex gap-2.5 mt-4">
            <button type="submit" className="min-w-[124px] bg-gradient-to-r from-admin-primary to-[#0f314f] text-white py-2.5 px-3.5 rounded-full font-semibold text-sm transition-all duration-160 hover:-translate-y-0.5 hover:shadow-[0_9px_16px_rgba(9,26,44,0.14)] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu cập nhật"}
            </button>
            <button
              type="button"
              className="min-w-[124px] bg-[#e8edf3] text-admin-ink py-2.5 px-3.5 rounded-full font-semibold text-sm transition-all duration-160 hover:-translate-y-0.5 hover:shadow-[0_9px_16px_rgba(9,26,44,0.14)] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
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

export default AdminEditDiscountPage;
