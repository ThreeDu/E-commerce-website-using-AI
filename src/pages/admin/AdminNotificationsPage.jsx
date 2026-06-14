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
} from "@fortawesome/free-solid-svg-icons";
const AUTO_REFRESH_MS = 30000;

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("vi-VN");
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function NotificationSection({ title, subtitle, items, emptyText, renderItem, tone = "neutral", icon }) {
  return (
    <article
      className={`border border-[#dbe6f5] rounded-2xl bg-white p-4 grid gap-3 ${
        tone === "warning"
          ? "bg-gradient-to-b from-white to-[#fffdf8] [&>header>div>h3]:text-amber-800"
          : tone === "danger"
          ? "bg-gradient-to-b from-white to-[#fff8f8] [&>header>div>h3]:text-red-800"
          : "bg-gradient-to-b from-white to-[#f8fbff] [&>header>div>h3]:text-blue-800"
      }`}
    >
      <header>
        <div className="flex gap-2 items-center mb-1">
          {icon && <FontAwesomeIcon icon={icon} className="text-base" />}
          <h3 className="m-0 text-base font-bold text-admin-ink">{title}</h3>
        </div>
        <p className="m-0 mt-1 text-admin-muted text-xs font-medium">{subtitle}</p>
      </header>
      {items.length === 0 ? (
        <p className="m-0 border border-dashed border-[#cdd9e8] rounded-xl p-3 text-admin-muted bg-[#fafcff] text-xs">{emptyText}</p>
      ) : (
        <ul className="m-0 p-0 list-none grid gap-2">
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
      if (!auth?.token) {
        return;
      }

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
    if (!auth?.token) {
      return undefined;
    }

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
      },
      {
        key: "cancelledOrders",
        label: "Đơn bị hủy (24h)",
        value: Number(summary.cancelledOrders || 0),
        tone: "danger",
        icon: faCircleXmark,
      },
      {
        key: "lowStockProducts",
        label: "Sản phẩm sắp hết",
        value: Number(summary.lowStockProducts || 0),
        tone: "warning",
        icon: faWarehouse,
      },
      {
        key: "outOfStockProducts",
        label: "Sản phẩm hết hàng",
        value: Number(summary.outOfStockProducts || 0),
        tone: "danger",
        icon: faWarehouse,
      },
      {
        key: "nearLimitDiscounts",
        label: "Mã giảm giá sắp hết lượt hoặc hạn",
        value: Number(summary.nearLimitDiscounts || 0),
        tone: "warning",
        icon: faTicket,
      },
      {
        key: "exhaustedDiscounts",
        label: "Mã giảm giá đã hết lượt hoặc hạn",
        value: Number(summary.exhaustedDiscounts || 0),
        tone: "danger",
        icon: faTicket,
      },
    ],
    [summary]
  );

  return (
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
      <section
        className="bg-admin-surface border border-admin-line rounded-3xl shadow-admin p-6 md:p-8 grid gap-4 animate-admin-rise bg-[radial-gradient(circle_at_88%_-8%,rgba(255,111,60,0.12),transparent_40%),radial-gradient(circle_at_-5%_100%,rgba(15,118,110,0.11),transparent_32%),#ffffff]"
        aria-busy={loading}
      >
        <div className="flex flex-col md:flex-row items-start justify-between gap-3 mb-1">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-admin-ink mt-0 mb-1">Thông báo quản trị</h2>
            <p className="text-admin-muted mt-1.5 mb-0 text-sm md:text-base">
              Theo dõi thời gian thực các sự kiện quan trọng: đơn mới, đơn hủy, tồn kho và trạng thái mã giảm giá.
            </p>
          </div>
          <div className="grid gap-2 justify-items-start md:justify-items-end shrink-0">
            <p className="m-0 text-admin-muted text-xs md:text-sm">
              Cập nhật lúc: <strong>{formatDateTime(payload?.generatedAt)}</strong>
            </p>
            <button
              type="button"
              className="inline-flex items-center justify-center min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#ced8e7] bg-[#f8fbff] text-[#1e3a5f] font-bold text-xs md:text-sm cursor-pointer hover:bg-[#eef4fb] transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => loadNotifications({ silent: true })}
              disabled={refreshing}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <FontAwesomeIcon icon={faRotate} spin={refreshing} />
              {refreshing ? "Đang làm mới..." : "Làm mới"}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <p className="text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl p-3" role="status" aria-live="polite">
            {errorMessage}
          </p>
        ) : null}

        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 my-2" aria-label="Tổng hợp cảnh báo">
          {summaryCards.map((card) => (
            <article
              key={card.key}
              className={`rounded-2xl border border-[#dbe6f5] p-3 grid gap-1.5 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                card.tone === "warning"
                  ? "bg-[#fff8ec] border-[#f4dbb4] [&>strong]:text-amber-800"
                  : card.tone === "danger"
                  ? "bg-[#fff2f2] border-[#f0c6c6] [&>strong]:text-red-800"
                  : "bg-[#f1f7ff] border-[#d2e4fb] [&>strong]:text-blue-800"
              }`}
            >
              <div className="flex justify-between items-start w-full">
                <p className="m-0 text-admin-muted text-[11px] leading-snug font-medium">{card.label}</p>
                <FontAwesomeIcon icon={card.icon} className="text-sm opacity-60" />
              </div>
              <strong className="text-[#0f2233] text-2xl font-extrabold leading-none">{card.value}</strong>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mt-2">
          <NotificationSection
            title="Đơn hàng mới"
            subtitle="Đơn tạo trong 24 giờ gần nhất"
            items={sections.newOrders || []}
            emptyText="Chưa có đơn hàng mới trong khung thời gian theo dõi."
            tone="info"
            icon={faShoppingBag}
            renderItem={(item) => (
              <div className="border border-[#e5edf8] rounded-xl bg-white p-3 flex flex-col sm:flex-row justify-between gap-3 shadow-xs">
                <div>
                  <p className="m-0 font-bold text-admin-ink text-sm">{item.customerName}</p>
                  <p className="m-0 mt-1 text-admin-muted text-xs">#{item._id}</p>
                </div>
                <div className="text-left sm:text-right grid gap-1 sm:justify-items-end">
                  <strong className="text-admin-ink text-sm font-bold">{formatCurrency(item.totalPrice)} đ</strong>
                  <span className="text-admin-muted text-[11px]">{formatDateTime(item.createdAt)}</span>
                  <Link to={`/admin/orders/${item._id}`} className="text-[#0f5ea8] text-xs font-bold hover:underline inline-flex items-center gap-1">
                    <FontAwesomeIcon icon={faEye} /> Xem đơn
                  </Link>
                </div>
              </div>
            )}
          />

          <NotificationSection
            title="Đơn hàng bị hủy"
            subtitle="Đơn chuyển trạng thái hủy trong 24 giờ gần nhất"
            items={sections.cancelledOrders || []}
            emptyText="Không có đơn hàng bị hủy trong khung thời gian theo dõi."
            tone="danger"
            icon={faCircleXmark}
            renderItem={(item) => (
              <div className="border border-[#e5edf8] rounded-xl bg-white p-3 flex flex-col sm:flex-row justify-between gap-3 shadow-xs">
                <div>
                  <p className="m-0 font-bold text-admin-ink text-sm">{item.customerName}</p>
                  <p className="m-0 mt-1 text-admin-muted text-xs">#{item._id}</p>
                </div>
                <div className="text-left sm:text-right grid gap-1 sm:justify-items-end">
                  <strong className="text-admin-ink text-sm font-bold">{formatCurrency(item.totalPrice)} đ</strong>
                  <span className="text-admin-muted text-[11px]">{formatDateTime(item.cancelledAt || item.updatedAt)}</span>
                  <Link to={`/admin/orders/${item._id}`} className="text-[#0f5ea8] text-xs font-bold hover:underline inline-flex items-center gap-1">
                    <FontAwesomeIcon icon={faEye} /> Xem đơn
                  </Link>
                </div>
              </div>
            )}
          />

          <NotificationSection
            title="Sản phẩm sắp hết hàng"
            subtitle="Tồn kho nhỏ hơn hoặc bằng ngưỡng cảnh báo"
            items={sections.lowStockProducts || []}
            emptyText="Hiện chưa có sản phẩm nào chạm ngưỡng sắp hết hàng."
            tone="warning"
            icon={faWarehouse}
            renderItem={(item) => (
              <div className="border border-[#e5edf8] rounded-xl bg-white p-3 flex flex-col sm:flex-row justify-between gap-3 shadow-xs">
                <div>
                  <p className="m-0 font-bold text-admin-ink text-sm">{item.name}</p>
                  <p className="m-0 mt-1 text-admin-muted text-xs">Còn lại: {Number(item.stock || 0)}</p>
                </div>
                <div className="text-left sm:text-right grid gap-1 sm:justify-items-end">
                  <span className="text-admin-muted text-[11px]">{formatDateTime(item.updatedAt)}</span>
                  <Link to={`/admin/products/edit/${item._id}`} className="text-[#0f5ea8] text-xs font-bold hover:underline inline-flex items-center gap-1">
                    <FontAwesomeIcon icon={faBox} /> Cập nhật kho
                  </Link>
                </div>
              </div>
            )}
          />

          <NotificationSection
            title="Sản phẩm hết hàng"
            subtitle="Sản phẩm có tồn kho bằng 0"
            items={sections.outOfStockProducts || []}
            emptyText="Không có sản phẩm nào đang hết hàng."
            tone="danger"
            icon={faWarehouse}
            renderItem={(item) => (
              <div className="border border-[#e5edf8] rounded-xl bg-white p-3 flex flex-col sm:flex-row justify-between gap-3 shadow-xs">
                <div>
                  <p className="m-0 font-bold text-admin-ink text-sm">{item.name}</p>
                  <p className="m-0 mt-1 text-admin-muted text-xs">Tồn kho: {Number(item.stock || 0)}</p>
                </div>
                <div className="text-left sm:text-right grid gap-1 sm:justify-items-end">
                  <span className="text-admin-muted text-[11px]">{formatDateTime(item.updatedAt)}</span>
                  <Link to={`/admin/products/edit/${item._id}`} className="text-[#0f5ea8] text-xs font-bold hover:underline inline-flex items-center gap-1">
                    <FontAwesomeIcon icon={faBox} /> Nhập thêm
                  </Link>
                </div>
              </div>
            )}
          />

          <NotificationSection
            title="Mã giảm giá sắp hết lượt hoặc hạn"
            subtitle="Sắp chạm giới hạn lượt dùng hoặc sắp hết hạn"
            items={sections.nearLimitDiscounts || []}
            emptyText="Chưa có mã giảm giá nào sắp hết lượt hoặc sắp hết hạn."
            tone="warning"
            icon={faTicket}
            renderItem={(item) => (
              <div className="border border-[#e5edf8] rounded-xl bg-white p-3 flex flex-col sm:flex-row justify-between gap-3 shadow-xs">
                <div>
                  <p className="m-0 font-bold text-admin-ink text-sm">{item.code}</p>
                  <p className="m-0 mt-1 text-admin-muted text-xs">
                    {Number(item.usageLimit || 0) > 0
                      ? `Đã dùng ${Number(item.usedCount || 0)}/${Number(item.usageLimit || 0)} lượt`
                      : "Không giới hạn số lượt"}
                  </p>
                </div>
                <div className="text-left sm:text-right grid gap-1 sm:justify-items-end">
                  <strong className="text-admin-ink text-sm font-bold">
                    {item.isNearUsageLimit
                      ? `Còn ${Number(item.remainingUses || 0)} lượt`
                      : "Sắp hết hạn"}
                  </strong>
                  <span className="text-admin-muted text-[11px]">{item.endDate ? `Hạn: ${formatDateTime(item.endDate)}` : "Không giới hạn ngày"}</span>
                  <Link to={`/admin/discounts/edit/${item._id}`} className="text-[#0f5ea8] text-xs font-bold hover:underline inline-flex items-center gap-1">
                    <FontAwesomeIcon icon={faPen} /> Chỉnh sửa
                  </Link>
                </div>
              </div>
            )}
          />

          <NotificationSection
            title="Mã giảm giá đã hết lượt hoặc hạn"
            subtitle="Đã hết lượt dùng hoặc đã quá hạn"
            items={sections.exhaustedDiscounts || []}
            emptyText="Không có mã giảm giá nào đã hết lượt hoặc hết hạn."
            tone="danger"
            icon={faTicket}
            renderItem={(item) => (
              <div className="border border-[#e5edf8] rounded-xl bg-white p-3 flex flex-col sm:flex-row justify-between gap-3 shadow-xs">
                <div>
                  <p className="m-0 font-bold text-admin-ink text-sm">{item.code}</p>
                  <p className="m-0 mt-1 text-admin-muted text-xs">
                    {Number(item.usageLimit || 0) > 0
                      ? `Đã dùng ${Number(item.usedCount || 0)}/${Number(item.usageLimit || 0)} lượt`
                      : "Không giới hạn số lượt"}
                  </p>
                </div>
                <div className="text-left sm:text-right grid gap-1 sm:justify-items-end">
                  <strong className="text-admin-ink text-sm font-bold">
                    {item.isExhaustedByUsage && item.isExpiredByDate
                      ? "Hết lượt + hết hạn"
                      : item.isExhaustedByUsage
                        ? "Hết lượt"
                        : "Hết hạn"}
                  </strong>
                  <span className="text-admin-muted text-[11px]">{item.endDate ? `Hạn: ${formatDateTime(item.endDate)}` : "Không giới hạn ngày"}</span>
                  <Link to={`/admin/discounts/edit/${item._id}`} className="text-[#0f5ea8] text-xs font-bold hover:underline inline-flex items-center gap-1">
                    <FontAwesomeIcon icon={faPen} /> Xử lý
                  </Link>
                </div>
              </div>
            )}
          />
        </section>
      </section>
    </main>
  );
}

export default AdminNotificationsPage;
