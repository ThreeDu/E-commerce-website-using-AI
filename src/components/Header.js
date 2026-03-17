import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Header() {
  const { auth, logout } = useAuth();

  return (
    <header className="site-header">
      <div className="container nav-wrap">
        <h1 className="brand">AI Shop</h1>
        <nav className="nav-menu">
          <Link to="/">Trang chủ</Link>
          <Link to="/products">Sản phẩm</Link>
          {!auth && <Link to="/login">Đăng nhập</Link>}
          {auth?.user?.role === "admin" && <Link to="/admin/dashboard">Bảng điều khiển</Link>}
          {auth && (
            <button type="button" className="logout-btn" onClick={logout}>
              Đăng xuất
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;
