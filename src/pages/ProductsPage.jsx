import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { trackEvent } from "../services/analyticsService";
import { fetchProducts } from "../services/productService";
import { fetchCategories } from "../services/categoryService";
import { fetchWishlist, addToWishlist, removeFromWishlist } from "../services/wishlistService";
import ProductPagination from "../components/product/ProductPagination";
import ProductGrid from "../components/product/ProductGrid";
import ProductFilterSidebar from "../components/product/ProductFilterSidebar";

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
        <ProductFilterSidebar categoryLevel1={categoryLevel1} categoryLevel2={categoryLevel2} categoryLevel3={categoryLevel3} level1Categories={level1Categories} level2Categories={level2Categories} level3Categories={level3Categories} maxPossiblePrice={maxPossiblePrice} maxPrice={maxPrice} setCategoryLevel1={setCategoryLevel1} setCategoryLevel2={setCategoryLevel2} setCategoryLevel3={setCategoryLevel3} setMaxPrice={setMaxPrice} setSortBy={setSortBy} sortBy={sortBy} />

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
              <ProductGrid currentProducts={currentProducts} handleAddToCart={handleAddToCart} handleToggleWishlist={handleToggleWishlist} pendingWishlistIds={pendingWishlistIds} wishlistIds={wishlistIds} />

                <ProductPagination editingEllipsis={editingEllipsis} inputPageValue={inputPageValue} setCurrentPage={setCurrentPage} setEditingEllipsis={setEditingEllipsis} setInputPageValue={setInputPageValue} totalPages={totalPages} validCurrentPage={validCurrentPage} />
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
