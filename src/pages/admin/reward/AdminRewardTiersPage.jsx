import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useNotification } from "../../../context/NotificationContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faPen,
  faTrash,
  faGift,
} from "@fortawesome/free-solid-svg-icons";
import "../../../css/admin/rewards.css";

const API_BASE = "/api/auth/admin/rewards";

function AdminRewardTiersPage() {
  const { auth } = useAuth();
  const { success, error } = useNotification();
  const navigate = useNavigate();

  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [tierPendingDelete, setTierPendingDelete] = useState(null);

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
    <main className="container page-content admin-products-page admin-rewards-page">
      <section className="hero-card dashboard-surface admin-page-enter" aria-busy={loading || deleting}>
        <div className="dashboard-header-row">
          <div>
            <h2>
              <FontAwesomeIcon icon={faGift} style={{ marginRight: "10px", color: "var(--primary-color, #4f46e5)" }} />
              Quản lý mức đổi thưởng
            </h2>
            <p className="dashboard-subtitle">
              Cấu hình các mức điểm và phần thưởng voucher cho người dùng.
            </p>
          </div>
          <button
            type="button"
            className="primary-link-btn"
            onClick={() => navigate("/admin/rewards/create")}
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
            Thêm mới
          </button>
        </div>

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
                            onClick={() => navigate(`/admin/rewards/edit/${tier._id}`)}
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                            title="Chỉnh sửa mức đổi thưởng"
                          >
                            <FontAwesomeIcon icon={faPen} />
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="danger-btn"
                            onClick={() => setTierPendingDelete(tier)}
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                            title="Xóa mức đổi thưởng"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                            Xóa
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
