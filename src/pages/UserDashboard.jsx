import { useAuth } from "../context/AuthContext";

function UserDashboard() {
  const { auth } = useAuth();

  return (
    <main className="container page-content">
      <section className="hero-card">
        <h2>Bảng điều khiển User</h2>
        <p>Xin chào {auth?.user?.name}, chào mừng bạn đã quay trở lại.</p>
        <p>
          Tại đây, bạn có thể xem lại lịch sử mua hàng và quản lý thông tin cá nhân của mình.
        </p>
      </section>
    </main>
  );
}

export default UserDashboard;