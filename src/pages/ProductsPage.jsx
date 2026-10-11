import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { trackEvent } from "../services/analyticsService";
import { getProductImageSrc, getProductPricing, isOutOfStock } from "../utils/productUtils";
import { fetchProducts } from "../services/productService";
import { fetchCategories } from "../services/categoryService";
import { fetchWishlist, addToWishlist, removeFromWishlist } from "../services/wishlistService";


function normalizeCategoryId(value) {
  return String(value || "").trim();
}

function ProductsPage() {
  const { addToCart } = useCart();
  const { auth } = useAuth();
  const { success, error: notifyError, warning } = useNotification();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryLevel1, setCategoryLevel1] = useState("all");
  const [categoryLevel2, setCategoryLevel2] = useState("all");
  const [categoryLevel3, setCategoryLevel3] = useState("all");
  const [sortBy, setSortBy] = useState("best-selling");
  const [maxPrice, setMaxPrice] = useState(100000000); // Mức giá đang chọn (mặc định để rất lớn)
  const [maxPossiblePrice, setMaxPossiblePrice] = useState(100000000); // Mức giá lớn nhất có trong data
  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [pendingWishlistIds, setPendingWishlistIds] = useState([]);
  const [categories, setCategories] = useState([{ _id: "all", name: "Tất cả", path: "Tất cả" }]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingEllipsis, setEditingEllipsis] = useState(null); // 'left' or 'right' or null
  const [inputPageValue, setInputPageValue] = useState("");
  const ITEMS_PER_PAGE = 12;

  const productNameById = useMemo(
    () => new Map(allProducts.map((item) => [String(item._id), String(item.name || "sản phẩm")])),
    [allProducts]
  );

  useEffect(() => {
    const loadWishlist = async () => {
      if (!auth?.token) {
        setWishlistIds([]);
        return;
      }

      try {
        const data = await fetchWishlist(auth.token);
        const ids = Array.isArray(data?.wishlist)
          ? data.wishlist.map((item) => String(item._id))
          : [];
        setWishlistIds(ids);
      } catch (error) {
        setWishlistIds([]);
      }
    };

    loadWishlist();
  }, [auth?.token]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Gọi API lấy danh sách sản phẩm
        const data = await fetchProducts();
        setAllProducts(data);
        
        // Tự động tìm giá lớn nhất trong database để làm mốc cho thanh kéo
        if (data.length > 0) {
          const highestPrice = Math.max(...data.map(item => item.price));
          setMaxPossiblePrice(highestPrice);
          setMaxPrice(highestPrice); // Mặc định thanh kéo sẽ nằm ở mức cao nhất
        }

        // 2. Gọi API lấy danh sách danh mục
        const catData = await fetchCategories();
        const categoryMap = new Map();
        catData.forEach((cat) => {
          categoryMap.set(String(cat._id), cat);
        });

        const buildPath = (category) => {
          const path = [category.name];
          let cursor = category;
          const visited = new Set();

          while (cursor?.parentId) {
            const parentId = String(cursor.parentId);
            if (visited.has(parentId)) {
              break;
            }
            visited.add(parentId);

            const parent = categoryMap.get(parentId);
            if (!parent) {
              break;
            }

            path.unshift(parent.name);
            cursor = parent;
          }

          return path.join(" > ");
        };

        const normalizedCategories = catData
          .map((cat) => ({ ...cat, path: buildPath(cat) }))
          .sort((a, b) => a.path.localeCompare(b.path, "vi", { sensitivity: "base" }));

        setCategories([{ _id: "all", name: "Tất cả", path: "Tất cả" }, ...normalizedCategories]);
      } catch (error) {
        console.error("Lỗi tải dữ liệu:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const keyword = new URLSearchParams(location.search).get("keyword");
    if (keyword) {
      setSearchTerm(keyword);
    }
  }, [location.search]);

  const categoryItems = useMemo(
    () => categories.filter((item) => item._id !== "all"),
    [categories]
  );

  const categoryMap = useMemo(
    () => new Map(categoryItems.map((item) => [normalizeCategoryId(item._id), item])),
    [categoryItems]
  );

  const level1Categories = categoryItems.filter((item) => !item.parentId);

  const level2Categories =
    categoryLevel1 === "all"
      ? []
      : categoryItems.filter(
          (item) => normalizeCategoryId(item.parentId) === normalizeCategoryId(categoryLevel1)
        );

  const level3Categories =
    categoryLevel2 === "all"
      ? []
      : categoryItems.filter(
          (item) => normalizeCategoryId(item.parentId) === normalizeCategoryId(categoryLevel2)
        );

  const selectedCategoryId =
    categoryLevel3 !== "all"
      ? categoryLevel3
      : categoryLevel2 !== "all"
        ? categoryLevel2
        : categoryLevel1;

  useEffect(() => {
    if (categories.length <= 1) {
      return;
    }

    const applyCategoryLevels = (targetId) => {
      const normalizedId = normalizeCategoryId(targetId);
      const target = categoryMap.get(normalizedId);
      if (!target) {
        return false;
      }

      const path = [];
      let cursor = target;
      const visited = new Set();

      while (cursor) {
        const cursorId = normalizeCategoryId(cursor._id);
        if (!cursorId || visited.has(cursorId)) {
          break;
        }

        visited.add(cursorId);
        path.unshift(cursor);

        const parentId = normalizeCategoryId(cursor.parentId);
        if (!parentId) {
          break;
        }
        cursor = categoryMap.get(parentId);
      }

      setCategoryLevel1(normalizeCategoryId(path[0]?._id) || "all");
      setCategoryLevel2(normalizeCategoryId(path[1]?._id) || "all");
      setCategoryLevel3(normalizeCategoryId(path[2]?._id) || "all");
      return true;
    };

    const stateCategoryId = location.state?.categoryId;
    if (stateCategoryId) {
      if (applyCategoryLevels(stateCategoryId)) {
        return;
      }
    }

    const stateCategory = String(location.state?.category || "").trim();
    if (!stateCategory) {
      return;
    }

    const matchedByPath = categoryItems.find((item) => item.path === stateCategory);
    if (matchedByPath && applyCategoryLevels(matchedByPath._id)) {
      return;
    }

    const matchedByName = categoryItems.find((item) => item.name === stateCategory);
    if (matchedByName) {
      applyCategoryLevels(matchedByName._id);
    }
  }, [categories, categoryItems, categoryMap, location.state?.category, location.state?.categoryId]);

  const categoriesById = useMemo(
    () => new Map(categoryItems.map((item) => [String(item._id), item])),
    [categoryItems]
  );

  const childrenByParentId = useMemo(() => {
    const map = new Map();
    categoryItems.forEach((item) => {
      const key = item.parentId ? String(item.parentId) : "root";
      const next = map.get(key) || [];
      next.push(item);
      map.set(key, next);
    });
    return map;
  }, [categoryItems]);

  const selectedCategoryScope = useMemo(() => {
    if (selectedCategoryId === "all") {
      return null;
    }

    const root = categoriesById.get(String(selectedCategoryId));
    if (!root) {
      return null;
    }

    const matchedCategories = [];
    const queue = [root];
    const visited = new Set();

    while (queue.length > 0) {
      const current = queue.shift();
      const currentId = String(current._id);
      if (visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);
      matchedCategories.push(current);

      const children = childrenByParentId.get(currentId) || [];
      children.forEach((child) => queue.push(child));
    }

    return {
      ids: new Set(matchedCategories.map((item) => String(item._id))),
      names: new Set(matchedCategories.map((item) => String(item.name || "").trim().toLowerCase())),
      paths: matchedCategories
        .map((item) => String(item.path || "").trim().toLowerCase())
        .filter(Boolean),
    };
  }, [selectedCategoryId, categoriesById, childrenByParentId]);

  useEffect(() => {
    const results = allProducts.filter((product) => {
      const matchSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const productCategory = String(product.category || "").trim().toLowerCase();
      const productCategoryId = String(product.categoryId || product.category_id || "").trim();

      const matchCategory = (() => {
        if (!selectedCategoryScope) {
          return true;
        }

        if (productCategoryId && selectedCategoryScope.ids.has(productCategoryId)) {
          return true;
        }

        if (selectedCategoryScope.ids.has(productCategory)) {
          return true;
        }

        if (selectedCategoryScope.names.has(productCategory)) {
          return true;
        }

        return selectedCategoryScope.paths.some(
          (path) => productCategory === path || productCategory.startsWith(`${path} >`) || path.includes(productCategory) || productCategory.includes(path)
        );
      })();

      const matchPrice = product.price <= maxPrice;
      return matchSearch && matchCategory && matchPrice;
    });

    const sortedResults = [...results].sort((a, b) => {
      if (sortBy === "most-viewed") {
        return Number(b.totalViews || 0) - Number(a.totalViews || 0);
      }

      if (sortBy === "top-rated") {
        const ratingDiff = Number(b.averageRating || 0) - Number(a.averageRating || 0);
        if (ratingDiff !== 0) {
          return ratingDiff;
        }
        return Number(b.totalRatings || 0) - Number(a.totalRatings || 0);
      }

      const soldDiff = Number(b.totalPurchases || 0) - Number(a.totalPurchases || 0);
      if (soldDiff !== 0) {
        return soldDiff;
      }

      return Number(b.totalViews || 0) - Number(a.totalViews || 0);
    });

    setFilteredProducts(sortedResults);
    setCurrentPage(1);
  }, [searchTerm, selectedCategoryScope, maxPrice, allProducts, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push({ type: "page", value: i });
      }
    } else {
      if (validCurrentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push({ type: "page", value: i });
        }
        pages.push({ type: "ellipsis", id: "right" });
        pages.push({ type: "page", value: totalPages });
      } else if (validCurrentPage >= totalPages - 3) {
        pages.push({ type: "page", value: 1 });
        pages.push({ type: "ellipsis", id: "left" });
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push({ type: "page", value: i });
        }
      } else {
        pages.push({ type: "page", value: 1 });
        pages.push({ type: "ellipsis", id: "left" });
        pages.push({ type: "page", value: validCurrentPage - 1 });
        pages.push({ type: "page", value: validCurrentPage });
        pages.push({ type: "page", value: validCurrentPage + 1 });
        pages.push({ type: "ellipsis", id: "right" });
        pages.push({ type: "page", value: totalPages });
      }
    }
    return pages;
  };

  const currentProducts = useMemo(() => {
    const start = (validCurrentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredProducts.slice(start, end);
  }, [filteredProducts, validCurrentPage]);

  const handleAddToCart = (product) => {
    if (!auth?.token) {
      navigate("/login", { state: { from: "/products" } });
      return;
    }

    addToCart({ ...product, id: product._id });
    trackEvent({
      eventName: "add_to_cart",
      token: auth?.token,
      metadata: {
        productId: String(product._id),
        productName: String(product.name || ""),
        category: String(product.category || ""),
        quantity: 1,
        price: Number(product.finalPrice || product.price || 0),
      },
    });
  };

  const handleToggleWishlist = async (productId) => {
    if (!auth?.token) {
      warning("Vui lòng đăng nhập để sử dụng danh sách yêu thích.", { title: "Yêu thích" });
      navigate("/login", { state: { from: "/products" } });
      return;
    }

    if (pendingWishlistIds.includes(productId)) {
      return;
    }

    const isWishlisted = wishlistIds.includes(productId);
    const productName = productNameById.get(String(productId)) || "sản phẩm";
    setPendingWishlistIds((prev) => [...prev, productId]);

    try {
      const data = isWishlisted
        ? await removeFromWishlist(productId, auth.token)
        : await addToWishlist(productId, auth.token);

      const ids = Array.isArray(data?.wishlist)
        ? data.wishlist.map((item) => String(item._id))
        : [];
      setWishlistIds(ids);

      const isNowWishlisted = ids.includes(String(productId));
      success(
        isNowWishlisted
          ? `Đã thêm ${productName} vào danh sách yêu thích.`
          : `Đã xóa ${productName} khỏi danh sách yêu thích.`,
        { title: "Yêu thích" }
      );

      trackEvent({
        eventName: isNowWishlisted ? "wishlist_add" : "wishlist_remove",
        token: auth?.token,
        metadata: {
          productId: String(productId),
          productName: String(productName),
        },
      });
    } catch (error) {
      console.error("Lỗi cập nhật wishlist:", error);
      notifyError(error?.message || "Không thể kết nối đến máy chủ.", { title: "Yêu thích" });
    } finally {
      setPendingWishlistIds((prev) => prev.filter((id) => id !== productId));
    }
  };

  return (
    <main className="w-[min(1140px,92%)] mx-auto flex-1 py-7 text-slate-800">
      <div className="grid grid-cols-[260px_minmax(0,1fr)] gap-6 max-[960px]:grid-cols-1">
        {/* Sticky Filter Sidebar */}
        <aside className="sticky top-[86px] self-start p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs max-[960px]:static">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <h3 className="m-0 text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <span>⚙️</span>
              <span>Bộ lọc tìm kiếm</span>
            </h3>
            {(categoryLevel1 !== "all" || sortBy !== "best-selling" || maxPrice < maxPossiblePrice) && (
              <button
                type="button"
                onClick={() => {
                  setCategoryLevel1("all");
                  setCategoryLevel2("all");
                  setCategoryLevel3("all");
                  setSortBy("best-selling");
                  setMaxPrice(maxPossiblePrice);
                }}
                className="text-[11px] text-teal-700 hover:text-teal-800 font-bold border-none bg-transparent cursor-pointer p-0"
              >
                Đặt lại
              </button>
            )}
          </div>

          {/* Sắp xếp */}
          <div className="grid gap-1.5 mb-4">
            <label className="text-xs font-bold text-slate-700">Sắp xếp theo</label>
            <select
              className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 text-slate-800 focus:outline-none focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition-all"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="best-selling">Bán chạy nhất</option>
              <option value="most-viewed">Xem nhiều nhất</option>
              <option value="top-rated">Đánh giá cao nhất</option>
            </select>
          </div>

          {/* Danh mục 3 cấp */}
          <div className="grid gap-1.5 mb-4">
            <label className="text-xs font-bold text-slate-700">Danh mục sản phẩm</label>
            <select
              className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 text-slate-800 focus:outline-none focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition-all"
              value={categoryLevel1}
              onChange={(event) => {
                const nextValue = event.target.value;
                setCategoryLevel1(nextValue);
                setCategoryLevel2("all");
                setCategoryLevel3("all");
              }}
            >
              <option value="all">Tất cả danh mục</option>
              {level1Categories.map((cat) => (
                <option key={cat._id} value={String(cat._id)}>
                  {cat.name}
                </option>
              ))}
            </select>

            {categoryLevel1 !== "all" && (
              <select
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 text-slate-800 focus:outline-none focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition-all mt-1.5"
                value={categoryLevel2}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setCategoryLevel2(nextValue);
                  setCategoryLevel3("all");
                }}
              >
                <option value="all">Tất cả thương hiệu</option>
                {level2Categories.map((cat) => (
                  <option key={cat._id} value={String(cat._id)}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}

            {categoryLevel2 !== "all" && level3Categories.length > 0 && (
              <select
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 text-slate-800 focus:outline-none focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition-all mt-1.5"
                value={categoryLevel3}
                onChange={(event) => setCategoryLevel3(event.target.value)}
              >
                <option value="all">Tất cả dòng sản phẩm</option>
                {level3Categories.map((cat) => (
                  <option key={cat._id} value={String(cat._id)}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Mức giá */}
          <div className="grid gap-1.5 mb-2">
            <label className="text-xs font-bold text-slate-700">Mức giá tối đa</label>
            <input
              className="w-full accent-teal-700 cursor-pointer"
              type="range"
              min="0"
              max={maxPossiblePrice}
              step={Math.max(10000, Math.round(maxPossiblePrice / 200))}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
            />
            <div className="flex justify-between items-center text-[11px] text-slate-500 font-semibold mt-1">
              <span>0 đ</span>
              <span className="text-teal-700 font-bold">{maxPrice.toLocaleString("vi-VN")} đ</span>
            </div>
          </div>
        </aside>

        {/* Main Product Area */}
        <section>
          {/* Header Banner */}
          <div className="p-5 mb-5 flex items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs max-[720px]:flex-col max-[720px]:items-start">
            <div>
              <h1 className="m-0 text-xl font-extrabold text-slate-900 tracking-tight">Kho sản phẩm chính hãng</h1>
              <p className="mt-1 mb-0 text-xs text-slate-500">
                Tìm kiếm và so sánh cấu hình thiết bị công nghệ với giá tốt nhất.
              </p>
            </div>
            <div className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200/60 shrink-0">
              {filteredProducts.length} sản phẩm
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 px-6 bg-white border border-dashed border-slate-200 rounded-2xl text-slate-500 text-sm">
              Đang tải danh sách sản phẩm...
            </div>
          ) : currentProducts.length > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-4 max-[960px]:grid-cols-2 max-[640px]:grid-cols-1">
                {currentProducts.map((product) => {
                  const productId = String(product._id);
                  const isWishlisted = wishlistIds.includes(productId);
                  const isPending = pendingWishlistIds.includes(productId);
                  const outOfStock = isOutOfStock(product);
                  const pricing = getProductPricing(product);

                  return (
                    <article
                      key={productId}
                      className="bg-white border border-slate-200/80 rounded-2xl p-3 flex flex-col h-full transition-all duration-200 hover:border-teal-500 hover:shadow-md group"
                    >
                      <div className="relative rounded-xl overflow-hidden bg-slate-50 border border-slate-100 mb-3 aspect-square flex items-center justify-center">
                        {pricing.hasDiscount ? (
                          <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black tracking-wide shadow-xs">
                            -{pricing.discountPercent}%
                          </span>
                        ) : null}

                        {outOfStock ? (
                          <span className="absolute left-2 right-2 bottom-2 z-10 py-1 rounded-md bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-bold text-center">
                            Tạm hết hàng
                          </span>
                        ) : null}

                        <button
                          type="button"
                          aria-label={isWishlisted ? "Bỏ yêu thích" : "Thêm yêu thích"}
                          disabled={isPending}
                          onClick={() => handleToggleWishlist(productId)}
                          className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center border cursor-pointer transition-transform active:scale-90 ${
                            isWishlisted
                              ? "bg-rose-50 border-rose-200 text-rose-600"
                              : "bg-white/90 border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-white"
                          }`}
                        >
                          <span className="text-xs">{isWishlisted ? "❤️" : "🤍"}</span>
                        </button>

                        <Link to={`/products/${product._id}`} className="w-full h-full flex items-center justify-center">
                          <img
                            src={getProductImageSrc(product)}
                            alt={product.name}
                            className={`max-w-full max-h-full object-contain p-2 transition-transform duration-200 group-hover:scale-105 ${
                              outOfStock ? "grayscale-[40%] opacity-70" : ""
                            }`}
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              event.currentTarget.src = "/placeholder.svg";
                            }}
                          />
                        </Link>
                      </div>

                      <Link to={`/products/${product._id}`} className="no-underline flex-1 flex flex-col">
                        <h3 className="m-0 text-xs font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-teal-700 transition-colors">
                          {product.name}
                        </h3>

                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                          <span className="text-amber-500 font-bold">★ {Number(product.averageRating || 0).toFixed(1)}</span>
                          <span>•</span>
                          <span>{Number(product.totalPurchases || 0)} đã mua</span>
                        </div>

                        <div className="mt-2.5">
                          <div className="text-sm font-extrabold text-slate-900">
                            {pricing.finalPrice.toLocaleString("vi-VN")} đ
                          </div>
                          {pricing.hasDiscount ? (
                            <div className="text-[11px] text-slate-400 line-through">
                              {pricing.basePrice.toLocaleString("vi-VN")} đ
                            </div>
                          ) : null}
                        </div>
                      </Link>

                      <button
                        type="button"
                        disabled={outOfStock}
                        onClick={() => handleAddToCart(product)}
                        className={`mt-3 w-full py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                          outOfStock
                            ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                            : "bg-teal-700 hover:bg-teal-800 border-teal-700 text-white shadow-xs active:scale-[0.98]"
                        }`}
                      >
                        {outOfStock ? "Hết hàng" : "Thêm vào giỏ"}
                      </button>
                    </article>
                  );
                })}
              </div>

                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-8 py-2.5">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center min-w-[40px] h-10 px-3.5 rounded-shop-md border border-shop-line bg-white text-shop-ink font-semibold cursor-pointer transition-all duration-200 shadow-[0_4px_10px_rgba(0,0,0,0.02)] hover:bg-shop-bg hover:border-shop-muted hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-shop-bg"
                      disabled={validCurrentPage === 1}
                      onClick={() => {
                        setCurrentPage((prev) => Math.max(1, prev - 1));
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Trước
                    </button>
                    {getPageNumbers().map((item, index) => {
                      if (item.type === "ellipsis") {
                        const isEditing = editingEllipsis === item.id;
                        if (isEditing) {
                          return (
                            <input
                              key={`ellipsis-input-${item.id}-${index}`}
                              type="number"
                              min="1"
                              max={totalPages}
                              value={inputPageValue}
                              onChange={(e) => setInputPageValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const pageNum = parseInt(inputPageValue, 10);
                                  if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                                    setCurrentPage(pageNum);
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  }
                                  setEditingEllipsis(null);
                                } else if (e.key === "Escape") {
                                  setEditingEllipsis(null);
                                }
                              }}
                              onBlur={() => {
                                const pageNum = parseInt(inputPageValue, 10);
                                if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                                  setCurrentPage(pageNum);
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }
                                setEditingEllipsis(null);
                              }}
                              autoFocus
                              className="inline-flex items-center justify-center w-[60px] h-10 p-0 text-center border border-shop-primary bg-white text-shop-ink outline-none rounded-shop-md"
                            />
                          );
                        }

                        return (
                          <button
                            key={`dots-${item.id}-${index}`}
                            type="button"
                            className="inline-flex items-center justify-center min-w-[40px] h-10 text-shop-muted font-bold text-[15px] cursor-pointer hover:text-shop-primary"
                            onClick={() => {
                              setEditingEllipsis(item.id);
                              setInputPageValue("");
                            }}
                            title="Nhấp để nhập trang trực tiếp"
                          >
                            ...
                          </button>
                        );
                      }

                      return (
                        <button
                          key={`page-${item.value}`}
                          type="button"
                          className={`inline-flex items-center justify-center min-w-[40px] h-10 px-3.5 rounded-shop-md border border-shop-line bg-white text-shop-ink font-semibold cursor-pointer transition-all duration-200 shadow-[0_4px_10px_rgba(0,0,0,0.02)] hover:bg-shop-bg hover:border-shop-muted hover:-translate-y-px ${validCurrentPage === item.value ? "bg-shop-primary text-white border-shop-primary hover:bg-shop-primary hover:text-white hover:border-shop-primary" : ""}`}
                          onClick={() => {
                            setCurrentPage(item.value);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          {item.value}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className="inline-flex items-center justify-center min-w-[40px] h-10 px-3.5 rounded-shop-md border border-shop-line bg-white text-shop-ink font-semibold cursor-pointer transition-all duration-200 shadow-[0_4px_10px_rgba(0,0,0,0.02)] hover:bg-shop-bg hover:border-shop-muted hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-shop-bg"
                      disabled={validCurrentPage === totalPages}
                      onClick={() => {
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1));
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Sau
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-9 px-4.5 bg-white border border-dashed border-[rgba(0,0,0,0.12)] rounded-[20px] text-shop-muted text-sm leading-[1.55]">Không tìm thấy sản phẩm phù hợp.</div>
            )}
          </section>
        </div>
    </main>
  );
}

export default ProductsPage;
