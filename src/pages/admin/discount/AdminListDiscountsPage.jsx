import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import {
  deleteAdminDiscount,
  getAdminDiscounts,
  updateAdminDiscount,
} from "../../../services/admin/discountService";
import { getErrorMessage } from "../../../utils/adminErrorUtils";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { auth } = useAuth();
  const hasInitializedFilters = useRef(false);

  const initialPage = useMemo(() => {
    const parsed = Number(searchParams.get("page") || 1);
    if (Number.isNaN(parsed) || parsed < 1) {
      return 1;
    }
    return Math.floor(parsed);
  }, [searchParams]);

  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [discountPendingDelete, setDiscountPendingDelete] = useState(null);
  const [selectedDiscountIds, setSelectedDiscountIds] = useState([]);
  const [message, setMessage] = useState(location.state?.successMessage || "");
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [typeFilter, setTypeFilter] = useState(searchParams.get("type") || "all");
  const [valueFilter, setValueFilter] = useState(searchParams.get("value") || "all");
  const [activeFilter, setActiveFilter] = useState(searchParams.get("active") || "all");
  const [timeFilter, setTimeFilter] = useState(searchParams.get("time") || "all");
  const [remainingFilter, setRemainingFilter] = useState(searchParams.get("remaining") || "all");
  const [currentPage, setCurrentPage] = useState(initialPage);

  const loadDiscounts = useCallback(async () => {
    if (!auth?.token) {
      return;
    }

    try {
      setLoading(true);
      const data = await getAdminDiscounts(auth.token);
      setDiscounts(data.discounts || []);
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể tải danh sách mã giảm giá."));
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

  const getRemainingQuantity = (discount) =>
    Math.max(0, Number(discount.usageLimit || 0) - Number(discount.usedCount || 0));

  const getTimeState = (discount) => {
    const now = new Date();
    const hasStart = Boolean(discount.startDate);
    const hasEnd = Boolean(discount.endDate);

    if (!hasStart || !hasEnd) {
      return "no-window";
    }

    const start = new Date(discount.startDate);
    const end = new Date(discount.endDate);

    if (start > now) {
      return "upcoming";
    }

    if (end < now) {
      return "expired";
    }

    return "running";
  };

  const filteredDiscounts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const valueMatcher = VALUE_FILTERS[valueFilter] || VALUE_FILTERS.all;

    return discounts.filter((discount) => {
      const discountValue = Number(discount.value || 0);
      const typeLabel = discount.type === "percent" ? "percent" : "fixed";
      const timeState = getTimeState(discount);
      const remaining = getRemainingQuantity(discount);

      const matchesSearch =
        !normalizedSearch ||
        (discount.code || "").toLowerCase().includes(normalizedSearch) ||
        (discount.type === "percent" ? "phan tram" : "so tien").includes(normalizedSearch);

      const matchesType = typeFilter === "all" || typeLabel === typeFilter;
      const matchesValue = valueMatcher(discountValue);
      const matchesActive =
        activeFilter === "all" ||
        (activeFilter === "active" ? Boolean(discount.isActive) : !Boolean(discount.isActive));
      const matchesTime = timeFilter === "all" || timeState === timeFilter;
      const matchesRemaining =
        remainingFilter === "all" ||
        (remainingFilter === "has-remaining" ? remaining > 0 : remaining === 0);

      return matchesSearch && matchesType && matchesValue && matchesActive && matchesTime && matchesRemaining;
    });
  }, [discounts, searchTerm, typeFilter, valueFilter, activeFilter, timeFilter, remainingFilter]);

  useEffect(() => {
    if (!hasInitializedFilters.current) {
      hasInitializedFilters.current = true;
      return;
    }

    setCurrentPage(1);
  }, [searchTerm, typeFilter, valueFilter, activeFilter, timeFilter, remainingFilter]);

  useEffect(() => {
    const nextParams = new URLSearchParams();

    if (searchTerm.trim()) {
      nextParams.set("q", searchTerm.trim());
    }

    if (typeFilter !== "all") {
      nextParams.set("type", typeFilter);
    }

    if (valueFilter !== "all") {
      nextParams.set("value", valueFilter);
    }

    if (activeFilter !== "all") {
      nextParams.set("active", activeFilter);
    }

    if (timeFilter !== "all") {
      nextParams.set("time", timeFilter);
    }

    if (remainingFilter !== "all") {
      nextParams.set("remaining", remainingFilter);
    }

    if (currentPage > 1) {
      nextParams.set("page", String(currentPage));
    }

    setSearchParams(nextParams, { replace: true });
  }, [
    searchTerm,
    typeFilter,
    valueFilter,
    activeFilter,
    timeFilter,
    remainingFilter,
    currentPage,
    setSearchParams,
  ]);

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

  useEffect(() => {
    const validIds = new Set(filteredDiscounts.map((item) => item._id));
    setSelectedDiscountIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [filteredDiscounts]);

  const selectedDiscounts = useMemo(
    () => filteredDiscounts.filter((discount) => selectedDiscountIds.includes(discount._id)),
    [filteredDiscounts, selectedDiscountIds]
  );

  const selectedIdsOnPage = useMemo(
    () => paginatedDiscounts.map((discount) => discount._id).filter((id) => selectedDiscountIds.includes(id)),
    [paginatedDiscounts, selectedDiscountIds]
  );

  const isAllOnPageSelected = paginatedDiscounts.length > 0 && selectedIdsOnPage.length === paginatedDiscounts.length;

  const toggleDiscountSelect = (discountId) => {
    setSelectedDiscountIds((prev) =>
      prev.includes(discountId) ? prev.filter((id) => id !== discountId) : [...prev, discountId]
    );
  };

  const toggleSelectAllOnPage = () => {
    const pageIds = paginatedDiscounts.map((discount) => discount._id);
    if (pageIds.length === 0) {
      return;
    }

    setSelectedDiscountIds((prev) => {
      if (isAllOnPageSelected) {
        return prev.filter((id) => !pageIds.includes(id));
      }

      const merged = new Set([...prev, ...pageIds]);
      return Array.from(merged);
    });
  };

  const toDiscountPayload = (discount, nextIsActive) => ({
    code: discount.code,
    type: discount.type,
    value: Number(discount.value),
    minOrderValue: Number(discount.minOrderValue || 0),
    maxDiscountValue: Number(discount.maxDiscountValue || 0),
    startDate: discount.startDate || null,
    endDate: discount.endDate || null,
    usageLimit: Number(discount.usageLimit || 0),
    isActive: nextIsActive,
  });

  const handleDelete = async () => {
    const bulkIds = discountPendingDelete?.ids || [];
    const isBulkDelete = bulkIds.length > 0;

    if (!isBulkDelete && !discountPendingDelete?._id) {
      return;
    }

    try {
      setDeleting(true);

      if (isBulkDelete) {
        const results = await Promise.allSettled(
          bulkIds.map((discountId) => deleteAdminDiscount(auth.token, discountId))
        );

        const succeededIds = results
          .map((result, index) => (result.status === "fulfilled" ? bulkIds[index] : null))
          .filter(Boolean);
        const failedCount = bulkIds.length - succeededIds.length;

        if (succeededIds.length > 0) {
          setDiscounts((prev) => prev.filter((item) => !succeededIds.includes(item._id)));
          setSelectedDiscountIds((prev) => prev.filter((id) => !succeededIds.includes(id)));
        }

        if (failedCount > 0) {
          setMessage(`Đã xóa ${succeededIds.length} mã, ${failedCount} mã thất bại.`);
        } else {
          setMessage(`Đã xóa ${succeededIds.length} mã giảm giá thành công.`);
        }
      } else {
        await deleteAdminDiscount(auth.token, discountPendingDelete._id);
        setDiscounts((prev) => prev.filter((item) => item._id !== discountPendingDelete._id));
        setSelectedDiscountIds((prev) => prev.filter((id) => id !== discountPendingDelete._id));
        setMessage("Xóa mã giảm giá thành công.");
      }

      setDiscountPendingDelete(null);
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể xóa mã giảm giá."));
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkActiveChange = async (nextIsActive) => {
    if (selectedDiscounts.length === 0) {
      return;
    }

    try {
      setBulkProcessing(true);
      const results = await Promise.allSettled(
        selectedDiscounts.map((discount) =>
          updateAdminDiscount(auth.token, discount._id, toDiscountPayload(discount, nextIsActive))
        )
      );

      const succeededIds = results
        .map((result, index) => (result.status === "fulfilled" ? selectedDiscounts[index]._id : null))
        .filter(Boolean);
      const failedCount = selectedDiscounts.length - succeededIds.length;

      if (succeededIds.length > 0) {
        setDiscounts((prev) =>
          prev.map((discount) =>
            succeededIds.includes(discount._id) ? { ...discount, isActive: nextIsActive } : discount
          )
        );
      }

      if (failedCount > 0) {
        setMessage(`Đã cập nhật ${succeededIds.length} mã, ${failedCount} mã thất bại.`);
      } else {
        setMessage(
          nextIsActive
            ? `Đã kích hoạt ${succeededIds.length} mã giảm giá.`
            : `Đã ngưng ${succeededIds.length} mã giảm giá.`
        );
      }
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể cập nhật trạng thái mã giảm giá."));
    } finally {
      setBulkProcessing(false);
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
            <label htmlFor="discount-active">Hoạt động</label>
            <select id="discount-active" value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
              <option value="all">Tất cả</option>
              <option value="active">Đang bật</option>
              <option value="inactive">Đang tắt</option>
            </select>
          </div>

          <div className="filter-control">
            <label htmlFor="discount-time">Thời gian hiệu lực</label>
            <select id="discount-time" value={timeFilter} onChange={(event) => setTimeFilter(event.target.value)}>
              <option value="all">Tất cả</option>
              <option value="running">Đang hiệu lực</option>
              <option value="upcoming">Sắp mở</option>
              <option value="expired">Hết hạn</option>
              <option value="no-window">Không giới hạn thời gian</option>
            </select>
          </div>

          <div className="filter-control">
            <label htmlFor="discount-remaining">Số lượt còn lại</label>
            <select
              id="discount-remaining"
              value={remainingFilter}
              onChange={(event) => setRemainingFilter(event.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="has-remaining">Còn lượt dùng</option>
              <option value="out-of-code">Đã hết lượt</option>
            </select>
          </div>
        </div>

        <div className="bulk-action-bar">
          <p>
            Đã chọn <strong>{selectedDiscounts.length}</strong> mã giảm giá
          </p>
          <div className="bulk-action-buttons">
            <button
              type="button"
              className="secondary-btn"
              disabled={selectedDiscounts.length === 0 || bulkProcessing}
              onClick={() => handleBulkActiveChange(true)}
            >
              Bật đã chọn
            </button>
            <button
              type="button"
              className="secondary-btn"
              disabled={selectedDiscounts.length === 0 || bulkProcessing}
              onClick={() => handleBulkActiveChange(false)}
            >
              Tắt đã chọn
            </button>
            <button
              type="button"
              className="danger-btn"
              disabled={selectedDiscounts.length === 0 || deleting || bulkProcessing}
              onClick={() =>
                setDiscountPendingDelete({
                  ids: selectedDiscounts.map((item) => item._id),
                  code: `${selectedDiscounts.length} mã đã chọn`,
                })
              }
            >
              Xóa đã chọn
            </button>
            <button
              type="button"
              className="secondary-btn"
              disabled={selectedDiscounts.length === 0}
              onClick={() => setSelectedDiscountIds([])}
            >
              Bỏ chọn
            </button>
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
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả mã giảm giá trong trang"
                        checked={isAllOnPageSelected}
                        onChange={toggleSelectAllOnPage}
                      />
                    </th>
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
                          <input
                            type="checkbox"
                            aria-label={`Chọn mã giảm giá ${discount.code}`}
                            checked={selectedDiscountIds.includes(discount._id)}
                            onChange={() => toggleDiscountSelect(discount._id)}
                          />
                        </td>
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
                              Số lượng còn lại: {getRemainingQuantity(discount).toLocaleString("vi-VN")}
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
                      <td colSpan="6" className="table-empty-cell">
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
              Bạn có chắc chắn muốn xóa <strong>{discountPendingDelete.code}</strong>?
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
