import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useNotification } from "../../../context/NotificationContext";
import "../../../css/admin/products.css";

const API_BASE = "/api/auth/admin/rewards";

const EMPTY_FORM = {
  name: "",
  pointsRequired: "",
  discountType: "percent",
  discountValue: "",
  maxDiscountValue: "",
  minOrderValue: "",
  voucherValidDays: "",
  isActive: true,
};

function AdminRewardTiersPage() {
  const { auth } = useAuth();
  const { success, error } = useNotification();

  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);
  const [tierPendingDelete, setTierPendingDelete] = useState(null);

  const headers = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth?.token}`,
    }),
    [auth?.token]
  );

  const loadTiers = useCallback(async () => {
    if (!auth?.token) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(API_BASE, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });

      if (!res.ok) {
        throw new Error("Không thể tải danh sách mức đổi thưởng.");
      }

      const data = await res.json();
      setTiers(Array.isArray(data.tiers) ? data.tiers : (Array.isArray(data) ? data : []));
    } catch (err) {
      error(err.message || "Không thể tải danh sách mức đổi thưởng.");
    } finally {
      setLoading(false);
    }
  }, [auth?.token, error]);

  useEffect(() => {
    loadTiers();
  }, [loadTiers]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
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

      if (editingId) {
        const res = await fetch(`${API_BASE}/${editingId}`, {
          method: "PUT",
          headers: headers(),
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.message || "Không thể cập nhật mức đổi thưởng.");
        }

        const updated = await res.json();
        setTiers((prev) =>
          prev.map((tier) => (tier._id === editingId ? (updated.tier || updated) : tier))
        );
        success("Cập nhật mức đổi thưởng thành công.");
      } else {
        const res = await fetch(API_BASE, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.message || "Không thể thêm mức đổi thưởng.");
        }

        const created = await res.json();
        setTiers((prev) => [...prev, created.tier || created]);
        success("Thêm mức đổi thưởng thành công.");
      }

      resetForm();
    } catch (err) {
      error(err.message || "Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (tier) => {
    setEditingId(tier._id);
    setForm({
      name: tier.name || "",
      pointsRequired: tier.pointsRequired ?? "",
      discountType: tier.discountType || "percent",
      discountValue: tier.discountValue ?? "",
      maxDiscountValue: tier.maxDiscountValue ?? "",
      minOrderValue: tier.minOrderValue ?? "",
      voucherValidDays: tier.voucherValidDays ?? "",
      isActive: Boolean(tier.isActive),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async () => {
    if (!tierPendingDelete?._id) {
      return;
    }

    try {
      setDeleting(true);
      const res = await fetch(`${API_BASE}/${tierPendingDelete._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth?.token}` },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Không thể xóa mức đổi thưởng.");
      }

      setTiers((prev) => prev.filter((tier) => tier._id !== tierPendingDelete._id));
      success("Xóa mức đổi thưởng thành công.");
      setTierPendingDelete(null);
    } catch (err) {
      error(err.message || "Không thể xóa mức đổi thưởng.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="container page-content admin-products-page">
      <section className="hero-card dashboard-surface admin-page-enter" aria-busy={loading || submitting || deleting}>
        <div className="dashboard-header-row">
          <div>
            <h2>Quản lý mức đổi thưởng</h2>
            <p className="dashboard-subtitle">
              Cấu hình các mức điểm và phần thưởng voucher cho người dùng.
            </p>
          </div>
        </div>

        {/* Inline form */}
        <form className="admin-product-add-form" onSubmit={handleSubmit}>
          <h3>{editingId ? "Cập nhật mức đổi thưởng" : "Thêm mức đổi thưởng mới"}</h3>

          <input
            name="name"
            type="text"
            placeholder="Tên mức đổi thưởng"
            value={form.name}
            onChange={handleChange}
          />

          <input
            name="pointsRequired"
            type="number"
            placeholder="Điểm cần"
            min="0"
            value={form.pointsRequired}
            onChange={handleChange}
          />

          <select name="discountType" value={form.discountType} onChange={handleChange}>
            <option value="percent">Phần trăm (%)</option>
            <option value="fixed">Cố định (VNĐ)</option>
          </select>

          <input
            name="discountValue"
            type="number"
            placeholder="Giá trị giảm"
            min="0"
            value={form.discountValue}
            onChange={handleChange}
          />

          <input
            name="maxDiscountValue"
            type="number"
            placeholder="Giảm tối đa (VNĐ)"
            min="0"
            value={form.maxDiscountValue}
            onChange={handleChange}
          />

          <input
            name="minOrderValue"
            type="number"
            placeholder="Đơn tối thiểu (VNĐ)"
            min="0"
            value={form.minOrderValue}
            onChange={handleChange}
          />

          <input
            name="voucherValidDays"
            type="number"
            placeholder="Hiệu lực (ngày)"
            min="1"
            value={form.voucherValidDays}
            onChange={handleChange}
          />

          <label style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <input
              name="isActive"
              type="checkbox"
              checked={form.isActive}
              onChange={handleChange}
            />
            Kích hoạt
          </label>

          <div className="add-form-actions">
            <button type="submit" disabled={submitting}>
              {submitting
                ? "Đang xử lý..."
                : editingId
                  ? "Cập nhật"
                  : "Thêm mới"}
            </button>
            {editingId && (
              <button type="button" className="secondary-btn" onClick={resetForm}>
                Hủy
              </button>
            )}
          </div>
        </form>

        {/* Table */}
        {loading ? (
          <p>Đang tải danh sách mức đổi thưởng...</p>
        ) : (
          <div className="dashboard-table-card" style={{ marginTop: "24px" }}>
            <div className="users-table-wrap">
              <table className="users-table dashboard-table">
                <thead>
                  <tr>
                    <th>Tên</th>
                    <th>Điểm cần</th>
                    <th>Loại giảm</th>
                    <th>Giá trị</th>
                    <th>Đơn tối thiểu</th>
                    <th>Hiệu lực (ngày)</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((tier) => (
                    <tr key={tier._id}>
                      <td>
                        <span className="cell-title">{tier.name}</span>
                      </td>
                      <td>{Number(tier.pointsRequired || 0).toLocaleString("vi-VN")}</td>
                      <td>{tier.discountType === "percent" ? "%" : "Cố định"}</td>
                      <td>
                        {tier.discountType === "percent"
                          ? `${Number(tier.discountValue || 0).toLocaleString("vi-VN")}%`
                          : `${Number(tier.discountValue || 0).toLocaleString("vi-VN")} đ`}
                      </td>
                      <td>{Number(tier.minOrderValue || 0).toLocaleString("vi-VN")} đ</td>
                      <td>{Number(tier.voucherValidDays || 0).toLocaleString("vi-VN")}</td>
                      <td>
                        <span
                          className="pill"
                          style={
                            tier.isActive
                              ? { background: "#e7f9ef", color: "#166534" }
                              : { background: "#e8edf3", color: "#5d6b82" }
                          }
                        >
                          {tier.isActive ? "Hoạt động" : "Ngưng"}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="table-link-btn"
                            onClick={() => handleEdit(tier)}
                          >
                            <span aria-hidden="true">✎</span> Sửa
                          </button>
                          <button
                            type="button"
                            className="danger-btn"
                            onClick={() => setTierPendingDelete(tier)}
                          >
                            <span aria-hidden="true">🗑</span> Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {tiers.length === 0 && (
                    <tr>
                      <td colSpan="8" className="table-empty-cell">
                        Chưa có mức đổi thưởng nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Delete confirmation modal */}
      {tierPendingDelete && (
        <div className="confirm-modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h3 id="delete-title">Xác nhận xóa mức đổi thưởng</h3>
            <p>
              Bạn có chắc chắn muốn xóa <strong>{tierPendingDelete.name}</strong>?
            </p>
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setTierPendingDelete(null)}
                disabled={deleting}
              >
                Hủy
              </button>
              <button type="button" className="danger-btn" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default AdminRewardTiersPage;
