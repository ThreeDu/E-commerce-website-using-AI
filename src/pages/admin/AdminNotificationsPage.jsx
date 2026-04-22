import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useStatusMessageBridge } from "../../hooks/useStatusMessageBridge";
import { getAdminNotifications } from "../../services/admin/notificationService";
import { getErrorMessage } from "../../utils/adminErrorUtils";
import "../../css/admin/notifications.css";

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

function NotificationSection({ title, subtitle, items, emptyText, renderItem, tone = "neutral" }) {
  return (
    <article className={`admin-notify-panel ${tone}`}>
      <header>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </header>
      {items.length === 0 ? (
        <p className="admin-notify-empty">{emptyText}</p>
      ) : (
        <ul className="admin-notify-list">
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
      },
      {
        key: "cancelledOrders",
        label: "Đơn bị hủy (24h)",
        value: Number(summary.cancelledOrders || 0),
        tone: "danger",
      },
      {
        key: "lowStockProducts",
        label: "Sản phẩm sắp hết",
        value: Number(summary.lowStockProducts || 0),
        tone: "warning",
      },
      {
        key: "outOfStockProducts",
        label: "Sản phẩm hết hàng",
        value: Number(summary.outOfStockProducts || 0),
        tone: "danger",
      },
      {
        key: "nearLimitDiscounts",
        label: "Mã giảm giá sắp hết lượt hoặc hạn",
        value: Number(summary.nearLimitDiscounts || 0),
        tone: "warning",
      },
      {
        key: "exhaustedDiscounts",
        label: "Mã giảm giá đã hết lượt hoặc hạn",
        value: Number(summary.exhaustedDiscounts || 0),
        tone: "danger",
      },
    ],
    [summary]
  );

  return (
    <main className="container page-content">
      <section className="hero-card admin-notify-page admin-page-enter" aria-busy={loading}>
        <div className="admin-notify-header">
          <div>
            <h2>Thông báo quản trị</h2>
            <p className="dashboard-subtitle">
              Theo dõi thời gian thực các sự kiện quan trọng: đơn mới, đơn hủy, tồn kho và trạng thái mã giảm giá.
            </p>
          </div>
          <div className="admin-notify-actions">
            <p>
              Cập nhật lúc: <strong>{formatDateTime(payload?.generatedAt)}</strong>
            </p>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => loadNotifications({ silent: true })}
              disabled={refreshing}
            >
              {refreshing ? "Đang làm mới..." : "Làm mới"}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <p className="form-message" role="status" aria-live="polite">
            {errorMessage}
          </p>
        ) : null}

        <section className="admin-notify-summary" aria-label="Tổng hợp cảnh báo">
          {summaryCards.map((card) => (
            <article key={card.key} className={`admin-notify-card ${card.tone}`}>
              <p>{card.label}</p>
              <strong>{card.value}</strong>
            </article>
          ))}
        </section>

        <section className="admin-notify-grid">
          <NotificationSection
            title="Đơn hàng mới"
            subtitle="Đơn tạo trong 24 giờ gần nhất"
            items={sections.newOrders || []}
            emptyText="Chưa có đơn hàng mới trong khung thời gian theo dõi."
            tone="info"
            renderItem={(item) => (
              <div className="admin-notify-item">
                <div>
                  <p className="admin-notify-item-title">{item.customerName}</p>
                  <p className="admin-notify-item-meta">#{item._id}</p>
                </div>
                <div className="admin-notify-item-right">
                  <strong>{formatCurrency(item.totalPrice)} đ</strong>
                  <span>{formatDateTime(item.createdAt)}</span>
                  <Link to={`/admin/orders/${item._id}`}>Xem đơn</Link>
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
            renderItem={(item) => (
              <div className="admin-notify-item">
                <div>
                  <p className="admin-notify-item-title">{item.customerName}</p>
                  <p className="admin-notify-item-meta">#{item._id}</p>
                </div>
                <div className="admin-notify-item-right">
                  <strong>{formatCurrency(item.totalPrice)} đ</strong>
                  <span>{formatDateTime(item.cancelledAt || item.updatedAt)}</span>
                  <Link to={`/admin/orders/${item._id}`}>Xem đơn</Link>
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
            renderItem={(item) => (
              <div className="admin-notify-item">
                <div>
                  <p className="admin-notify-item-title">{item.name}</p>
                  <p className="admin-notify-item-meta">Còn lại: {Number(item.stock || 0)}</p>
                </div>
                <div className="admin-notify-item-right">
                  <span>{formatDateTime(item.updatedAt)}</span>
                  <Link to={`/admin/products/edit/${item._id}`}>Cập nhật kho</Link>
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
            renderItem={(item) => (
              <div className="admin-notify-item">
                <div>
                  <p className="admin-notify-item-title">{item.name}</p>
                  <p className="admin-notify-item-meta">Tồn kho: {Number(item.stock || 0)}</p>
                </div>
                <div className="admin-notify-item-right">
                  <span>{formatDateTime(item.updatedAt)}</span>
                  <Link to={`/admin/products/edit/${item._id}`}>Nhập thêm</Link>
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
            renderItem={(item) => (
              <div className="admin-notify-item">
                <div>
                  <p className="admin-notify-item-title">{item.code}</p>
                  <p className="admin-notify-item-meta">
                    {Number(item.usageLimit || 0) > 0
                      ? `Đã dùng ${Number(item.usedCount || 0)}/${Number(item.usageLimit || 0)} lượt`
                      : "Không giới hạn số lượt"}
                  </p>
                </div>
                <div className="admin-notify-item-right">
                  <strong>
                    {item.isNearUsageLimit
                      ? `Còn ${Number(item.remainingUses || 0)} lượt`
                      : "Sắp hết hạn"}
                  </strong>
                  <span>{item.endDate ? `Hạn: ${formatDateTime(item.endDate)}` : "Không giới hạn ngày"}</span>
                  <Link to={`/admin/discounts/edit/${item._id}`}>Chỉnh sửa</Link>
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
            renderItem={(item) => (
              <div className="admin-notify-item">
                <div>
                  <p className="admin-notify-item-title">{item.code}</p>
                  <p className="admin-notify-item-meta">
                    {Number(item.usageLimit || 0) > 0
                      ? `Đã dùng ${Number(item.usedCount || 0)}/${Number(item.usageLimit || 0)} lượt`
                      : "Không giới hạn số lượt"}
                  </p>
                </div>
                <div className="admin-notify-item-right">
                  <strong>
                    {item.isExhaustedByUsage && item.isExpiredByDate
                      ? "Hết lượt + hết hạn"
                      : item.isExhaustedByUsage
                        ? "Hết lượt"
                        : "Hết hạn"}
                  </strong>
                  <span>{item.endDate ? `Hạn: ${formatDateTime(item.endDate)}` : "Không giới hạn ngày"}</span>
                  <Link to={`/admin/discounts/edit/${item._id}`}>Xử lý</Link>
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
