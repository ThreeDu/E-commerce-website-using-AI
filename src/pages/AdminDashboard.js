import { useAuth } from "../context/AuthContext";

function AdminDashboard() {
  const { auth } = useAuth();

  return (
    <main className="container page-content">
      <section className="hero-card">
        <h2>Admin Dashboard</h2>
        <p>Xin chao {auth?.user?.name}, ban da dang nhap voi quyen admin.</p>
        <p>Tu day co the quan ly san pham, don hang va nguoi dung.</p>
      </section>
    </main>
  );
}

export default AdminDashboard;
