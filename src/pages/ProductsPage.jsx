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

  const categoriesById = new Map(
    categoryItems.map((item) => [String(item._id), item])
  );

  const childrenByParentId = new Map();
  categoryItems.forEach((item) => {

    const key = item.parentId ? String(item.parentId) : "root";
    const next = childrenByParentId.get(key) || [];
    next.push(item);
    childrenByParentId.set(key, next);
  });

  const selectedCategoryScope = (() => {
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
      names: new Set(matchedCategories.map((item) => item.name)),
      paths: matchedCategories
        .map((item) => String(item.path || "").trim())
        .filter(Boolean),
    };
  })();

  useEffect(() => {
    const results = allProducts.filter((product) => {
      const matchSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const productCategory = String(product.category || "").trim();
      const matchCategory = (() => {
        if (!selectedCategoryScope) {
          return true;
        }

        if (selectedCategoryScope.names.has(productCategory)) {
          return true;
        }

        return selectedCategoryScope.paths.some(
          (path) => productCategory === path || productCategory.startsWith(`${path} >`)
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

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push({ type: "page", value: i });
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push({ type: "page", value: i });
        }
        pages.push({ type: "ellipsis", id: "right" });
        pages.push({ type: "page", value: totalPages });
      } else if (currentPage >= totalPages - 3) {
        pages.push({ type: "page", value: 1 });
        pages.push({ type: "ellipsis", id: "left" });
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push({ type: "page", value: i });
        }
      } else {
        pages.push({ type: "page", value: 1 });
        pages.push({ type: "ellipsis", id: "left" });
        pages.push({ type: "page", value: currentPage - 1 });
        pages.push({ type: "page", value: currentPage });
        pages.push({ type: "page", value: currentPage + 1 });
        pages.push({ type: "ellipsis", id: "right" });
        pages.push({ type: "page", value: totalPages });
      }
    }
    return pages;
  };

  const currentProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredProducts.slice(start, end);
  }, [filteredProducts, currentPage]);

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
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
      <div className="bg-gradient-to-b from-[#f8fafc] to-[#f3f7fb] rounded-shop-lg p-[30px] max-[720px]:p-[18px] max-[720px]:rounded-[20px]">
        <div className="grid grid-cols-[270px_minmax(0,1fr)] gap-5 max-[960px]:grid-cols-1">
          <aside className="sticky top-[94px] self-start p-[22px] bg-gradient-to-b from-white to-[#f8fbff] border border-shop-line rounded-shop-lg shadow-shop max-[960px]:static max-[960px]:p-4.5">
            <h3 className="m-0 mb-3 text-lg font-extrabold text-shop-ink">Bộ lọc</h3>
            <div className="grid gap-2 mb-4">
              <h4 className="m-0 text-sm font-bold text-shop-ink">Sắp xếp</h4>
              <select className="w-full border border-shop-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-shop-primary" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="best-selling">Bán chạy nhất</option>
                <option value="most-viewed">Xem nhiều nhất</option>
                <option value="top-rated">Đánh giá cao nhất</option>
              </select>
            </div>

            <div className="grid gap-2 mb-4">
              <h4 className="m-0 text-sm font-bold text-shop-ink">Danh mục</h4>
              <select
                className="w-full border border-shop-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-shop-primary"
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
                  className="w-full border border-shop-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-shop-primary mt-2"
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
                  className="w-full border border-shop-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-shop-primary mt-2"
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

            <div className="grid gap-2 mb-4">
              <h4 className="m-0 text-sm font-bold text-shop-ink">Mức giá</h4>
              <div className="grid gap-2">
                <input
                  className="w-full accent-shop-primary"
                  type="range"
                  min="0"
                  max={maxPossiblePrice}
                  step={Math.max(10000, Math.round(maxPossiblePrice / 200))}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                />
                <div className="text-[13px] text-shop-muted">
                  Dưới {maxPrice.toLocaleString("vi-VN")} đ / Tối đa {maxPossiblePrice.toLocaleString("vi-VN")} đ
                </div>
              </div>
            </div>
          </aside>

          <section>
            <div className="p-6 mb-[18px] grid grid-cols-[1fr_auto] gap-4 bg-gradient-to-br from-white to-shop-soft-orange border border-shop-line rounded-shop-lg shadow-shop max-[720px]:grid-cols-1">
              <div>
                <h1 className="m-0 text-[33px] tracking-tight text-shop-ink font-black max-[720px]:text-[27px]">Kho sản phẩm</h1>
                <p className="mt-2 text-shop-muted text-sm leading-[1.55]">
                  Các sản phẩm hiện tại đang được bày bán.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-9 px-4.5 bg-white border border-dashed border-[rgba(0,0,0,0.12)] rounded-[20px] text-shop-muted text-sm leading-[1.55]">Đang tải danh sách sản phẩm...</div>
            ) : currentProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-4 max-[960px]:grid-cols-2 max-[720px]:grid-cols-1">
                  {currentProducts.map((product) => {
                    const productId = String(product._id);
                    const isWishlisted = wishlistIds.includes(productId);
                    const isPending = pendingWishlistIds.includes(productId);
                    const outOfStock = isOutOfStock(product);
                    const pricing = getProductPricing(product);

                    return (
                      <article key={productId} className="bg-shop-surface border border-shop-line rounded-shop-md shadow-shop p-3.5 flex flex-col h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(15,23,42,0.08)] animate-shopx-fade-up">
                        <Link to={`/products/${product._id}`} style={{ textDecoration: "none" }}>
                          <div className="relative rounded-[16px] overflow-hidden border border-shop-line bg-gradient-to-br from-[#f3f8ff] to-[#fdf6f1] mb-3">
                            {pricing.hasDiscount ? (
                              <span className="absolute top-2 left-2 z-10 inline-flex items-center justify-center min-h-[24px] px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wider bg-[#ef4444] text-white border border-[#dc2626]">-{pricing.discountPercent}%</span>
                            ) : null}
                            {outOfStock ? <span className="absolute left-2 right-2 bottom-2 z-10 inline-flex items-center justify-center min-h-[24px] px-2 py-0.5 rounded-full text-[11px] font-extrabold tracking-wider bg-[#ef4444] text-white border border-[#dc2626]">Hết hàng</span> : null}
                            <img
                              src={getProductImageSrc(product)}
                              alt={product.name}
                              className={`w-full h-[212px] object-cover block ${outOfStock ? "grayscale-[55%] brightness-[88%]" : ""}`}
                              onError={(event) => {
                                event.currentTarget.onerror = null;
                                event.currentTarget.src = "/placeholder.svg";
                              }}
                            />
                          </div>
                          <h3 className="m-0 text-[17px] text-shop-ink font-bold">{product.name}</h3>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="inline-flex items-center rounded-full border border-shop-line px-2.5 py-1 text-xs font-bold bg-[#fff5d9] text-[#92400e]">
                              {Number(product.averageRating || 0).toFixed(1)} sao ({Number(product.totalRatings || 0)})
                            </span>
                            <span className="inline-flex items-center rounded-full border border-shop-line px-2.5 py-1 text-xs font-bold bg-[#e6f7ff] text-[#075985]">{Number(product.totalViews || 0)} lượt xem</span>
                            <span className="inline-flex items-center rounded-full border border-shop-line px-2.5 py-1 text-xs font-bold bg-[#ebfbe8] text-[#166534]">{Number(product.totalPurchases || 0)} lượt mua</span>
                          </div>
                          <p className="my-3 text-[#be2f00] text-[21px] font-extrabold">{pricing.finalPrice.toLocaleString("vi-VN")} đ</p>
                          {pricing.hasDiscount ? (
                            <p className="-mt-1.5 mb-2.5 text-[#94a3b8] text-sm line-through font-bold">{pricing.basePrice.toLocaleString("vi-VN")} đ</p>
                          ) : null}
                        </Link>

                        <div className="mt-auto grid gap-2 pt-3">
                          <button
                            type="button"
                            disabled={isPending}
                            className={isWishlisted
                              ? "rounded-[14px] border border-[#fca5a5] bg-[#fee2e2] text-[#b91c1c] px-3 py-2.5 text-sm font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-xs disabled:cursor-not-allowed disabled:opacity-70"
                              : "rounded-[14px] border border-[#fdba74] bg-[#fff7ed] text-[#c2410c] px-3 py-2.5 text-sm font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-xs hover:bg-[#ffedd5] disabled:cursor-not-allowed disabled:opacity-70"
                            }
                            onClick={() => handleToggleWishlist(productId)}
                          >
                            {isPending ? "Đang xử lý..." : isWishlisted ? "Đã yêu thích" : "Thêm yêu thích"}
                          </button>
                          <button
                            type="button"
                            className={outOfStock
                              ? "rounded-[14px] border border-[#fca5a5] bg-[#fee2e2] text-[#b91c1c] px-3 py-2.5 text-sm font-bold cursor-not-allowed opacity-100"
                              : "rounded-[14px] border border-[#0f766e] bg-gradient-to-br from-[#0f766e] to-[#115e59] text-white px-3 py-2.5 text-sm font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-xs hover:from-[#159287] hover:to-[#0f766e] disabled:cursor-not-allowed disabled:opacity-70"
                            }
                            disabled={outOfStock}
                            onClick={() => handleAddToCart(product)}
                          >
                            {outOfStock ? "Hết hàng" : "Thêm vào giỏ"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-8 py-2.5">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center min-w-[40px] h-10 px-3.5 rounded-shop-md border border-shop-line bg-white text-shop-ink font-semibold cursor-pointer transition-all duration-200 shadow-[0_4px_10px_rgba(0,0,0,0.02)] hover:bg-shop-bg hover:border-shop-muted hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-shop-bg"
                      disabled={currentPage === 1}
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
                          className={`inline-flex items-center justify-center min-w-[40px] h-10 px-3.5 rounded-shop-md border border-shop-line bg-white text-shop-ink font-semibold cursor-pointer transition-all duration-200 shadow-[0_4px_10px_rgba(0,0,0,0.02)] hover:bg-shop-bg hover:border-shop-muted hover:-translate-y-px ${currentPage === item.value ? "bg-shop-primary text-white border-shop-primary hover:bg-shop-primary hover:text-white hover:border-shop-primary" : ""}`}
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
                      disabled={currentPage === totalPages}
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
      </div>
    </main>
  );
}

export default ProductsPage;
