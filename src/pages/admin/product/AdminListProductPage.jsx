import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { useAuth } from "../../../context/AuthContext";
import { useNotification } from "../../../context/NotificationContext";
import { getAdminCategories } from "../../../services/admin/categoryService";
import { deleteAdminProduct, getAdminProducts } from "../../../services/admin/productService";
import { getErrorMessage } from "../../../utils/adminErrorUtils";
import "../../../css/admin/products.css";

const ITEMS_PER_PAGE = 8;
const IMPORT_TEMPLATE_COLUMNS = [
  "name",
  "category_path",
  "price",
  "stock",
  "discount_percent",
  "description",
  "image_url",
];
const IMPORT_TEMPLATE_FILE_NAME = "product_import_export.xlsx";

function getProductImageSrc(product) {
  const rawValue = String(product?.image || product?.imageUrl || "").trim();
  if (!rawValue) {
    return "/placeholder.svg";
  }

  if (
    rawValue.startsWith("http://") ||
    rawValue.startsWith("https://") ||
    rawValue.startsWith("data:image/") ||
    rawValue.startsWith("/")
  ) {
    return rawValue;
  }

  return `/${rawValue.replace(/^\/+/, "")}`;
}

function normalizeCategoryValue(value) {
  return String(value || "")
    .split(">")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join(" > ");
}

function AdminListProductPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { auth } = useAuth();
  const { success, warning, error: notifyError } = useNotification();
  const hasInitializedFilters = useRef(false);
  const consumedSuccessStateRef = useRef(new Set());

  const initialPage = useMemo(() => {
    const parsed = Number(searchParams.get("page") || 1);
    if (Number.isNaN(parsed) || parsed < 1) {
      return 1;
    }
    return Math.floor(parsed);
  }, [searchParams]);

  const [products, setProducts] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [productPendingDelete, setProductPendingDelete] = useState(null);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [categoryLevel1, setCategoryLevel1] = useState(searchParams.get("cat1") || "all");
  const [categoryLevel2, setCategoryLevel2] = useState(searchParams.get("cat2") || "all");
  const [categoryLevel3, setCategoryLevel3] = useState(searchParams.get("cat3") || "all");
  const [priceSort, setPriceSort] = useState(searchParams.get("priceSort") || "default");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [currentPage, setCurrentPage] = useState(initialPage);

  useEffect(() => {
    const successMessage = location.state?.successMessage;
    if (!successMessage) {
      return;
    }

    const stateKey = `${location.key || "no-key"}::${successMessage}`;
    if (consumedSuccessStateRef.current.has(stateKey)) {
      return;
    }

    consumedSuccessStateRef.current.add(stateKey);
    success(successMessage, { title: "Sản phẩm" });
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.key, location.pathname, location.state, navigate, success]);

  const loadProducts = useCallback(async () => {
    if (!auth?.token) {
      return;
    }

    try {
      setLoading(true);
      const data = await getAdminProducts(auth.token);
      setProducts(data.products || []);
    } catch (error) {
      notifyError(getErrorMessage(error, "Không thể tải danh sách sản phẩm."), { title: "Sản phẩm" });
    } finally {
      setLoading(false);
    }
  }, [auth?.token, notifyError]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const loadCategories = useCallback(async () => {
    if (!auth?.token) {
      return;
    }

    try {
      const data = await getAdminCategories(auth.token);
      setAllCategories(data.categories || []);
    } catch (error) {
      notifyError(getErrorMessage(error, "Không thể tải danh mục."), { title: "Sản phẩm" });
    }
  }, [auth?.token, notifyError]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const categoriesById = useMemo(() => {
    const map = new Map();
    allCategories.forEach((item) => {
      map.set(String(item._id), item);
    });
    return map;
  }, [allCategories]);

  const childrenByParentId = useMemo(() => {
    const map = new Map();

    allCategories.forEach((item) => {
      const parentKey = item.parentId ? String(item.parentId) : "root";
      const list = map.get(parentKey) || [];
      list.push(item);
      map.set(parentKey, list);
    });

    const sortedMap = new Map();
    map.forEach((list, key) => {
      const sorted = [...list].sort((a, b) => (a.name || "").localeCompare(b.name || "", "vi", { sensitivity: "base" }));
      sortedMap.set(key, sorted);
    });

    return sortedMap;
  }, [allCategories]);

  const level1Options = useMemo(() => childrenByParentId.get("root") || [], [childrenByParentId]);

  const level2Options = useMemo(() => {
    if (categoryLevel1 === "all") {
      return [];
    }
    return childrenByParentId.get(String(categoryLevel1)) || [];
  }, [childrenByParentId, categoryLevel1]);

  const level3Options = useMemo(() => {
    if (categoryLevel2 === "all") {
      return [];
    }
    return childrenByParentId.get(String(categoryLevel2)) || [];
  }, [childrenByParentId, categoryLevel2]);

  const selectedCategoryId =
    categoryLevel3 !== "all"
      ? categoryLevel3
      : categoryLevel2 !== "all"
        ? categoryLevel2
        : categoryLevel1 !== "all"
          ? categoryLevel1
          : null;

  const selectedCategoryMatchers = useMemo(() => {
    if (!selectedCategoryId) {
      return null;
    }

    if (categoriesById.size === 0) {
      return null;
    }

    const collectedNames = new Set();
    const collectedPaths = new Set();
    const queue = [String(selectedCategoryId)];
    const visited = new Set();

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);
      const category = categoriesById.get(currentId);
      if (category?.name) {
        collectedNames.add(normalizeCategoryValue(category.name));

        const pathParts = [category.name];
        let cursor = category;
        const parentVisited = new Set();

        while (cursor?.parentId) {
          const parentId = String(cursor.parentId);
          if (parentVisited.has(parentId)) {
            break;
          }

          parentVisited.add(parentId);
          const parent = categoriesById.get(parentId);
          if (!parent) {
            break;
          }

          pathParts.unshift(parent.name);
          cursor = parent;
        }

        collectedPaths.add(normalizeCategoryValue(pathParts.join(" > ")));
      }

      const children = childrenByParentId.get(currentId) || [];
      children.forEach((child) => queue.push(String(child._id)));
    }

    return {
      names: collectedNames,
      paths: collectedPaths,
    };
  }, [selectedCategoryId, categoriesById, childrenByParentId]);

  useEffect(() => {
    if (categoryLevel1 === "all" && (categoryLevel2 !== "all" || categoryLevel3 !== "all")) {
      setCategoryLevel2("all");
      setCategoryLevel3("all");
      return;
    }

    if (categoryLevel2 === "all" && categoryLevel3 !== "all") {
      setCategoryLevel3("all");
    }
  }, [categoryLevel1, categoryLevel2, categoryLevel3]);

  useEffect(() => {
    if (categoryLevel1 !== "all" && !level1Options.some((item) => String(item._id) === String(categoryLevel1))) {
      setCategoryLevel1("all");
      setCategoryLevel2("all");
      setCategoryLevel3("all");
      return;
    }

    if (categoryLevel2 !== "all" && !level2Options.some((item) => String(item._id) === String(categoryLevel2))) {
      setCategoryLevel2("all");
      setCategoryLevel3("all");
      return;
    }

    if (categoryLevel3 !== "all" && !level3Options.some((item) => String(item._id) === String(categoryLevel3))) {
      setCategoryLevel3("all");
    }
  }, [categoryLevel1, categoryLevel2, categoryLevel3, level1Options, level2Options, level3Options]);

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

    const result = products.filter((product) => {
      const categoryName = product.category || "Chưa phân loại";
      const stockStatus = getStockStatus(product.stock);
      const normalizedCategory = normalizeCategoryValue(categoryName);

      const matchesSearch =
        !normalizedSearch ||
        (product.name || "").toLowerCase().includes(normalizedSearch) ||
        categoryName.toLowerCase().includes(normalizedSearch);

      const matchesCategory =
        !selectedCategoryMatchers ||
        selectedCategoryMatchers.paths.has(normalizedCategory) ||
        selectedCategoryMatchers.names.has(normalizedCategory);
      const matchesStatus = statusFilter === "all" || stockStatus === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });

    if (priceSort === "asc") {
      result.sort((a, b) => Number(a.finalPrice ?? a.price ?? 0) - Number(b.finalPrice ?? b.price ?? 0));
    } else if (priceSort === "desc") {
      result.sort((a, b) => Number(b.finalPrice ?? b.price ?? 0) - Number(a.finalPrice ?? a.price ?? 0));
    }

    return result;
  }, [products, searchTerm, selectedCategoryMatchers, statusFilter, getStockStatus, priceSort]);

  useEffect(() => {
    if (!hasInitializedFilters.current) {
      hasInitializedFilters.current = true;
      return;
    }

    setCurrentPage(1);
  }, [searchTerm, categoryLevel1, categoryLevel2, categoryLevel3, statusFilter, priceSort]);

  useEffect(() => {
    const nextParams = new URLSearchParams();

    if (searchTerm.trim()) {
      nextParams.set("q", searchTerm.trim());
    }

    if (categoryLevel1 !== "all") {
      nextParams.set("cat1", categoryLevel1);
    }

    if (categoryLevel2 !== "all") {
      nextParams.set("cat2", categoryLevel2);
    }

    if (categoryLevel3 !== "all") {
      nextParams.set("cat3", categoryLevel3);
    }

    if (priceSort !== "default") {
      nextParams.set("priceSort", priceSort);
    }

    if (statusFilter !== "all") {
      nextParams.set("status", statusFilter);
    }

    if (currentPage > 1) {
      nextParams.set("page", String(currentPage));
    }

    setSearchParams(nextParams, { replace: true });
  }, [
    searchTerm,
    categoryLevel1,
    categoryLevel2,
    categoryLevel3,
    priceSort,
    statusFilter,
    currentPage,
    setSearchParams,
  ]);

  const handleCategoryLevel1Change = (nextValue) => {
    setCategoryLevel1(nextValue);
    setCategoryLevel2("all");
    setCategoryLevel3("all");
  };

  const handleCategoryLevel2Change = (nextValue) => {
    setCategoryLevel2(nextValue);
    setCategoryLevel3("all");
  };

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
          warning(`Đã xóa ${succeededIds.length} sản phẩm, ${failedCount} sản phẩm thất bại.`, {
            title: "Sản phẩm",
          });
        } else {
          success(`Đã xóa ${succeededIds.length} sản phẩm thành công.`, { title: "Sản phẩm" });
        }
      } else {
        await deleteAdminProduct(auth.token, productPendingDelete._id);
        setProducts((prev) => prev.filter((product) => product._id !== productPendingDelete._id));
        setSelectedProductIds((prev) => prev.filter((id) => id !== productPendingDelete._id));
        success("Xóa sản phẩm thành công.", { title: "Sản phẩm" });
      }

      setProductPendingDelete(null);
    } catch (error) {
      notifyError(getErrorMessage(error, "Không thể xóa sản phẩm."), { title: "Sản phẩm" });
    } finally {
      setDeleting(false);
    }
  };

  const totalProducts = products.length;
  const inStockCount = products.filter((item) => Number(item.stock || 0) > 10).length;
  const lowStockCount = products.filter(
    (item) => Number(item.stock || 0) > 0 && Number(item.stock || 0) <= 10
  ).length;
  const outStockCount = products.filter((item) => Number(item.stock || 0) <= 0).length;

  const percent = (value) => {
    if (!totalProducts) {
      return "0%";
    }
    return `${Math.round((value / totalProducts) * 100)}%`;
  };

  const handleExportTemplate = () => {
    const exportRows = filteredProducts.length > 0 ? filteredProducts : products;
    if (exportRows.length === 0) {
      warning("Không có sản phẩm để xuất.", { title: "Sản phẩm" });
      return;
    }

    const worksheetData = [
      IMPORT_TEMPLATE_COLUMNS,
      ...exportRows.map((product) => [
        product.name || "",
        product.category || "",
        Number(product.price ?? 0),
        Number(product.stock ?? 0),
        Number(product.discountPercent ?? 0),
        product.description || "",
        product.image || product.imageUrl || "",
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ProductsTemplate");
    XLSX.writeFile(workbook, IMPORT_TEMPLATE_FILE_NAME);
    success("Đã xuất file theo template import.", { title: "Sản phẩm" });
  };

  return (
    <main className="container page-content admin-products-page">
      <section className="hero-card dashboard-surface admin-page-enter" aria-busy={loading}>
        <div className="dashboard-header-row">
          <div>
            <h2>Quản lý sản phẩm</h2>
            <p className="dashboard-subtitle">Theo dõi kho hàng và giá bán trong một bảng điều khiển tập trung.</p>
          </div>
          <div className="bulk-action-buttons">
            <Link to="/admin/products/import" className="secondary-btn">
              Nhập danh sách sản phẩm
            </Link>
            <button type="button" className="secondary-btn" onClick={handleExportTemplate}>
              Xuất danh sách sản phẩm
            </button>
            <Link to="/admin/products/add" className="primary-link-btn">
              + Thêm sản phẩm
            </Link>
          </div>
        </div>

        <div className="dashboard-metric-grid">
          <article className="metric-card">
            <span>Tổng sản phẩm</span>
            <strong>{totalProducts}</strong>
            <small className="metric-note">Toàn bộ sản phẩm trong kho</small>
          </article>
          <article className="metric-card success">
            <span>Còn hàng</span>
            <strong>{inStockCount}</strong>
            <small className="metric-note">Chiếm {percent(inStockCount)}</small>
          </article>
          <article className="metric-card warning">
            <span>Sắp hết</span>
            <strong>{lowStockCount}</strong>
            <small className="metric-note">Chiếm {percent(lowStockCount)}</small>
          </article>
          <article className="metric-card danger">
            <span>Hết hàng</span>
            <strong>{outStockCount}</strong>
            <small className="metric-note">Chiếm {percent(outStockCount)}</small>
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
            <label htmlFor="product-category-level-1">Danh mục cấp 1</label>
            <select
              id="product-category-level-1"
              value={categoryLevel1}
              onChange={(event) => handleCategoryLevel1Change(event.target.value)}
            >
              <option value="all">Tất cả cấp 1</option>
              {level1Options.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {categoryLevel1 !== "all" && (
            <div className="filter-control">
              <label htmlFor="product-category-level-2">Danh mục cấp 2</label>
              <select
                id="product-category-level-2"
                value={categoryLevel2}
                onChange={(event) => handleCategoryLevel2Change(event.target.value)}
              >
                <option value="all">Tất cả cấp 2</option>
                {level2Options.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {categoryLevel2 !== "all" && (
            <div className="filter-control">
              <label htmlFor="product-category-level-3">Danh mục cấp 3</label>
              <select
                id="product-category-level-3"
                value={categoryLevel3}
                onChange={(event) => setCategoryLevel3(event.target.value)}
              >
                <option value="all">Tất cả cấp 3</option>
                {level3Options.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="filter-control">
            <label htmlFor="product-price-sort">Sắp xếp giá</label>
            <select
              id="product-price-sort"
              value={priceSort}
              onChange={(event) => setPriceSort(event.target.value)}
            >
              <option value="default">Mặc định</option>
              <option value="asc">Giá thấp đến cao</option>
              <option value="desc">Giá cao đến thấp</option>
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
          <>
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
                          <Link to={`/products/${product._id}`} className="product-detail-link" title={`Xem chi tiết ${product.name}`}>
                            <img
                              src={getProductImageSrc(product)}
                              alt={product.name}
                              className="admin-product-thumb"
                              onError={(event) => {
                                event.currentTarget.onerror = null;
                                event.currentTarget.src = "/placeholder.svg";
                              }}
                            />
                          </Link>
                        </td>
                        <td>
                          <Link
                            to={`/products/${product._id}`}
                            className="cell-title truncate-text product-detail-link"
                            title={product.name}
                          >
                            {product.name}
                          </Link>
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
            </div>

            <div className="dashboard-pagination">
              <p>
                Hiển thị <strong>{paginatedProducts.length}</strong> / {filteredProducts.length} sản phẩm
              </p>
              <div className="pagination-actions">
                <button
                  type="button"
                  className="secondary-btn pager-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  ← Trước
                </button>
                <span className="page-indicator">
                  Trang {currentPage}/{totalPages}
                </span>
                <button
                  type="button"
                  className="secondary-btn pager-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Sau →
                </button>
              </div>
            </div>
          </>
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
