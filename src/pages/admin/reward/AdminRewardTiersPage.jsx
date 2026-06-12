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
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
      <section
        className="bg-admin-surface border border-admin-line rounded-3xl shadow-admin p-[28px] flex flex-col gap-6 animate-admin-rise bg-[radial-gradient(circle_at_92%_-10%,rgba(16,55,92,0.15),transparent_38%),radial-gradient(circle_at_0%_100%,rgba(20,109,80,0.09),transparent_30%),#ffffff]"
        aria-busy={loading || deleting}
      >
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-1">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-admin-ink mt-0 mb-1 flex items-center">
              <FontAwesomeIcon icon={faGift} className="mr-2.5 text-admin-primary" />
              Quản lý mức đổi thưởng
            </h2>
            <p className="text-admin-muted text-sm mt-1 mb-0">
              Cấu hình các mức điểm và phần thưởng voucher cho người dùng.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg font-semibold text-sm cursor-pointer bg-gradient-to-r from-admin-primary to-admin-sidebar-end text-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
            onClick={() => navigate("/admin/rewards/create")}
          >
            <FontAwesomeIcon icon={faPlus} />
            Thêm mới
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <p className="text-admin-muted text-sm animate-pulse">Đang tải danh sách mức đổi thưởng...</p>
        ) : (
          <div className="border border-admin-line rounded-xl shadow-admin bg-admin-surface overflow-hidden">
            <div className="w-full max-w-full overflow-x-hidden">
              <table className="w-full text-left border-collapse table-fixed text-[13px] [&>thead>tr>th]:bg-[#f2f7ff] [&>thead>tr>th]:text-[#4a5c75] [&>thead>tr>th]:font-semibold [&>thead>tr>th]:p-[10px_6px] [&>thead>tr>th]:break-words [&>thead>tr>th]:whitespace-normal [&>thead>tr>th]:align-middle [&>tbody>tr>td]:p-[10px_6px] [&>tbody>tr>td]:break-words [&>tbody>tr>td]:whitespace-normal [&>tbody>tr>td]:align-middle [&>tbody>tr]:border-b [&>tbody>tr]:border-admin-line [&>tbody>tr]:transition-colors hover:[&>tbody>tr]:bg-[#f8fbff]">
                <thead>
                  <tr>
                    <th className="w-[18%]">Tên</th>
                    <th className="w-[10%] text-center">Điểm cần</th>
                    <th className="w-[8%] text-center">Loại giảm</th>
                    <th className="w-[10%]">Giá trị</th>
                    <th className="w-[14%]">Đơn tối thiểu</th>
                    <th className="w-[9%] text-center">Hiệu lực (ngày)</th>
                    <th className="w-[11%] text-center">Trạng thái</th>
                    <th className="w-[20%] text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((tier) => (
                    <tr key={tier._id}>
                      <td>
                        <span className="font-bold text-admin-ink">{tier.name}</span>
                      </td>
                      <td className="text-center">{Number(tier.pointsRequired || 0).toLocaleString("vi-VN")}</td>
                      <td className="text-center">{tier.discountType === "percent" ? "%" : "Cố định"}</td>
                      <td>
                        {tier.discountType === "percent"
                          ? `${Number(tier.discountValue || 0).toLocaleString("vi-VN")}%`
                          : `${Number(tier.discountValue || 0).toLocaleString("vi-VN")} đ`}
                      </td>
                      <td>{Number(tier.minOrderValue || 0).toLocaleString("vi-VN")} đ</td>
                      <td className="text-center">{Number(tier.voucherValidDays || 0).toLocaleString("vi-VN")}</td>
                      <td className="text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            tier.isActive
                              ? "bg-[#e7f9ef] text-[#166534] border-[#d1ebd9]"
                              : "bg-[#e8edf3] text-[#5d6b82] border-[#cdd6e2]"
                          }`}
                        >
                          {tier.isActive ? "Hoạt động" : "Ngưng"}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1 flex-nowrap w-full">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 p-[5px_8px] text-[11px] font-semibold rounded-md bg-[#f6f9ff] text-[#0f3f84] border border-[#b5ccf0] hover:bg-[#eef4fb] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            onClick={() => navigate(`/admin/rewards/edit/${tier._id}`)}
                            title="Chỉnh sửa mức đổi thưởng"
                          >
                            <FontAwesomeIcon icon={faPen} />
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 p-[5px_8px] text-[11px] font-semibold rounded-md bg-admin-accent-soft text-[#9a3412] border border-[rgba(154,52,18,0.18)] hover:bg-[#ffe0d0] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            onClick={() => setTierPendingDelete(tier)}
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
                      <td colSpan="8" className="text-center! p-6! text-admin-muted">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[999] p-4" role="presentation">
          <div className="w-full max-w-[460px] bg-admin-surface rounded-xl border border-admin-line p-6 shadow-modal animate-admin-rise" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h3 id="delete-title" className="text-lg font-bold text-admin-ink mt-0 mb-2">Xác nhận xóa mức đổi thưởng</h3>
            <p className="text-admin-muted text-sm mt-0 mb-4">
              Bạn có chắc chắn muốn xóa <strong>{tierPendingDelete.name}</strong>?
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#e8edf3] text-admin-ink border border-[#d2dce8] hover:bg-[#dce3ec] transition-colors cursor-pointer"
                onClick={() => setTierPendingDelete(null)}
                disabled={deleting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-admin-primary to-admin-sidebar-end text-white border-0 hover:brightness-110 transition-all cursor-pointer"
                onClick={handleDelete}
                disabled={deleting}
              >
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
