import { useAuth } from "../../context/AuthContext";

function AdminDashboard() {
  const { auth } = useAuth();

  return (
    <main className="container page-content">
      <section className="hero-card">
        <h2>Bảng điều khiển Admin</h2>
        <p>Xin chào {auth?.user?.name}, bạn đã đăng nhập với quyền admin.</p>
        <p>Từ đây có thể quản lý sản phẩm, đơn hàng và người dùng.</p>
      </section>
    </main>
  );
}

export default AdminDashboard;
