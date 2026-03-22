import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { deleteAdminProduct, getAdminProducts } from "../../../services/admin/productService";
import { getErrorMessage } from "../../../utils/adminErrorUtils";
import "../../../css/admin/products.css";

const ITEMS_PER_PAGE = 8;

const PRICE_FILTERS = {
  all: () => true,
  under500k: (price) => price < 500000,
  from500kTo2m: (price) => price >= 500000 && price <= 2000000,
  over2m: (price) => price > 2000000,
};

function AdminListProductPage() {
  const location = useLocation();
  const { auth } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [productPendingDelete, setProductPendingDelete] = useState(null);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [message, setMessage] = useState(location.state?.successMessage || "");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const loadProducts = useCallback(async () => {
    if (!auth?.token) {
      return;
    }

    try {
      setLoading(true);
      const data = await getAdminProducts(auth.token);
      setProducts(data.products || []);
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể tải danh sách sản phẩm."));
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const categories = useMemo(() => {
    const values = products
      .map((product) => (product.category || "Chưa phân loại").trim())
      .filter(Boolean);
    return Array.from(new Set(values));
  }, [products]);

  const getStockStatus = useCallback((stock) => {
    const numericStock = Number(stock || 0);
    if (numericStock <= 0) {
      return "out-stock";
    }
    if (numericStock <= 10) {
      return "low-stock";
    }
    return "in-stock";
  }, []);

  const getStockStatusLabel = useCallback((stock) => {
    const status = getStockStatus(stock);
    if (status === "out-stock") {
      return "Hết hàng";
    }
    if (status === "low-stock") {
      return "Sắp hết";
    }
    return "Còn hàng";
  }, [getStockStatus]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const priceMatcher = PRICE_FILTERS[priceFilter] || PRICE_FILTERS.all;

    return products.filter((product) => {
      const categoryName = product.category || "Chưa phân loại";
      const finalPrice = Number(product.finalPrice ?? product.price ?? 0);
      const stockStatus = getStockStatus(product.stock);

      const matchesSearch =
        !normalizedSearch ||
        (product.name || "").toLowerCase().includes(normalizedSearch) ||
        categoryName.toLowerCase().includes(normalizedSearch);

      const matchesCategory = categoryFilter === "all" || categoryName === categoryFilter;
      const matchesPrice = priceMatcher(finalPrice);
      const matchesStatus = statusFilter === "all" || stockStatus === statusFilter;

      return matchesSearch && matchesCategory && matchesPrice && matchesStatus;
    });
  }, [products, searchTerm, categoryFilter, priceFilter, statusFilter, getStockStatus]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, priceFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  useEffect(() => {
    const validIds = new Set(filteredProducts.map((item) => item._id));
    setSelectedProductIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [filteredProducts]);

  const selectedProducts = useMemo(
    () => filteredProducts.filter((product) => selectedProductIds.includes(product._id)),
    [filteredProducts, selectedProductIds]
  );

  const selectedIdsOnPage = useMemo(
    () => paginatedProducts.map((product) => product._id).filter((id) => selectedProductIds.includes(id)),
    [paginatedProducts, selectedProductIds]
  );

  const isAllOnPageSelected = paginatedProducts.length > 0 && selectedIdsOnPage.length === paginatedProducts.length;

  const toggleProductSelect = (productId) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const toggleSelectAllOnPage = () => {
    const pageIds = paginatedProducts.map((product) => product._id);
    if (pageIds.length === 0) {
      return;
    }

    setSelectedProductIds((prev) => {
      if (isAllOnPageSelected) {
        return prev.filter((id) => !pageIds.includes(id));
      }

      const merged = new Set([...prev, ...pageIds]);
      return Array.from(merged);
    });
  };

  const handleDelete = async () => {
    const bulkIds = productPendingDelete?.ids || [];
    const isBulkDelete = bulkIds.length > 0;

    if (!isBulkDelete && !productPendingDelete?._id) {
      return;
    }

    try {
      setDeleting(true);

      if (isBulkDelete) {
        const results = await Promise.allSettled(
          bulkIds.map((productId) => deleteAdminProduct(auth.token, productId))
        );

        const succeededIds = results
          .map((result, index) => (result.status === "fulfilled" ? bulkIds[index] : null))
          .filter(Boolean);
        const failedCount = bulkIds.length - succeededIds.length;

        if (succeededIds.length > 0) {
          setProducts((prev) => prev.filter((product) => !succeededIds.includes(product._id)));
          setSelectedProductIds((prev) => prev.filter((id) => !succeededIds.includes(id)));
        }

        if (failedCount > 0) {
          setMessage(`Đã xóa ${succeededIds.length} sản phẩm, ${failedCount} sản phẩm thất bại.`);
        } else {
          setMessage(`Đã xóa ${succeededIds.length} sản phẩm thành công.`);
        }
      } else {
        await deleteAdminProduct(auth.token, productPendingDelete._id);
        setProducts((prev) => prev.filter((product) => product._id !== productPendingDelete._id));
        setSelectedProductIds((prev) => prev.filter((id) => id !== productPendingDelete._id));
        setMessage("Xóa sản phẩm thành công.");
      }

      setProductPendingDelete(null);
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể xóa sản phẩm."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="container page-content">
      <section className="hero-card dashboard-surface">
        <div className="dashboard-header-row">
          <div>
            <h2>Quản lý sản phẩm</h2>
            <p className="dashboard-subtitle">Theo dõi kho hàng và giá bán trong một bảng điều khiển tập trung.</p>
          </div>
          <Link to="/admin/products/add" className="primary-link-btn">
            + Thêm sản phẩm
          </Link>
        </div>

        {message && <p className="form-message">{message}</p>}

        <div className="dashboard-metric-grid">
          <article className="metric-card">
            <span>Tổng sản phẩm</span>
            <strong>{products.length}</strong>
          </article>
          <article className="metric-card">
            <span>Còn hàng</span>
            <strong>{products.filter((item) => Number(item.stock || 0) > 10).length}</strong>
          </article>
          <article className="metric-card warning">
            <span>Sắp hết</span>
            <strong>{products.filter((item) => Number(item.stock || 0) > 0 && Number(item.stock || 0) <= 10).length}</strong>
          </article>
          <article className="metric-card danger">
            <span>Hết hàng</span>
            <strong>{products.filter((item) => Number(item.stock || 0) <= 0).length}</strong>
          </article>
        </div>

        <div className="dashboard-filter-bar">
          <div className="filter-control search-control">
            <label htmlFor="product-search">Tìm kiếm</label>
            <input
              id="product-search"
              type="text"
              placeholder="Tên sản phẩm hoặc danh mục..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="filter-control">
            <label htmlFor="product-category">Danh mục</label>
            <select
              id="product-category"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">Tất cả danh mục</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-control">
            <label htmlFor="product-price">Khoảng giá</label>
            <select id="product-price" value={priceFilter} onChange={(event) => setPriceFilter(event.target.value)}>
              <option value="all">Tất cả mức giá</option>
              <option value="under500k">Dưới 500.000 đ</option>
              <option value="from500kTo2m">500.000 đ - 2.000.000 đ</option>
              <option value="over2m">Trên 2.000.000 đ</option>
            </select>
          </div>

          <div className="filter-control">
            <label htmlFor="product-status">Trạng thái kho</label>
            <select id="product-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="in-stock">Còn hàng</option>
              <option value="low-stock">Sắp hết</option>
              <option value="out-stock">Hết hàng</option>
            </select>
          </div>
        </div>

        <div className="bulk-action-bar">
          <p>
            Đã chọn <strong>{selectedProducts.length}</strong> sản phẩm
          </p>
          <div className="bulk-action-buttons">
            <button
              type="button"
              className="danger-btn"
              disabled={selectedProducts.length === 0 || deleting}
              onClick={() =>
                setProductPendingDelete({
                  ids: selectedProducts.map((item) => item._id),
                  name: `${selectedProducts.length} sản phẩm đã chọn`,
                })
              }
            >
              Xóa đã chọn
            </button>
            <button
              type="button"
              className="secondary-btn"
              disabled={selectedProducts.length === 0}
              onClick={() => setSelectedProductIds([])}
            >
              Bỏ chọn
            </button>
          </div>
        </div>

        {loading ? (
          <p>Đang tải danh sách sản phẩm...</p>
        ) : (
          <div className="dashboard-table-card">
            <div className="users-table-wrap">
              <table className="users-table dashboard-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả sản phẩm trong trang"
                        checked={isAllOnPageSelected}
                        onChange={toggleSelectAllOnPage}
                      />
                    </th>
                    <th>Ảnh</th>
                    <th>Sản phẩm</th>
                    <th>Giá & giảm</th>
                    <th>Tồn kho</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map((product) => (
                    <tr key={product._id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Chọn sản phẩm ${product.name}`}
                          checked={selectedProductIds.includes(product._id)}
                          onChange={() => toggleProductSelect(product._id)}
                        />
                      </td>
                      <td>
                        <img src={product.imageUrl} alt={product.name} className="admin-product-thumb" />
                      </td>
                      <td>
                        <div className="cell-title truncate-text" title={product.name}>
                          {product.name}
                        </div>
                        <div className="cell-subtext truncate-text" title={product.category || "Chưa phân loại"}>
                          {product.category || "Chưa phân loại"}
                        </div>
                      </td>
                      <td>
                        <div className="price-stack">
                          <span className="pill final-price-pill">
                            {Number(product.finalPrice ?? product.price).toLocaleString("vi-VN")} đ
                          </span>
                          <span className="cell-subtext truncate-text" title={`Giá gốc: ${Number(product.price).toLocaleString("vi-VN")} đ`}>
                            Giá gốc: {Number(product.price).toLocaleString("vi-VN")} đ
                          </span>
                          <span className="cell-subtext">Giảm: {product.discountPercent ?? 0}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`pill stock-pill ${getStockStatus(product.stock)}`}>
                          {product.stock ?? 0} - {getStockStatusLabel(product.stock)}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <Link to={`/admin/products/edit/${product._id}`} className="table-link-btn">
                            <span aria-hidden="true">✎</span> Sửa
                          </Link>
                          <button
                            type="button"
                            className="danger-btn"
                            onClick={() => setProductPendingDelete(product)}
                          >
                            <span aria-hidden="true">🗑</span> Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedProducts.length === 0 && (
                    <tr>
                      <td colSpan="6" className="table-empty-cell">
                        Không tìm thấy sản phẩm phù hợp bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="dashboard-pagination">
              <p>
                Hiển thị <strong>{paginatedProducts.length}</strong> / {filteredProducts.length} sản phẩm
              </p>
              <div className="pagination-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  Trước
                </button>
                <span className="page-indicator">
                  Trang {currentPage}/{totalPages}
                </span>
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Sau
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {productPendingDelete && (
        <div className="confirm-modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h3 id="delete-title">Xác nhận xóa sản phẩm</h3>
            <p>
              Bạn có chắc chắn muốn xóa <strong>{productPendingDelete.name}</strong>?
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
