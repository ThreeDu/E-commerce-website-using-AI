/**
 * Product detail page.
 *
 * Orchestrates product data fetching and composes three sub-components:
 * - ProductInfo  — image, pricing, wishlist, add-to-cart
 * - ReviewForm   — create new reviews
 * - ReviewList   — display, edit, and delete existing reviews
 */
import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { trackEvent } from "../services/analyticsService";
import { isOutOfStock } from "../utils/productUtils";
import { fetchProductById, trackProductView, fetchReviewEligibility } from "../services/productService";
import { fetchWishlist, addToWishlist, removeFromWishlist } from "../services/wishlistService";
import ProductInfo from "../components/product/ProductInfo";
import ProductDescriptionSection from "../components/product/ProductDescriptionSection";
import ReviewForm from "../components/product/ReviewForm";
import ReviewList from "../components/product/ReviewList";
import "../css/shop-experience.css";

function ProductDetailPage() {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { auth } = useAuth();
  const { success, error: notifyError, warning } = useNotification();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isWishlistLoading, setIsWishlistLoading] = useState(false);
  const [eligibility, setEligibility] = useState({ canReview: false, availableOrders: [] });

  // ── Fetch product ──
  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchProductById(id);
        setProduct(data);
        trackEvent({
          eventName: "product_view",
          token: auth?.token,
          metadata: {
            productId: String(data?._id || id),
            productName: String(data?.name || ""),
            category: String(data?.category || ""),
            price: Number(data?.finalPrice || data?.price || 0),
          },
        });
      } catch (error) {
        console.error("Lỗi khi tải chi tiết sản phẩm:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [auth?.token, id]);

  // ── Track view ──
  useEffect(() => {
    if (!auth?.token || !id) return;
    trackProductView(id, auth.token).catch(() => {});
  }, [auth?.token, id]);

  // ── Wishlist status ──
  useEffect(() => {
    const load = async () => {
      if (!auth?.token || !id) { setIsWishlisted(false); return; }
      try {
        const data = await fetchWishlist(auth.token);
        setIsWishlisted(
          Array.isArray(data?.wishlist)
            ? data.wishlist.some((item) => String(item._id) === String(id))
            : false
        );
      } catch { setIsWishlisted(false); }
    };
    load();
  }, [auth?.token, id]);

  // ── Review eligibility ──
  useEffect(() => {
    const load = async () => {
      if (!auth?.token || !id) { setEligibility({ canReview: false, availableOrders: [] }); return; }
      try {
        const data = await fetchReviewEligibility(id, auth.token);
        const orders = Array.isArray(data?.availableOrders) ? data.availableOrders : [];
        setEligibility({ canReview: Boolean(data?.canReview), availableOrders: orders });
      } catch { setEligibility({ canReview: false, availableOrders: [] }); }
    };
    load();
  }, [auth?.token, id]);

  // ── Handlers ──
  const handleAddToCart = () => {
    if (!auth?.token) { navigate("/login", { state: { from: `/products/${id}` } }); return; }
    if (!product || isOutOfStock(product)) return;

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

  const handleToggleWishlist = async () => {
    if (!auth?.token) {
      warning("Vui lòng đăng nhập để sử dụng danh sách yêu thích.", { title: "Yêu thích" });
      navigate("/login", { state: { from: `/products/${id}` } });
      return;
    }
    if (!product?._id || isWishlistLoading) return;

    setIsWishlistLoading(true);
    try {
      const data = isWishlisted
        ? await removeFromWishlist(product._id, auth.token)
        : await addToWishlist(product._id, auth.token);

      const existed = Array.isArray(data?.wishlist)
        ? data.wishlist.some((item) => String(item._id) === String(product._id))
        : false;
      setIsWishlisted(existed);

      const productName = String(product?.name || "sản phẩm");
      success(
        existed ? `Đã thêm ${productName} vào danh sách yêu thích.` : `Đã xóa ${productName} khỏi danh sách yêu thích.`,
        { title: "Yêu thích" }
      );
      trackEvent({
        eventName: existed ? "wishlist_add" : "wishlist_remove",
        token: auth?.token,
        metadata: { productId: String(product._id), productName, category: String(product.category || "") },
      });
    } catch (error) {
      notifyError(error?.message || "Không thể kết nối đến máy chủ.", { title: "Yêu thích" });
    } finally {
      setIsWishlistLoading(false);
    }
  };

  // ── Review callbacks ──
  const handleReviewSubmitted = (data, submittedOrderId) => {
    const review = data?.review
      ? { ...data.review, user: { _id: data.review.user, name: auth?.user?.name || "Bạn" } }
      : null;

    setProduct((prev) => {
      if (!prev) return prev;
      const nextReviews = review ? [review, ...(prev.reviews || [])] : prev.reviews || [];
      return {
        ...prev,
        reviews: nextReviews,
        averageRating: Number(data?.averageRating || prev.averageRating || 0),
        totalRatings: Number(data?.totalRatings || prev.totalRatings || nextReviews.length),
      };
    });

    setEligibility((prev) => ({
      ...prev,
      canReview: prev.availableOrders.length > 1,
      availableOrders: prev.availableOrders.filter((o) => String(o._id) !== String(submittedOrderId)),
    }));
  };

  const handleReviewUpdated = (data, reviewId, editForm) => {
    const updatedReview = data?.review || {};
    setProduct((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        reviews: (prev.reviews || []).map((r) =>
          String(r._id) === String(reviewId)
            ? { ...r, rating: Number(updatedReview.rating || editForm.rating), comment: updatedReview.comment || editForm.comment, updatedAt: updatedReview.updatedAt || new Date().toISOString() }
            : r
        ),
        averageRating: Number(data?.averageRating || prev.averageRating || 0),
        totalRatings: Number(data?.totalRatings || prev.totalRatings || 0),
      };
    });
  };

  const handleReviewDeleted = (data, reviewId) => {
    setProduct((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        reviews: (prev.reviews || []).filter((r) => String(r._id) !== String(reviewId)),
        averageRating: Number(data?.averageRating || prev.averageRating || 0),
        totalRatings: Number(data?.totalRatings || prev.totalRatings || 0),
      };
    });
  };

  // ── Render ──
  if (loading) {
    return <main className="container page-content" style={{ textAlign: "center", padding: "100px 20px" }}><h2>Đang tải thông tin...</h2></main>;
  }

  if (!product) {
    return (
      <main className="container page-content" style={{ textAlign: "center", padding: "100px 20px" }}>
        <h2 style={{ marginBottom: "16px" }}>Không tìm thấy sản phẩm!</h2>
        <Link to="/products" style={{ color: "#007bff", textDecoration: "none", fontWeight: "bold" }}>Quay lại trang Sản phẩm</Link>
      </main>
    );
  }

  return (
    <main className="container page-content">
      <div className="shopx-page">
        <ProductInfo
          product={product}
          isWishlisted={isWishlisted}
          isWishlistLoading={isWishlistLoading}
          onToggleWishlist={handleToggleWishlist}
          onAddToCart={handleAddToCart}
        />

        <ProductDescriptionSection description={product.description} />

        <section className="shopx-panel shopx-review-box">
          <h3 style={{ marginTop: 0 }}>Đánh giá sản phẩm</h3>

          <ReviewForm
            productId={id}
            eligibility={eligibility}
            onReviewSubmitted={handleReviewSubmitted}
          />

          <ReviewList
            reviews={product.reviews || []}
            productId={id}
            onReviewUpdated={handleReviewUpdated}
            onReviewDeleted={handleReviewDeleted}
          />
        </section>
      </div>
    </main>
  );
}

export default ProductDetailPage;