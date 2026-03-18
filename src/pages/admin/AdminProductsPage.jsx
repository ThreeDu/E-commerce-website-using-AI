import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getAdminProducts } from "../../services/authService";
import "./AdminPages.css";

function AdminProductsPage() {
  const location = useLocation();
  const { auth } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(location.state?.successMessage || "");

  const loadProducts = useCallback(async () => {
    if (!auth?.token) {
      return;
    }

    try {
      setLoading(true);
      const data = await getAdminProducts(auth.token);
      setProducts(data.products || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return (
    <main className="container page-content">
      <section className="hero-card">
        <h2>Quản lý sản phẩm</h2>
        {message && <p className="form-message">{message}</p>}

        <div className="admin-page-toolbar">
          <Link to="/admin/products/add" className="primary-link-btn">
            Thêm sản phẩm
          </Link>
        </div>

        {loading ? (
          <p>Đang tải danh sách sản phẩm...</p>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Ảnh</th>
                  <th>Tên sản phẩm</th>
                  <th>Giá</th>
                  <th>% giảm giá</th>
                  <th>Giá tiền</th>
                  <th>Tồn kho</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product._id}>
                    <td>
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="admin-product-thumb"
                      />
                    </td>
                    <td>{product.name}</td>
                    <td>{Number(product.price).toLocaleString("vi-VN")} đ</td>
                    <td>{product.discountPercent ?? 0}%</td>
                    <td>{Number(product.finalPrice ?? product.price).toLocaleString("vi-VN")} đ</td>
                    <td>{product.stock ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default AdminProductsPage;
