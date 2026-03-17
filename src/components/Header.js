import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Header() {
  const { auth, logout } = useAuth();

  return (
    <header className="site-header">
      <div className="container nav-wrap">
        <h1 className="brand">AI Shop</h1>
        <nav className="nav-menu">
          <Link to="/">Trang chu</Link>
          <Link to="/products">San pham</Link>
          {!auth && <Link to="/login">Dang nhap</Link>}
          {!auth && <Link to="/register">Dang ky</Link>}
          {auth?.user?.role === "admin" && <Link to="/admin/dashboard">Dashboard</Link>}
          {auth && (
            <button type="button" className="logout-btn" onClick={logout}>
              Dang xuat
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;
