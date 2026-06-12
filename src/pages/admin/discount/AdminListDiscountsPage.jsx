import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useStatusMessageBridge } from "../../../hooks/useStatusMessageBridge";
import {
  deleteAdminDiscount,
  getAdminDiscounts,
  updateAdminDiscount,
} from "../../../services/admin/discountService";
import { getErrorMessage } from "../../../utils/adminErrorUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faPen,
  faTrash,
  faChevronLeft,
  faChevronRight,
  faToggleOn,
  faToggleOff,
  faRotateLeft,
  faTicketSimple,
} from "@fortawesome/free-solid-svg-icons";
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

  useStatusMessageBridge(message, { title: "Mã giảm giá" });

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

  const totalDiscounts = discounts.length;
  const activeCount = discounts.filter((item) => getDiscountStatus(item) === "Hoạt động").length;
  const outOfCodeCount = discounts.filter((item) => getDiscountStatus(item) === "Hết mã").length;
  const expiredCount = discounts.filter((item) => getDiscountStatus(item) === "Hết hạn").length;

  const percent = (value) => {
    if (!totalDiscounts) {
      return "0%";
    }
    return `${Math.round((value / totalDiscounts) * 100)}%`;
  };

  return (
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
      <section className="bg-admin-surface bg-[radial-gradient(circle_at_88%_-8%,rgba(255,111,60,0.12),transparent_36%),radial-gradient(circle_at_-8%_100%,rgba(15,118,110,0.1),transparent_30%)] rounded-[18px] p-6 shadow-[0_12px_32px_rgba(15,23,42,0.08)] animate-admin-rise" aria-busy={loading || deleting || bulkProcessing}>
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-3.5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-admin-ink flex items-center">
              <FontAwesomeIcon icon={faTicketSimple} className="mr-2.5 text-admin-primary" />
              Quản lý mã giảm giá
            </h2>
            <p className="text-sm text-admin-muted mt-1.5 mb-0">Theo dõi trạng thái hiệu lực và số lượng mã giảm giá theo thời gian thực.</p>
          </div>
          <Link to="/admin/discounts/add" className="inline-flex items-center justify-center bg-gradient-to-r from-admin-primary to-[#0f314f] text-white px-3.5 py-2.5 rounded-xl font-semibold text-sm shadow-[0_8px_18px_rgba(15,118,110,0.22)] transition-all hover:-translate-y-0.5 hover:shadow-[0_9px_16px_rgba(9,26,44,0.14)]">
            <FontAwesomeIcon icon={faPlus} className="mr-1.5" />
            Thêm mã giảm giá
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 my-2.5">
          <article className="bg-admin-surface border border-admin-line rounded-lg p-2 px-3 shadow-xs flex flex-col justify-center min-h-[58px] gap-0.5 transition-all hover:-translate-y-0.5 hover:shadow-sm">
            <span className="text-[10px] font-semibold text-admin-muted uppercase tracking-wider leading-none ml-0.5">Tổng mã</span>
            <strong className="text-lg font-bold text-admin-ink leading-none ml-0.5">{totalDiscounts}</strong>
            <small className="text-[9px] text-admin-muted leading-tight ml-0.5">Toàn bộ mã khuyến mãi</small>
          </article>
          <article className="bg-admin-surface border border-admin-line rounded-lg p-2 px-3 shadow-xs flex flex-col justify-center min-h-[58px] gap-0.5 transition-all hover:-translate-y-0.5 hover:shadow-sm">
            <span className="text-[10px] font-semibold text-admin-muted uppercase tracking-wider leading-none ml-0.5">Đang hoạt động</span>
            <strong className="text-lg font-bold text-[#166534] leading-none ml-0.5">{activeCount}</strong>
            <small className="text-[9px] text-admin-muted leading-tight ml-0.5">Chiếm {percent(activeCount)}</small>
          </article>
          <article className="bg-admin-surface border border-admin-line rounded-lg p-2 px-3 shadow-xs flex flex-col justify-center min-h-[58px] gap-0.5 transition-all hover:-translate-y-0.5 hover:shadow-sm">
            <span className="text-[10px] font-semibold text-admin-muted uppercase tracking-wider leading-none ml-0.5">Hết mã</span>
            <strong className="text-lg font-bold text-[#b45309] leading-none ml-0.5">{outOfCodeCount}</strong>
            <small className="text-[9px] text-admin-muted leading-tight ml-0.5">Chiếm {percent(outOfCodeCount)}</small>
          </article>
          <article className="bg-admin-surface border border-admin-line rounded-lg p-2 px-3 shadow-xs flex flex-col justify-center min-h-[58px] gap-0.5 transition-all hover:-translate-y-0.5 hover:shadow-sm">
            <span className="text-[10px] font-semibold text-admin-muted uppercase tracking-wider leading-none ml-0.5">Hết hạn</span>
            <strong className="text-lg font-bold text-[#b42318] leading-none ml-0.5">{expiredCount}</strong>
            <small className="text-[9px] text-admin-muted leading-tight ml-0.5">Chiếm {percent(expiredCount)}</small>
          </article>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2.5 mb-4">
          <div className="sm:col-span-2 lg:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="discount-search" className="text-[11px] font-bold uppercase tracking-wider text-admin-muted">Tìm kiếm</label>
            <input
              id="discount-search"
              type="text"
              className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
              placeholder="Mã giảm giá hoặc loại mã..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="discount-type" className="text-[11px] font-bold uppercase tracking-wider text-admin-muted">Danh mục</label>
            <select
              id="discount-type"
              className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="all">Tất cả loại mã</option>
              <option value="percent">Phần trăm</option>
              <option value="fixed">Số tiền</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="discount-value" className="text-[11px] font-bold uppercase tracking-wider text-admin-muted">Mức giảm</label>
            <select
              id="discount-value"
              className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
              value={valueFilter}
              onChange={(event) => setValueFilter(event.target.value)}
            >
              <option value="all">Tất cả mức giảm</option>
              <option value="under10">Dưới 10</option>
              <option value="from10To30">10 - 30</option>
              <option value="over30">Trên 30</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="discount-active" className="text-[11px] font-bold uppercase tracking-wider text-admin-muted">Hoạt động</label>
            <select
              id="discount-active"
              className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="active">Đang bật</option>
              <option value="inactive">Đang tắt</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="discount-time" className="text-[11px] font-bold uppercase tracking-wider text-admin-muted">Thời gian hiệu lực</label>
            <select
              id="discount-time"
              className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
              value={timeFilter}
              onChange={(event) => setTimeFilter(event.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="running">Đang hiệu lực</option>
              <option value="upcoming">Sắp mở</option>
              <option value="expired">Hết hạn</option>
              <option value="no-window">Không giới hạn thời gian</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="discount-remaining" className="text-[11px] font-bold uppercase tracking-wider text-admin-muted">Số lượt còn lại</label>
            <select
              id="discount-remaining"
              className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
              value={remainingFilter}
              onChange={(event) => setRemainingFilter(event.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="has-remaining">Còn lượt dùng</option>
              <option value="out-of-code">Đã hết lượt</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 p-2.5 px-3 my-2.5 rounded-xl border border-[#dbe6f3] bg-[#f8fbff]">
          <p className="text-sm text-[#4f6078] m-0">
            Đã chọn <strong className="font-bold">{selectedDiscounts.length}</strong> mã giảm giá
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 border border-[#d0d9e4] rounded-lg py-2 px-3 text-xs font-semibold bg-[#e8edf3] text-admin-ink cursor-pointer hover:bg-[#dbe3ed] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={selectedDiscounts.length === 0 || bulkProcessing}
              onClick={() => handleBulkActiveChange(true)}
            >
              <FontAwesomeIcon icon={faToggleOn} className="text-[#22c55e]" />
              Bật đã chọn
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 border border-[#d0d9e4] rounded-lg py-2 px-3 text-xs font-semibold bg-[#e8edf3] text-admin-ink cursor-pointer hover:bg-[#dbe3ed] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={selectedDiscounts.length === 0 || bulkProcessing}
              onClick={() => handleBulkActiveChange(false)}
            >
              <FontAwesomeIcon icon={faToggleOff} className="text-admin-muted" />
              Tắt đã chọn
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 border border-[#9a3412]/20 rounded-lg py-2 px-3 text-xs font-semibold bg-admin-accent-soft text-[#9a3412] cursor-pointer hover:bg-[#ffd9c7] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={selectedDiscounts.length === 0 || deleting || bulkProcessing}
              onClick={() =>
                setDiscountPendingDelete({
                  ids: selectedDiscounts.map((item) => item._id),
                  code: `${selectedDiscounts.length} mã đã chọn`,
                })
              }
            >
              <FontAwesomeIcon icon={faTrash} />
              Xóa đã chọn
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 border border-[#d0d9e4] rounded-lg py-2 px-3 text-xs font-semibold bg-[#e8edf3] text-admin-ink cursor-pointer hover:bg-[#dbe3ed] transition-all"
              disabled={selectedDiscounts.length === 0}
              onClick={() => setSelectedDiscountIds([])}
            >
              <FontAwesomeIcon icon={faRotateLeft} />
              Bỏ chọn
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-center py-6 text-admin-muted text-sm">Đang tải danh sách mã giảm giá...</p>
        ) : (
          <>
            <div className="border border-[#e2eaf4] rounded-2xl overflow-hidden bg-admin-surface">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed text-[13px] [&>thead>tr>th]:bg-[#f2f7ff] [&>thead>tr>th]:text-[#4a5c75] [&>thead>tr>th]:font-semibold [&>thead>tr>th]:p-[8px_6px] [&>thead>tr>th]:align-middle [&>tbody>tr>td]:p-[8px_6px] [&>tbody>tr>td]:align-middle [&>tbody>tr>td]:break-words [&>tbody>tr]:border-b [&>tbody>tr]:border-admin-line [&>tbody>tr]:transition-colors hover:[&>tbody>tr]:bg-[#f8fbff]">
                  <thead>
                    <tr>
                      <th className="w-[5%] text-center">
                        <input
                          type="checkbox"
                          aria-label="Chọn tất cả mã giảm giá trong trang"
                          checked={isAllOnPageSelected}
                          onChange={toggleSelectAllOnPage}
                        />
                      </th>
                      <th className="w-[20%]">Mã giảm giá</th>
                      <th className="w-[23%]">Giá trị & điều kiện</th>
                      <th className="w-[22%]">Hiệu lực</th>
                      <th className="w-[12%] text-center">Trạng thái</th>
                      <th className="w-[18%]">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDiscounts.map((discount) => {
                      const status = getDiscountStatus(discount);

                      return (
                        <tr key={discount._id}>
                          <td className="text-center">
                            <input
                              type="checkbox"
                              aria-label={`Chọn mã giảm giá ${discount.code}`}
                              checked={selectedDiscountIds.includes(discount._id)}
                              onChange={() => toggleDiscountSelect(discount._id)}
                            />
                          </td>
                          <td>
                            <div className="font-bold text-admin-ink block break-words whitespace-normal" title={discount.code}>
                              {discount.code}
                            </div>
                            <div className="text-xs text-admin-muted mt-1 block break-words whitespace-normal">{discount.type === "percent" ? "Phần trăm" : "Số tiền"}</div>
                          </td>
                          <td>
                            <div className="grid gap-1 min-w-0">
                              <span className="inline-flex items-center rounded-full font-bold text-[11px] py-0.5 px-1.5 bg-[#e7f0ff] text-[#1749a6] w-max">
                                {discount.type === "percent"
                                  ? `${discount.value}%`
                                  : `${Number(discount.value).toLocaleString("vi-VN")} đ`}
                              </span>
                              <span className="text-xs text-admin-muted mt-1 block break-words whitespace-normal" title={`Đơn tối thiểu: ${Number(discount.minOrderValue || 0).toLocaleString("vi-VN")} đ`}>
                                Đơn tối thiểu: {Number(discount.minOrderValue || 0).toLocaleString("vi-VN")} đ
                              </span>
                              <span className="text-xs text-admin-muted mt-1 block break-words whitespace-normal">
                                Số lượng còn lại: {getRemainingQuantity(discount).toLocaleString("vi-VN")}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="flex flex-col gap-1" title={`${formatDateTime(discount.startDate)} - ${formatDateTime(discount.endDate)}`}>
                              <div className="flex items-center gap-1.5 text-[13px] leading-tight start-date">
                                <span className="text-[9px] uppercase font-bold text-admin-muted w-8 shrink-0 whitespace-nowrap">Từ:</span>
                                <span className="text-[#334155] font-medium font-mono text-[11px]">{formatDateTime(discount.startDate)}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[13px] leading-tight end-date">
                                <span className="text-[9px] uppercase font-bold text-admin-muted w-8 shrink-0 whitespace-nowrap">Đến:</span>
                                <span className="text-[#334155] font-medium font-mono text-[11px]">{formatDateTime(discount.endDate)}</span>
                              </div>
                            </div>
                          </td>
                          <td className="text-center">
                            <span
                              className={`inline-flex items-center rounded-full font-bold text-[11px] py-0.5 px-1.5 w-max ${
                                status === "Hết hạn"
                                  ? "bg-[#ffe8e8] text-[#b42318]"
                                  : status === "Sắp mở"
                                    ? "bg-[#e8f1ff] text-[#1d4ed8]"
                                  : status === "Hết mã"
                                    ? "bg-[#fff3dd] text-[#b45309]"
                                    : status === "Hoạt động"
                                      ? "bg-[#e7f9ef] text-[#166534]"
                                      : "bg-[#e8edf3] text-[#475569]"
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-1 flex-nowrap w-full">
                              <Link
                                to={`/admin/discounts/edit/${discount._id}`}
                                className="inline-flex items-center gap-1 py-1 px-2 text-[11px] font-semibold rounded-md border border-[#b5ccf0] bg-[#f6f9ff] text-[#0f3f84] hover:bg-[#e6efff] transition-colors shrink-0 whitespace-nowrap"
                                title="Chỉnh sửa mã giảm giá"
                              >
                                <FontAwesomeIcon icon={faPen} />
                                Sửa
                              </Link>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 py-1 px-2 text-[11px] font-semibold rounded-md border border-[#9a3412]/20 bg-admin-accent-soft text-[#9a3412] hover:bg-[#ffd9c7] transition-colors shrink-0 whitespace-nowrap"
                                onClick={() => setDiscountPendingDelete(discount)}
                                title="Xóa mã giảm giá"
                              >
                                <FontAwesomeIcon icon={faTrash} />
                                Xóa
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {paginatedDiscounts.length === 0 && (
                      <tr>
                        <td colSpan="6" className="text-center text-[#657589] p-6">
                          Không tìm thấy mã giảm giá phù hợp bộ lọc.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-3 px-4 border-t border-[#edf2f8]">
              <p className="text-sm text-admin-muted m-0">
                Hiển thị <strong className="font-bold">{paginatedDiscounts.length}</strong> / {filteredDiscounts.length} mã giảm giá
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center min-h-[34px] min-w-[92px] px-3.5 py-1.75 rounded-xl border border-[#cdd9e8] bg-[#f9fbfe] text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] hover:text-[#3f4f67] hover:shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="mr-1.5" />
                  Trước
                </button>
                <span className="min-w-[100px] text-center text-[#4b5b73] font-semibold text-sm">
                  Trang {currentPage}/{totalPages}
                </span>
                <button
                  type="button"
                  className="inline-flex items-center justify-center min-h-[34px] min-w-[92px] px-3.5 py-1.75 rounded-xl border border-[#cdd9e8] bg-[#f9fbfe] text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] hover:text-[#3f4f67] hover:shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Sau
                  <FontAwesomeIcon icon={faChevronRight} className="ml-1.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {discountPendingDelete && (
        <div className="fixed inset-0 bg-[#09111b]/50 flex items-center justify-center z-[999] p-4" role="presentation">
          <div className="w-[min(460px,100%)] bg-admin-surface rounded-xl p-4.5 shadow-[0_18px_36px_rgba(13,29,44,0.22)]" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h3 id="delete-title" className="text-lg font-bold text-admin-ink mt-0 mb-2">Xác nhận xóa mã giảm giá</h3>
            <p className="text-sm text-admin-muted mt-0 mb-3.5">
              Bạn có chắc chắn muốn xóa <strong className="font-bold">{discountPendingDelete.code}</strong>?
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                className="border border-[#d0d9e4] rounded-lg py-2 px-3.5 font-semibold text-sm bg-[#e8edf3] text-admin-ink cursor-pointer hover:bg-[#dbe3ed] transition-colors disabled:opacity-50"
                onClick={() => setDiscountPendingDelete(null)}
                disabled={deleting}
              >
                Hủy
              </button>
              <button type="button" className="border border-[#b42318] rounded-lg py-2 px-3.5 font-semibold text-sm bg-[#b42318] text-white cursor-pointer hover:bg-[#991b1b] transition-colors disabled:opacity-50" onClick={handleDelete} disabled={deleting}>
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
