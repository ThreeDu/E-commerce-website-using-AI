import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useStatusMessageBridge } from "../../hooks/useStatusMessageBridge";
import { getAdminNotifications } from "../../services/admin/notificationService";
import { getErrorMessage } from "../../utils/adminErrorUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRotate,
  faEye,
  faBox,
  faPen,
  faShoppingBag,
  faCircleXmark,
  faWarehouse,
  faTicket,
  faClock,
  faBell,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";

const AUTO_REFRESH_MS = 30000;

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN");
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function NotificationSection({ title, subtitle, items, emptyText, renderItem, tone = "neutral", icon }) {
  const toneClasses = {
    danger: {
      border: "border-rose-200",
      bg: "bg-rose-50/20",
      badge: "bg-rose-100 text-rose-700",
      icon: "text-rose-600",
    },
    warning: {
      border: "border-amber-200",
      bg: "bg-amber-50/20",
      badge: "bg-amber-100 text-amber-700",
      icon: "text-amber-600",
    },
    info: {
      border: "border-blue-200",
      bg: "bg-blue-50/20",
      badge: "bg-blue-100 text-blue-700",
      icon: "text-blue-600",
    },
  };

  const style = toneClasses[tone] || toneClasses.info;

  return (
    <article className={`admin-card p-5 flex flex-col gap-3.5 border ${style.border} ${style.bg} transition-all`}>
      <header className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            {icon && <FontAwesomeIcon icon={icon} className={`text-sm ${style.icon}`} />}
            <h3 className="m-0 text-base font-bold text-admin-ink">{title}</h3>
          </div>
          <p className="m-0 mt-1 text-admin-muted text-xs font-medium">{subtitle}</p>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 ${style.badge}`}>
          {items.length} mục
        </span>
      </header>

      {items.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center text-admin-muted bg-slate-50/40 text-xs font-medium">
          {emptyText}
        </div>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
          {items.map((item) => (
            <li key={item._id}>{renderItem(item)}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

function AdminNotificationsPage() {
  const { auth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [payload, setPayload] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useStatusMessageBridge(errorMessage, { title: "Thông báo quản trị", type: "error" });

  const loadNotifications = useCallback(
    async ({ silent = false } = {}) => {
      if (!auth?.token) return;

      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        setErrorMessage("");
        const data = await getAdminNotifications(auth.token);
        setPayload(data);
      } catch (error) {
        setErrorMessage(getErrorMessage(error, "Không thể tải thông báo quản trị."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [auth?.token]
  );

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!auth?.token) return undefined;
    const timerId = setInterval(() => {
      loadNotifications({ silent: true });
    }, AUTO_REFRESH_MS);
    return () => clearInterval(timerId);
  }, [auth?.token, loadNotifications]);

  const summary = useMemo(() => payload?.summary || {}, [payload]);
  const sections = useMemo(() => payload?.sections || {}, [payload]);

  const summaryCards = useMemo(
    () => [
      {
        key: "newOrders",
        label: "Đơn hàng mới (24h)",
        value: Number(summary.newOrders || 0),
        tone: "info",
        icon: faShoppingBag,
        colorClass: "bg-blue-50 text-blue-600 border-blue-200",
      },
      {
        key: "cancelledOrders",
        label: "Đơn bị hủy (24h)",
        value: Number(summary.cancelledOrders || 0),
        tone: "danger",
        icon: faCircleXmark,
        colorClass: "bg-rose-50 text-rose-600 border-rose-200",
      },
      {
        key: "lowStockProducts",
        label: "Sản phẩm sắp hết",
        value: Number(summary.lowStockProducts || 0),
        tone: "warning",
        icon: faTriangleExclamation,
        colorClass: "bg-amber-50 text-amber-600 border-amber-200",
      },
      {
        key: "outOfStockProducts",
        label: "Sản phẩm hết hàng",
        value: Number(summary.outOfStockProducts || 0),
        tone: "danger",
        icon: faWarehouse,
        colorClass: "bg-red-50 text-red-600 border-red-200",
      },
      {
        key: "nearLimitDiscounts",
        label: "Mã giảm giá sắp hết",
        value: Number(summary.nearLimitDiscounts || 0),
        tone: "warning",
        icon: faTicket,
        colorClass: "bg-orange-50 text-orange-600 border-orange-200",
      },
      {
        key: "exhaustedDiscounts",
        label: "Mã giảm giá hết lượt/hạn",
        value: Number(summary.exhaustedDiscounts || 0),
        tone: "danger",
        icon: faTicket,
        colorClass: "bg-rose-50 text-rose-600 border-rose-200",
      },
    ],
    [summary]
  );

  return (
    <main className="admin-page-container flex flex-col gap-6" aria-busy={loading}>
      {/* ── Page Header ── */}
      <section className="admin-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-extrabold text-admin-ink tracking-tight m-0 flex items-center gap-2.5">
              <FontAwesomeIcon icon={faBell} className="text-blue-600" />
              Trung tâm Thông báo Quản trị
            </h1>
          </div>
          <p className="text-sm text-admin-muted m-0">
            Theo dõi thời gian thực các sự kiện quan trọng: đơn mới, đơn hủy, tồn kho và trạng thái mã giảm giá.
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-admin-muted">
            <FontAwesomeIcon icon={faClock} className="text-slate-400 text-[11px]" />
            <span>Cập nhật lúc: <strong className="text-slate-700">{formatDateTime(payload?.generatedAt)}</strong></span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadNotifications({ silent: true })}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-admin-line bg-white hover:bg-slate-50 text-admin-body text-xs sm:text-sm font-semibold transition-all shadow-2xs hover:shadow-xs disabled:opacity-60 cursor-pointer shrink-0"
        >
          <FontAwesomeIcon icon={faRotate} spin={refreshing} className="text-blue-600" />
          <span>{refreshing ? "Đang đồng bộ..." : "Làm mới"}</span>
        </button>
      </section>

      {/* ── Error Banner ── */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium flex items-center gap-2.5">
          <FontAwesomeIcon icon={faCircleXmark} className="text-rose-500 text-base" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── Summary Bento Cards ── */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" aria-label="Tổng hợp cảnh báo">
        {summaryCards.map((card) => (
          <article
            key={card.key}
            className="admin-card p-4 flex flex-col justify-between gap-2.5 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex justify-between items-start w-full">
              <span className="text-admin-muted text-xs font-semibold leading-tight">{card.label}</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs border shrink-0 ${card.colorClass}`}>
                <FontAwesomeIcon icon={card.icon} />
              </div>
            </div>
            <strong className="text-admin-ink text-2xl font-black leading-none">{card.value}</strong>
          </article>
        ))}
      </section>

      {/* ── Notification Sections Grid (items-start prevents awkward vertical stretching) ── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" aria-label="Chi tiết thông báo">
        {/* 1. Đơn hàng mới */}
        <NotificationSection
          title="Đơn hàng mới"
          subtitle="Đơn tạo trong 24 giờ gần nhất"
          items={sections.newOrders || []}
          emptyText="Chưa có đơn hàng mới trong khung thời gian theo dõi."
          tone="info"
          icon={faShoppingBag}
          renderItem={(item) => (
            <div className="border border-slate-200/80 rounded-xl bg-white p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-2xs hover:border-slate-300 transition-colors">
              <div>
                <p className="m-0 font-bold text-admin-ink text-sm">{item.customerName}</p>
                <p className="m-0 mt-0.5 text-admin-muted text-xs font-mono">#{item._id}</p>
              </div>
              <div className="text-left sm:text-right flex flex-col sm:items-end gap-1 shrink-0">
                <strong className="text-admin-ink text-sm font-bold">{formatCurrency(item.totalPrice)} đ</strong>
                <span className="text-admin-muted text-[11px]">{formatDateTime(item.createdAt)}</span>
                <Link to={`/admin/orders/${item._id}`} className="text-blue-600 text-xs font-bold hover:underline inline-flex items-center gap-1">
                  <FontAwesomeIcon icon={faEye} /> Xem đơn
                </Link>
              </div>
            </div>
          )}
        />

        {/* 2. Đơn hàng bị hủy */}
        <NotificationSection
          title="Đơn hàng bị hủy"
          subtitle="Đơn chuyển trạng thái hủy trong 24 giờ gần nhất"
          items={sections.cancelledOrders || []}
          emptyText="Không có đơn hàng bị hủy trong khung thời gian theo dõi."
          tone="danger"
          icon={faCircleXmark}
          renderItem={(item) => (
            <div className="border border-slate-200/80 rounded-xl bg-white p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-2xs hover:border-slate-300 transition-colors">
              <div>
                <p className="m-0 font-bold text-admin-ink text-sm">{item.customerName}</p>
                <p className="m-0 mt-0.5 text-admin-muted text-xs font-mono">#{item._id}</p>
              </div>
              <div className="text-left sm:text-right flex flex-col sm:items-end gap-1 shrink-0">
                <strong className="text-rose-700 text-sm font-bold">{formatCurrency(item.totalPrice)} đ</strong>
                <span className="text-admin-muted text-[11px]">{formatDateTime(item.cancelledAt || item.updatedAt)}</span>
                <Link to={`/admin/orders/${item._id}`} className="text-blue-600 text-xs font-bold hover:underline inline-flex items-center gap-1">
                  <FontAwesomeIcon icon={faEye} /> Xem đơn
                </Link>
              </div>
            </div>
          )}
        />

        {/* 3. Sản phẩm sắp hết hàng */}
        <NotificationSection
          title="Sản phẩm sắp hết hàng"
          subtitle="Tồn kho nhỏ hơn hoặc bằng ngưỡng cảnh báo"
          items={sections.lowStockProducts || []}
          emptyText="Hiện chưa có sản phẩm nào chạm ngưỡng sắp hết hàng."
          tone="warning"
          icon={faWarehouse}
          renderItem={(item) => (
            <div className="border border-slate-200/80 rounded-xl bg-white p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-2xs hover:border-slate-300 transition-colors">
              <div>
                <p className="m-0 font-bold text-admin-ink text-sm">{item.name}</p>
                <p className="m-0 mt-0.5 text-amber-700 font-semibold text-xs">Còn lại: {Number(item.stock || 0)} sp</p>
              </div>
              <div className="text-left sm:text-right flex flex-col sm:items-end gap-1 shrink-0">
                <span className="text-admin-muted text-[11px]">{formatDateTime(item.updatedAt)}</span>
                <Link to={`/admin/products/edit/${item._id}`} className="text-blue-600 text-xs font-bold hover:underline inline-flex items-center gap-1">
                  <FontAwesomeIcon icon={faBox} /> Cập nhật kho
                </Link>
              </div>
            </div>
          )}
        />

        {/* 4. Sản phẩm hết hàng */}
        <NotificationSection
          title="Sản phẩm hết hàng"
          subtitle="Sản phẩm có tồn kho bằng 0"
          items={sections.outOfStockProducts || []}
          emptyText="Không có sản phẩm nào đang hết hàng."
          tone="danger"
          icon={faWarehouse}
          renderItem={(item) => (
            <div className="border border-slate-200/80 rounded-xl bg-white p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-2xs hover:border-slate-300 transition-colors">
              <div>
                <p className="m-0 font-bold text-admin-ink text-sm">{item.name}</p>
                <p className="m-0 mt-0.5 text-rose-700 font-semibold text-xs">Tồn kho: 0 (Đã hết)</p>
              </div>
              <div className="text-left sm:text-right flex flex-col sm:items-end gap-1 shrink-0">
                <span className="text-admin-muted text-[11px]">{formatDateTime(item.updatedAt)}</span>
                <Link to={`/admin/products/edit/${item._id}`} className="text-blue-600 text-xs font-bold hover:underline inline-flex items-center gap-1">
                  <FontAwesomeIcon icon={faBox} /> Nhập thêm
                </Link>
              </div>
            </div>
          )}
        />

        {/* 5. Mã giảm giá sắp hết lượt hoặc hạn */}
        <NotificationSection
          title="Mã giảm giá sắp hết lượt hoặc hạn"
          subtitle="Sắp chạm giới hạn lượt dùng hoặc sắp hết hạn"
          items={sections.nearLimitDiscounts || []}
          emptyText="Chưa có mã giảm giá nào sắp hết lượt hoặc sắp hết hạn."
          tone="warning"
          icon={faTicket}
          renderItem={(item) => (
            <div className="border border-slate-200/80 rounded-xl bg-white p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-2xs hover:border-slate-300 transition-colors">
              <div>
                <p className="m-0 font-bold text-admin-ink text-sm font-mono">{item.code}</p>
                <p className="m-0 mt-0.5 text-admin-muted text-xs">
                  {Number(item.usageLimit || 0) > 0
                    ? `Đã dùng ${Number(item.usedCount || 0)}/${Number(item.usageLimit || 0)} lượt`
                    : "Không giới hạn số lượt"}
                </p>
              </div>
              <div className="text-left sm:text-right flex flex-col sm:items-end gap-1 shrink-0">
                <strong className="text-amber-700 text-xs font-bold">
                  {item.isNearUsageLimit ? `Còn ${Number(item.remainingUses || 0)} lượt` : "Sắp hết hạn"}
                </strong>
                <span className="text-admin-muted text-[11px]">{item.endDate ? `Hạn: ${formatDateTime(item.endDate)}` : "Không giới hạn"}</span>
                <Link to={`/admin/discounts/edit/${item._id}`} className="text-blue-600 text-xs font-bold hover:underline inline-flex items-center gap-1">
                  <FontAwesomeIcon icon={faPen} /> Chỉnh sửa
                </Link>
              </div>
            </div>
          )}
        />

        {/* 6. Mã giảm giá đã hết lượt hoặc hạn */}
        <NotificationSection
          title="Mã giảm giá đã hết lượt hoặc hạn"
          subtitle="Đã hết lượt dùng hoặc đã quá hạn"
          items={sections.exhaustedDiscounts || []}
          emptyText="Không có mã giảm giá nào đã hết lượt hoặc hết hạn."
          tone="danger"
          icon={faTicket}
          renderItem={(item) => (
            <div className="border border-slate-200/80 rounded-xl bg-white p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-2xs hover:border-slate-300 transition-colors">
              <div>
                <p className="m-0 font-bold text-admin-ink text-sm font-mono">{item.code}</p>
                <p className="m-0 mt-0.5 text-admin-muted text-xs">
                  {Number(item.usageLimit || 0) > 0
                    ? `Đã dùng ${Number(item.usedCount || 0)}/${Number(item.usageLimit || 0)} lượt`
                    : "Không giới hạn số lượt"}
                </p>
              </div>
              <div className="text-left sm:text-right flex flex-col sm:items-end gap-1 shrink-0">
                <strong className="text-rose-700 text-xs font-bold">
                  {item.isExhaustedByUsage && item.isExpiredByDate
                    ? "Hết lượt + Hết hạn"
                    : item.isExhaustedByUsage
                    ? "Hết lượt dùng"
                    : "Đã quá hạn"}
                </strong>
                <span className="text-admin-muted text-[11px]">{item.endDate ? `Hạn: ${formatDateTime(item.endDate)}` : "Không giới hạn"}</span>
                <Link to={`/admin/discounts/edit/${item._id}`} className="text-blue-600 text-xs font-bold hover:underline inline-flex items-center gap-1">
                  <FontAwesomeIcon icon={faPen} /> Xử lý
                </Link>
              </div>
            </div>
          )}
        />
      </section>
    </main>
  );
}

export default AdminNotificationsPage;
