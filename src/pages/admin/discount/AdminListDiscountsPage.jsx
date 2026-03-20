import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { deleteAdminDiscount, getAdminDiscounts } from "../../../services/admin/discountService";
import "../../../css/admin/discounts.css";

const ITEMS_PER_PAGE = 8;

const VALUE_FILTERS = {
  all: () => true,
  under10: (value) => value < 10,
  from10To30: (value) => value >= 10 && value <= 30,
  over30: (value) => value > 30,
};

function AdminListDiscountsPage() {
  const location = useLocation();
  const { auth } = useAuth();
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [discountPendingDelete, setDiscountPendingDelete] = useState(null);
  const [message, setMessage] = useState(location.state?.successMessage || "");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [valueFilter, setValueFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const loadDiscounts = useCallback(async () => {
    if (!auth?.token) {
      return;
    }

    try {
      setLoading(true);
      const data = await getAdminDiscounts(auth.token);
      setDiscounts(data.discounts || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    loadDiscounts();
  }, [loadDiscounts]);

  const formatDateTime = (date) => {
    if (!date) {
      return "-";
    }

    return new Date(date).toLocaleString("vi-VN");
  };

  const getDiscountStatus = (discount) => {
    const now = new Date();
    const isUpcoming = discount.startDate ? new Date(discount.startDate) > now : false;
    const isExpired = discount.endDate ? new Date(discount.endDate) < now : false;
    const remainingQuantity = Math.max(
      0,
      Number(discount.usageLimit || 0) - Number(discount.usedCount || 0)
    );
    const isOutOfCode = remainingQuantity <= 0;

    if (!isExpired && isOutOfCode) {
      return "Hết mã";
    }

    if (isExpired) {
      return "Hết hạn";
    }

    if (isUpcoming) {
      return "Sắp mở";
    }

    if (isOutOfCode) {
      return "Hết mã";
    }

    return discount.isActive ? "Hoạt động" : "Ngưng";
  };

  const filteredDiscounts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const valueMatcher = VALUE_FILTERS[valueFilter] || VALUE_FILTERS.all;

    return discounts.filter((discount) => {
      const discountValue = Number(discount.value || 0);
      const status = getDiscountStatus(discount);
      const typeLabel = discount.type === "percent" ? "percent" : "fixed";

      const matchesSearch =
        !normalizedSearch ||
        (discount.code || "").toLowerCase().includes(normalizedSearch) ||
        (discount.type === "percent" ? "phan tram" : "so tien").includes(normalizedSearch);

      const matchesType = typeFilter === "all" || typeLabel === typeFilter;
      const matchesValue = valueMatcher(discountValue);
      const matchesStatus = statusFilter === "all" || status === statusFilter;

      return matchesSearch && matchesType && matchesValue && matchesStatus;
    });
  }, [discounts, searchTerm, typeFilter, valueFilter, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, valueFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDiscounts.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedDiscounts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDiscounts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredDiscounts, currentPage]);

  const handleDelete = async () => {
    if (!discountPendingDelete?._id) {
      return;
    }

    try {
      setDeleting(true);
      await deleteAdminDiscount(auth.token, discountPendingDelete._id);
      setDiscounts((prev) => prev.filter((item) => item._id !== discountPendingDelete._id));
      setMessage("Xóa mã giảm giá thành công.");
      setDiscountPendingDelete(null);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="container page-content">
      <section className="hero-card dashboard-surface">
        <div className="dashboard-header-row">
          <div>
            <h2>Quản lý mã giảm giá</h2>
            <p className="dashboard-subtitle">Theo dõi trạng thái hiệu lực và số lượng mã giảm giá theo thời gian thực.</p>
          </div>
          <Link to="/admin/discounts/add" className="primary-link-btn">
            + Thêm mã giảm giá
          </Link>
        </div>

        {message && <p className="form-message">{message}</p>}

        <div className="dashboard-metric-grid">
          <article className="metric-card">
            <span>Tổng mã</span>
            <strong>{discounts.length}</strong>
          </article>
          <article className="metric-card success">
            <span>Đang hoạt động</span>
            <strong>{discounts.filter((item) => getDiscountStatus(item) === "Hoạt động").length}</strong>
          </article>
          <article className="metric-card warning">
            <span>Hết mã</span>
            <strong>{discounts.filter((item) => getDiscountStatus(item) === "Hết mã").length}</strong>
          </article>
          <article className="metric-card danger">
            <span>Hết hạn</span>
            <strong>{discounts.filter((item) => getDiscountStatus(item) === "Hết hạn").length}</strong>
          </article>
        </div>

        <div className="dashboard-filter-bar">
          <div className="filter-control search-control">
            <label htmlFor="discount-search">Tìm kiếm</label>
            <input
              id="discount-search"
              type="text"
              placeholder="Mã giảm giá hoặc loại mã..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="filter-control">
            <label htmlFor="discount-type">Danh mục</label>
            <select id="discount-type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">Tất cả loại mã</option>
              <option value="percent">Phần trăm</option>
              <option value="fixed">Số tiền</option>
            </select>
          </div>

          <div className="filter-control">
            <label htmlFor="discount-value">Mức giảm</label>
            <select id="discount-value" value={valueFilter} onChange={(event) => setValueFilter(event.target.value)}>
              <option value="all">Tất cả mức giảm</option>
              <option value="under10">Dưới 10</option>
              <option value="from10To30">10 - 30</option>
              <option value="over30">Trên 30</option>
            </select>
          </div>

          <div className="filter-control">
            <label htmlFor="discount-status">Trạng thái</label>
            <select
              id="discount-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="Hoạt động">Hoạt động</option>
              <option value="Ngưng">Ngưng</option>
              <option value="Sắp mở">Sắp mở</option>
              <option value="Hết mã">Hết mã</option>
              <option value="Hết hạn">Hết hạn</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p>Đang tải danh sách mã giảm giá...</p>
        ) : (
          <div className="dashboard-table-card">
            <div className="users-table-wrap">
              <table className="users-table dashboard-table">
                <thead>
                  <tr>
                    <th>Mã giảm giá</th>
                    <th>Giá trị & điều kiện</th>
                    <th>Hiệu lực</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDiscounts.map((discount) => {
                    const status = getDiscountStatus(discount);

                    return (
                      <tr key={discount._id}>
                        <td>
                          <div className="cell-title truncate-text" title={discount.code}>
                            {discount.code}
                          </div>
                          <div className="cell-subtext">{discount.type === "percent" ? "Phần trăm" : "Số tiền"}</div>
                        </td>
                        <td>
                          <div className="price-stack">
                            <span className="pill price-pill">
                              {discount.type === "percent"
                                ? `${discount.value}%`
                                : `${Number(discount.value).toLocaleString("vi-VN")} đ`}
                            </span>
                            <span className="cell-subtext truncate-text" title={`Đơn tối thiểu: ${Number(discount.minOrderValue || 0).toLocaleString("vi-VN")} đ`}>
                              Đơn tối thiểu: {Number(discount.minOrderValue || 0).toLocaleString("vi-VN")} đ
                            </span>
                            <span className="cell-subtext">
                              Số lượng còn lại: {Math.max(
                                0,
                                Number(discount.usageLimit || 0) - Number(discount.usedCount || 0)
                              ).toLocaleString("vi-VN")}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="truncate-text" title={`${formatDateTime(discount.startDate)} - ${formatDateTime(discount.endDate)}`}>
                            {formatDateTime(discount.startDate)} - {formatDateTime(discount.endDate)}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`pill status-pill ${
                              status === "Hết hạn"
                                ? "danger"
                                : status === "Sắp mở"
                                  ? "info"
                                : status === "Hết mã"
                                  ? "warning"
                                  : status === "Hoạt động"
                                    ? "success"
                                    : "muted"
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <Link to={`/admin/discounts/edit/${discount._id}`} className="table-link-btn">
                              <span aria-hidden="true">✎</span> Sửa
                            </Link>
                            <button
                              type="button"
                              className="danger-btn"
                              onClick={() => setDiscountPendingDelete(discount)}
                            >
                              <span aria-hidden="true">🗑</span> Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedDiscounts.length === 0 && (
                    <tr>
                      <td colSpan="5" className="table-empty-cell">
                        Không tìm thấy mã giảm giá phù hợp bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="dashboard-pagination">
              <p>
                Hiển thị <strong>{paginatedDiscounts.length}</strong> / {filteredDiscounts.length} mã giảm giá
              </p>
              <div className="pagination-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  Trước
                </button>
                <span className="page-indicator">
                  Trang {currentPage}/{totalPages}
                </span>
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Sau
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {discountPendingDelete && (
        <div className="confirm-modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h3 id="delete-title">Xác nhận xóa mã giảm giá</h3>
            <p>
              Bạn có chắc chắn muốn xóa mã <strong>{discountPendingDelete.code}</strong>?
            </p>
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setDiscountPendingDelete(null)}
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

export default AdminListDiscountsPage;
