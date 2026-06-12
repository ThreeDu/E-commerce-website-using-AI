import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useNotification } from "../../../context/NotificationContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSave, faGift } from "@fortawesome/free-solid-svg-icons";
const API_BASE = "/api/auth/admin/rewards";

function AdminEditRewardTierPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const { success, error } = useNotification();

  const [form, setForm] = useState({
    name: "",
    pointsRequired: "",
    discountType: "percent",
    discountValue: "",
    maxDiscountValue: "",
    minOrderValue: "",
    voucherValidDays: "30",
    isActive: true,
  });
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchTierDetails = async () => {
      if (!auth?.token || !id) return;

      try {
        setFetching(true);
        const res = await fetch(`${API_BASE}/${id}`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });

        if (!res.ok) {
          throw new Error("Không thể lấy thông tin chi tiết mức đổi thưởng.");
        }

        const data = await res.json();
        const tier = data.tier || data;

        setForm({
          name: tier.name || "",
          pointsRequired: tier.pointsRequired ?? "",
          discountType: tier.discountType || "percent",
          discountValue: tier.discountValue ?? "",
          maxDiscountValue: tier.maxDiscountValue ?? "",
          minOrderValue: tier.minOrderValue ?? "",
          voucherValidDays: tier.voucherValidDays ?? "30",
          isActive: Boolean(tier.isActive),
        });
      } catch (err) {
        error(err.message || "Không thể lấy chi tiết mức đổi thưởng.");
        navigate("/admin/rewards");
      } finally {
        setFetching(false);
      }
    };

    fetchTierDetails();
  }, [auth?.token, id, error, navigate]);

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
      const res = await fetch(`${API_BASE}/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth?.token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Không thể cập nhật mức đổi thưởng.");
      }

      success("Cập nhật mức đổi thưởng thành công.");
      navigate("/admin/rewards");
    } catch (err) {
      error(err.message || "Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
      <section className="bg-admin-surface border border-admin-line rounded-3xl shadow-admin p-8 flex flex-col gap-6 animate-admin-rise bg-[radial-gradient(circle_at_92%_-10%,rgba(255,111,60,0.12),transparent_36%),radial-gradient(circle_at_-8%_100%,rgba(15, 118, 110, 0.1),transparent_30%),#ffffff]">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-1">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-admin-ink mt-0 mb-1 flex items-center">
              <FontAwesomeIcon icon={faGift} className="mr-2.5 text-admin-primary" />
              Cập nhật mức đổi thưởng
            </h2>
            <p className="text-admin-muted text-sm mt-1 mb-0">
              Sửa đổi các cài đặt điểm đổi và giá trị phần thưởng tương ứng.
            </p>
          </div>
        </div>

        {fetching ? (
          <p className="text-admin-muted text-sm animate-pulse">Đang tải thông tin chi tiết mức đổi thưởng...</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full max-w-[600px]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-[13px] font-bold tracking-wide text-[#1f3348]">Tên mức đổi thưởng *</label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Nhập tên mức đổi thưởng..."
                value={form.name}
                onChange={handleChange}
                className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pointsRequired" className="text-[13px] font-bold tracking-wide text-[#1f3348]">Điểm cần *</label>
                <input
                  id="pointsRequired"
                  name="pointsRequired"
                  type="number"
                  placeholder="Ví dụ: 100"
                  min="1"
                  value={form.pointsRequired}
                  onChange={handleChange}
                  className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="discountType" className="text-[13px] font-bold tracking-wide text-[#1f3348]">Loại giảm giá</label>
                <select
                  id="discountType"
                  name="discountType"
                  value={form.discountType}
                  onChange={handleChange}
                  className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
                >
                  <option value="percent">Phần trăm (%)</option>
                  <option value="fixed">Cố định (VNĐ)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="discountValue" className="text-[13px] font-bold tracking-wide text-[#1f3348]">Giá trị giảm *</label>
                <input
                  id="discountValue"
                  name="discountValue"
                  type="number"
                  placeholder="Ví dụ: 10 hoặc 50000"
                  min="1"
                  value={form.discountValue}
                  onChange={handleChange}
                  className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="maxDiscountValue" className="text-[13px] font-bold tracking-wide text-[#1f3348]">Giảm tối đa (VNĐ)</label>
                <input
                  id="maxDiscountValue"
                  name="maxDiscountValue"
                  type="number"
                  placeholder="Nhập số tiền giảm tối đa..."
                  min="0"
                  value={form.maxDiscountValue}
                  onChange={handleChange}
                  className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="minOrderValue" className="text-[13px] font-bold tracking-wide text-[#1f3348]">Đơn tối thiểu (VNĐ)</label>
                <input
                  id="minOrderValue"
                  name="minOrderValue"
                  type="number"
                  placeholder="Nhập giá trị đơn tối thiểu..."
                  min="0"
                  value={form.minOrderValue}
                  onChange={handleChange}
                  className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="voucherValidDays" className="text-[13px] font-bold tracking-wide text-[#1f3348]">Hiệu lực (ngày)</label>
                <input
                  id="voucherValidDays"
                  name="voucherValidDays"
                  type="number"
                  placeholder="Mặc định: 30 ngày"
                  min="1"
                  value={form.voucherValidDays}
                  onChange={handleChange}
                  className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-1.5">
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={handleChange}
                className="w-4 h-4 cursor-pointer accent-admin-primary"
              />
              <label htmlFor="isActive" className="text-sm font-semibold text-admin-ink cursor-pointer select-none">
                Kích hoạt mức đổi thưởng này
              </label>
            </div>

            <div className="flex gap-3 mt-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg font-semibold text-sm cursor-pointer bg-gradient-to-r from-admin-primary to-admin-sidebar-end text-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              >
                <FontAwesomeIcon icon={faSave} />
                {submitting ? "Đang lưu..." : "Cập nhật"}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg font-semibold text-sm cursor-pointer bg-[#e8edf3] text-admin-ink border border-[#d2dce8] hover:bg-[#dce3ec] transition-colors"
                onClick={() => navigate("/admin/rewards")}
              >
                Hủy
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

export default AdminEditRewardTierPage;
