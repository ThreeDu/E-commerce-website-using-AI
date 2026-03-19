import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { deleteAdminProduct, getAdminProducts } from "../../../services/admin/productService";
import "../AdminPages.css";

function AdminListProductPage() {
  const location = useLocation();
  const { auth } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [productPendingDelete, setProductPendingDelete] = useState(null);
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

  const handleDelete = async () => {
    if (!productPendingDelete?._id) {
      return;
    }

    try {
      setDeleting(true);
      await deleteAdminProduct(auth.token, productPendingDelete._id);
      setProducts((prev) => prev.filter((product) => product._id !== productPendingDelete._id));
      setMessage("Xóa sản phẩm thành công.");
      setProductPendingDelete(null);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setDeleting(false);
    }
  };

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
                  <th>Danh mục</th>
                  <th>Giá</th>
                  <th>% giảm giá</th>
                  <th>Giá tiền</th>
                  <th>Tồn kho</th>
                  <th>Thao tác</th>
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
                    <td>{product.category || "Chưa phân loại"}</td>
                    <td>{Number(product.price).toLocaleString("vi-VN")} đ</td>
                    <td>{product.discountPercent ?? 0}%</td>
                    <td>{Number(product.finalPrice ?? product.price).toLocaleString("vi-VN")} đ</td>
                    <td>{product.stock ?? 0}</td>
                    <td>
                      <div className="table-actions">
                        <Link to={`/admin/products/edit/${product._id}`} className="table-link-btn">
                          Sửa
                        </Link>
                        <button
                          type="button"
                          className="danger-btn"
                          onClick={() => setProductPendingDelete(product)}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {productPendingDelete && (
        <div className="confirm-modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h3 id="delete-title">Xác nhận xóa sản phẩm</h3>
            <p>
              Bạn có chắc chắn muốn xóa sản phẩm <strong>{productPendingDelete.name}</strong>?
            </p>
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setProductPendingDelete(null)}
                disabled={deleting}
              >
                Hủy
              </button>
              <button type="button" className="danger-btn" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default AdminListProductPage;
