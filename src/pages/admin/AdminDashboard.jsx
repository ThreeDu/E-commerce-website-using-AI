import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";
import "../../css/admin/dashboard.css";

const mockMetrics = [
  { label: "Tổng đơn hôm nay", value: "128", trend: "+12% so với hôm qua", tone: "accent" },
  { label: "Doanh thu tạm tính", value: "186.500.000 đ", trend: "+8.4%", tone: "success" },
  { label: "Sản phẩm sắp hết", value: "17", trend: "Cần bổ sung trong ngày", tone: "warning" },
  { label: "Yêu cầu hỗ trợ", value: "6", trend: "2 yêu cầu ưu tiên cao", tone: "danger" },
];

const mockAlerts = [
  {
    title: "Mã giảm giá FLASH30 sắp hết hạn",
    description: "Mã sẽ hết hiệu lực sau 3 giờ. Kiểm tra chiến dịch thay thế.",
    level: "warning",
  },
  {
    title: "Danh mục Tai nghe có tỉ lệ hoàn đơn tăng",
    description: "Tỉ lệ hoàn đơn tăng 9% trong 7 ngày gần nhất.",
    level: "danger",
  },
  {
    title: "Kho trung tâm đã đồng bộ",
    description: "Dữ liệu tồn kho được cập nhật cách đây 2 phút.",
    level: "info",
  },
];

const mockActivities = [
  {
    actor: "admin@aishop.vn",
    action: "Cập nhật giá sản phẩm MacBook Air M3",
    time: "5 phút trước",
  },
  {
    actor: "admin@aishop.vn",
    action: "Tạo mới mã giảm giá SUMMER15",
    time: "15 phút trước",
  },
  {
    actor: "ops@aishop.vn",
    action: "Khóa tạm tài khoản user nguy cơ gian lận",
    time: "37 phút trước",
  },
  {
    actor: "inventory@aishop.vn",
    action: "Điều chỉnh tồn kho danh mục Bàn phím cơ",
    time: "1 giờ trước",
  },
];

const quickActions = [
  { label: "Thêm sản phẩm", to: "/admin/products/add" },
  { label: "Thêm mã giảm giá", to: "/admin/discounts/add" },
  { label: "Quản lý danh mục", to: "/admin/categories" },
  { label: "Xem log hệ thống", to: "/admin/system-logs" },
];

function AdminDashboard() {
  const { auth } = useAuth();

  return (
    <main className="container page-content">
      <section className="hero-card admin-dashboard admin-page-enter" aria-label="Tổng quan quản trị">
        <header className="admin-dashboard-header">
          <div>
            <h2>Bảng điều khiển Admin</h2>
            <p>
              Xin chào <strong>{auth?.user?.name || "Admin"}</strong>. Đây là bản phác thảo giao diện
              dashboard để theo dõi nhanh vận hành.
            </p>
          </div>
          <span className="dashboard-badge">Prototype UI</span>
        </header>

        <section className="admin-metric-grid" aria-label="Chỉ số nhanh">
          {mockMetrics.map((metric) => (
            <article key={metric.label} className={`admin-metric-card ${metric.tone}`}>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
              <span>{metric.trend}</span>
            </article>
          ))}
        </section>

        <section className="admin-dashboard-layout">
          <article className="dashboard-panel">
            <div className="panel-heading">
              <h3>Cảnh báo cần xử lý</h3>
              <span>{mockAlerts.length} mục</span>
            </div>
            <div className="dashboard-alert-list">
              {mockAlerts.map((alert) => (
                <div key={alert.title} className={`dashboard-alert-item ${alert.level}`}>
                  <h4>{alert.title}</h4>
                  <p>{alert.description}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="dashboard-panel">
            <div className="panel-heading">
              <h3>Hoạt động gần đây</h3>
              <span>Mô phỏng</span>
            </div>
            <ul className="dashboard-activity-list">
              {mockActivities.map((activity) => (
                <li key={`${activity.actor}-${activity.time}`}>
                  <p>{activity.action}</p>
                  <div>
                    <span>{activity.actor}</span>
                    <span>{activity.time}</span>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="dashboard-panel quick-actions-panel" aria-label="Tác vụ nhanh">
          <div className="panel-heading">
            <h3>Tác vụ nhanh</h3>
            <span>Điều hướng</span>
          </div>
          <div className="quick-actions-grid">
            {quickActions.map((action) => (
              <Link key={action.label} to={action.to} className="quick-action-link">
                {action.label}
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

export default AdminDashboard;
