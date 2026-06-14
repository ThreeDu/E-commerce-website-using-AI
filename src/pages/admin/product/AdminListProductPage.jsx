import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { useAuth } from "../../../context/AuthContext";
import { useNotification } from "../../../context/NotificationContext";
import { getAdminCategories } from "../../../services/admin/categoryService";
import { deleteAdminProduct, getAdminProducts } from "../../../services/admin/productService";
import { getErrorMessage } from "../../../utils/adminErrorUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faPen,
  faTrash,
  faChevronLeft,
  faChevronRight,
  faFileImport,
  faFileExport,
  faBoxArchive,
  faRotateLeft,
} from "@fortawesome/free-solid-svg-icons";
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
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
      <section className="bg-white border border-admin-line rounded-[18px] p-6 shadow-[0_12px_32px_rgba(15,23,42,0.08)] animate-admin-rise" aria-busy={loading}>
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-start gap-4 mb-3.5">
          <div>
            <h2 className="text-[1.55rem] font-bold tracking-wide text-[#13263a] m-0">
              <FontAwesomeIcon icon={faBoxArchive} style={{ marginRight: "10px", color: "var(--color-admin-primary, #0f766e)" }} />
              Quản lý sản phẩm
            </h2>
            <p className="mt-1.5 mb-0 text-[#5d6b82] text-sm">Theo dõi kho hàng và giá bán trong một bảng điều khiển tập trung.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/products/import" className="inline-flex items-center gap-1.5 border border-[#d0d9e4] rounded-lg p-[8px_12px] cursor-pointer bg-[#e8edf3] text-[#0f2233] font-semibold text-sm hover:-translate-y-px transition-all duration-150">
              <FontAwesomeIcon icon={faFileImport} />
              Nhập sản phẩm
            </Link>
            <button type="button" className="inline-flex items-center gap-1.5 border border-[#d0d9e4] rounded-lg p-[8px_12px] cursor-pointer bg-[#e8edf3] text-[#0f2233] font-semibold text-sm hover:-translate-y-px transition-all duration-150" onClick={handleExportTemplate}>
              <FontAwesomeIcon icon={faFileExport} />
              Xuất sản phẩm
            </button>
            <Link to="/admin/products/add" className="inline-block no-underline bg-gradient-to-br from-[#10375c] to-[#1c5d96] text-white p-[10px_14px] rounded-xl font-semibold shadow-[0_8px_18px_rgba(16,55,92,0.22)] cursor-pointer hover:-translate-y-px transition-all duration-150" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <FontAwesomeIcon icon={faPlus} />
              Thêm sản phẩm
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 my-[6px_10px] items-stretch">
          <article className="bg-white border border-[#13263a]/12 rounded-[9px] p-[7px_10px] min-h-[58px] h-full flex flex-col justify-center items-start gap-0.5 shadow-xs">
            <span className="text-[#7b8797] text-[10px] font-semibold leading-none ml-0.75">Tổng sản phẩm</span>
            <strong className="text-lg font-bold leading-none ml-0.75 text-[#0f2233]">{totalProducts}</strong>
            <small className="text-[#a3afbf] text-[9px] leading-[1.1] ml-0.75">Toàn bộ sản phẩm trong kho</small>
          </article>
          <article className="bg-white border border-[#13263a]/12 rounded-[9px] p-[7px_10px] min-h-[58px] h-full flex flex-col justify-center items-start gap-0.5 shadow-xs">
            <span className="text-[#7b8797] text-[10px] font-semibold leading-none ml-0.75">Còn hàng</span>
            <strong className="text-lg font-bold leading-none ml-0.75 text-[#166534]">{inStockCount}</strong>
            <small className="text-[#a3afbf] text-[9px] leading-[1.1] ml-0.75">Chiếm {percent(inStockCount)}</small>
          </article>
          <article className="bg-white border border-[#13263a]/12 rounded-[9px] p-[7px_10px] min-h-[58px] h-full flex flex-col justify-center items-start gap-0.5 shadow-xs">
            <span className="text-[#7b8797] text-[10px] font-semibold leading-none ml-0.75">Sắp hết</span>
            <strong className="text-lg font-bold leading-none ml-0.75 text-[#b45309]">{lowStockCount}</strong>
            <small className="text-[#a3afbf] text-[9px] leading-[1.1] ml-0.75">Chiếm {percent(lowStockCount)}</small>
          </article>
          <article className="bg-white border border-[#13263a]/12 rounded-[9px] p-[7px_10px] min-h-[58px] h-full flex flex-col justify-center items-start gap-0.5 shadow-xs">
            <span className="text-[#7b8797] text-[10px] font-semibold leading-none ml-0.75">Hết hàng</span>
            <strong className="text-lg font-bold leading-none ml-0.75 text-[#b42318]">{outStockCount}</strong>
            <small className="text-[#a3afbf] text-[9px] leading-[1.1] ml-0.75">Chiếm {percent(outStockCount)}</small>
          </article>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3.5 mb-5.5 items-end">
          <div className="grid gap-2 min-w-0 col-span-1 sm:col-span-2">
            <label htmlFor="product-search" className="text-[12px] uppercase tracking-wider text-[#6b7a8d] font-bold block mb-1">Tìm kiếm</label>
            <input
              id="product-search"
              type="text"
              placeholder="Tên sản phẩm hoặc danh mục..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-[42px] rounded-xl border border-[#d7e1ed] px-3.25 bg-white w-full text-sm focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
            />
          </div>

          <div className="grid gap-2 min-w-0">
            <label htmlFor="product-category-level-1" className="text-[12px] uppercase tracking-wider text-[#6b7a8d] font-bold block mb-1">Danh mục cấp 1</label>
            <select
              id="product-category-level-1"
              value={categoryLevel1}
              onChange={(event) => handleCategoryLevel1Change(event.target.value)}
              className="h-[42px] rounded-xl border border-[#d7e1ed] px-3.25 bg-white w-full text-sm focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
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
            <div className="grid gap-2 min-w-0">
              <label htmlFor="product-category-level-2" className="text-[12px] uppercase tracking-wider text-[#6b7a8d] font-bold block mb-1">Danh mục cấp 2</label>
              <select
                id="product-category-level-2"
                value={categoryLevel2}
                onChange={(event) => handleCategoryLevel2Change(event.target.value)}
                className="h-[42px] rounded-xl border border-[#d7e1ed] px-3.25 bg-white w-full text-sm focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
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
            <div className="grid gap-2 min-w-0">
              <label htmlFor="product-category-level-3" className="text-[12px] uppercase tracking-wider text-[#6b7a8d] font-bold block mb-1">Danh mục cấp 3</label>
              <select
                id="product-category-level-3"
                value={categoryLevel3}
                onChange={(event) => setCategoryLevel3(event.target.value)}
                className="h-[42px] rounded-xl border border-[#d7e1ed] px-3.25 bg-white w-full text-sm focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
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

          <div className="grid gap-2 min-w-0">
            <label htmlFor="product-price-sort" className="text-[12px] uppercase tracking-wider text-[#6b7a8d] font-bold block mb-1">Sắp xếp giá</label>
            <select
              id="product-price-sort"
              value={priceSort}
              onChange={(event) => setPriceSort(event.target.value)}
              className="h-[42px] rounded-xl border border-[#d7e1ed] px-3.25 bg-white w-full text-sm focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
            >
              <option value="default">Mặc định</option>
              <option value="asc">Giá thấp đến cao</option>
              <option value="desc">Giá cao đến thấp</option>
            </select>
          </div>

          <div className="grid gap-2 min-w-0">
            <label htmlFor="product-status" className="text-[12px] uppercase tracking-wider text-[#6b7a8d] font-bold block mb-1">Trạng thái kho</label>
            <select
              id="product-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-[42px] rounded-xl border border-[#d7e1ed] px-3.25 bg-white w-full text-sm focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="in-stock">Còn hàng</option>
              <option value="low-stock">Sắp hết</option>
              <option value="out-stock">Hết hàng</option>
            </select>
          </div>
        </div>

        <div className="my-[8px_14px] flex flex-col md:flex-row justify-between items-start md:items-center gap-2.5 p-[10px_12px] rounded-xl border border-[#dbe6f3] bg-[#f8fbff]">
          <p className="m-0 text-[#4f6078] text-sm">
            Đã chọn <strong>{selectedProducts.length}</strong> sản phẩm
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="border border-[#df6b6b] rounded-lg p-[8px_12px] cursor-pointer bg-[#fff7f7] text-[#b42318] font-semibold text-sm hover:-translate-y-px transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              disabled={selectedProducts.length === 0 || deleting}
              onClick={() =>
                setProductPendingDelete({
                  ids: selectedProducts.map((item) => item._id),
                  name: `${selectedProducts.length} sản phẩm đã chọn`,
                })
              }
            >
              <FontAwesomeIcon icon={faTrash} />
              Xóa đã chọn
            </button>
            <button
              type="button"
              className="border border-[#d0d9e4] rounded-lg p-[8px_12px] cursor-pointer bg-[#e8edf3] text-[#0f2233] font-semibold text-sm hover:-translate-y-px transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              disabled={selectedProducts.length === 0}
              onClick={() => setSelectedProductIds([])}
            >
              <FontAwesomeIcon icon={faRotateLeft} />
              Bỏ chọn
            </button>
          </div>
        </div>

        {loading ? (
          <p>Đang tải danh sách sản phẩm...</p>
        ) : (
          <>
            <div className="border border-[#e2eaf4] rounded-2xl overflow-hidden bg-white w-full max-w-full">
              <div className="w-full max-w-full overflow-x-auto bg-white">
                <table className="w-full table-fixed min-w-0 text-[13px] border-collapse bg-white">
                  <thead>
                    <tr>
                      <th className="w-[5%] text-center bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle">
                        <input
                          type="checkbox"
                          aria-label="Chọn tất cả sản phẩm trong trang"
                          checked={isAllOnPageSelected}
                          onChange={toggleSelectAllOnPage}
                        />
                      </th>
                      <th className="w-[10%] text-center bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle">Ảnh</th>
                      <th className="w-[35%] text-left bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle">Sản phẩm</th>
                      <th className="w-[20%] text-left bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle">Giá & giảm</th>
                      <th className="w-[14%] text-left bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle">Tồn kho</th>
                      <th className="w-[16%] text-left bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProducts.map((product) => {
                      const stockStatus = getStockStatus(product.stock);
                      const stockClass = stockStatus === "in-stock"
                        ? "text-[#166534] bg-[#e7f9ef]"
                        : stockStatus === "low-stock"
                          ? "text-[#b45309] bg-[#fff3dd]"
                          : "text-[#b42318] bg-[#ffe8e8]";
                      return (
                        <tr key={product._id} className="transition-colors duration-180 hover:bg-[#f8fbff]">
                          <td className="text-center p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8]">
                            <input
                              type="checkbox"
                              aria-label={`Chọn sản phẩm ${product.name}`}
                              checked={selectedProductIds.includes(product._id)}
                              onChange={() => toggleProductSelect(product._id)}
                            />
                          </td>
                          <td className="text-center p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8]">
                            <Link to={`/products/${product._id}`} className="no-underline" title={`Xem chi tiết ${product.name}`}>
                              <img
                                src={getProductImageSrc(product)}
                                alt={product.name}
                                className="w-11 h-11 object-cover rounded-lg border border-[#d6dfeb]"
                                onError={(event) => {
                                  event.currentTarget.onerror = null;
                                  event.currentTarget.src = "/placeholder.svg";
                                }}
                              />
                            </Link>
                          </td>
                          <td className="text-left p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8]">
                            <Link
                              to={`/products/${product._id}`}
                              className="font-bold text-[#0f2233] block whitespace-normal overflow-visible break-words hover:text-blue-700 no-underline"
                              title={product.name}
                            >
                              {product.name}
                            </Link>
                            <div className="mt-1 text-[#62728a] text-[13px] block whitespace-normal overflow-visible break-words" title={product.category || "Chưa phân loại"}>
                              {product.category || "Chưa phân loại"}
                            </div>
                          </td>
                          <td className="text-left p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8]">
                            <div className="grid gap-1 min-w-0">
                              <span className="inline-flex items-center rounded-full p-[3px_6px] font-bold text-[11px] text-[#166534] bg-[#e7f9ef]">
                                {Number(product.finalPrice ?? product.price).toLocaleString("vi-VN")} đ
                              </span>
                              <span className="mt-1 text-[#62728a] text-[13px] block whitespace-normal overflow-visible break-words" title={`Giá gốc: ${Number(product.price).toLocaleString("vi-VN")} đ`}>
                                Giá gốc: {Number(product.price).toLocaleString("vi-VN")} đ
                              </span>
                              <span className="mt-1 text-[#62728a] text-[13px]">Giảm: {product.discountPercent ?? 0}%</span>
                            </div>
                          </td>
                          <td className="text-left p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8]">
                            <span className={`inline-flex items-center rounded-full p-[3px_6px] font-bold text-[11px] ${stockClass}`}>
                              {product.stock ?? 0} - {getStockStatusLabel(product.stock)}
                            </span>
                          </td>
                          <td className="text-left p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8]">
                            <div className="flex gap-1 justify-start items-center flex-nowrap w-full">
                              <Link
                                to={`/admin/products/edit/${product._id}`}
                                className="p-[5px_8px] text-[11px] gap-0.75 whitespace-nowrap shrink-0 rounded-md inline-flex items-center border border-[#b5ccf0] bg-[#f6f9ff] text-[#0f3f84] font-semibold cursor-pointer"
                                title="Chỉnh sửa sản phẩm"
                              >
                                <FontAwesomeIcon icon={faPen} />
                                Sửa
                              </Link>
                              <button
                                type="button"
                                className="p-[5px_8px] text-[11px] gap-0.75 whitespace-nowrap shrink-0 rounded-md inline-flex items-center border border-[#df6b6b] bg-[#fff7f7] text-[#b42318] font-semibold cursor-pointer"
                                onClick={() => setProductPendingDelete(product)}
                                title="Xóa sản phẩm"
                              >
                                <FontAwesomeIcon icon={faTrash} />
                                Xóa
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {paginatedProducts.length === 0 && (
                      <tr>
                        <td colSpan="6" className="text-center text-[#657589] p-6">
                          Không tìm thấy sản phẩm phù hợp bộ lọc.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-3.5 border-t border-[#edf2f8] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <p className="m-0 text-[#62728a] text-sm">
                Hiển thị <strong>{paginatedProducts.length}</strong> / {filteredProducts.length} sản phẩm
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center min-h-[34px] min-w-[92px] px-3.5 py-1.75 rounded-xl border border-[#cdd9e8] bg-[#f9fbfe] text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] hover:text-[#3f4f67] hover:shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                  Trước
                </button>
                <span className="min-w-[100px] text-center text-[#4b5b73] font-semibold text-sm">
                  Trang {currentPage}/{totalPages}
                </span>
                <button
                  type="button"
                  className="inline-flex items-center justify-center min-h-[34px] min-w-[92px] px-3.5 py-1.75 rounded-xl border border-[#cdd9e8] bg-[#f9fbfe] text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] hover:text-[#3f4f67] hover:shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Sau
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {productPendingDelete && (
        <div className="fixed inset-0 bg-[#09111b]/50 flex items-center justify-center z-[999] p-4" role="presentation">
          <div className="w-full max-w-[460px] bg-white rounded-xl p-4.5 shadow-[0_18px_36px_rgba(13,29,44,0.22)]" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h3 id="delete-title" className="m-0 mb-2 font-bold text-lg text-[#0f2233]">Xác nhận xóa sản phẩm</h3>
            <p className="m-0 mb-3.5 text-[#6c7d90] text-sm">
              Bạn có chắc chắn muốn xóa <strong>{productPendingDelete.name}</strong>?
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                className="p-[10px_14px] rounded-lg border border-[#d0d9e4] bg-[#e8edf3] text-[#0f2233] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                onClick={() => setProductPendingDelete(null)}
                disabled={deleting}
              >
                Hủy
              </button>
              <button type="button" className="p-[10px_14px] rounded-lg border border-[#b42318] bg-[#b42318] text-white font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm" onClick={handleDelete} disabled={deleting}>
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
