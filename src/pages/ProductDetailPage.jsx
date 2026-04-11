import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

function getProductImageSrc(product) {
  const rawValue = String(product?.image || product?.imageUrl || "").trim();
  if (!rawValue) {
    return "/placeholder.jpg";
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

function ProductDetailPage() {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isWishlistLoading, setIsWishlistLoading] = useState(false);
  const [eligibility, setEligibility] = useState({ canReview: false, availableOrders: [] });
  const [reviewForm, setReviewForm] = useState({ orderId: "", rating: 5, comment: "" });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");

  const handleAddToCart = () => {
    if (!auth?.token) {
      navigate("/login", { state: { from: `/products/${id}` } });
      return;
    }

    addToCart({ ...product, id: product._id });
  };

  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/products/${id}`);
        if (response.ok) {
          const data = await response.json();
          setProduct(data);
        }
      } catch (error) {
        console.error("Lỗi khi tải chi tiết sản phẩm:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  useEffect(() => {
    const trackView = async () => {
      if (!auth?.token || !id) {
        return;
      }

      try {
        await fetch(`/api/products/${id}/view`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${auth.token}`,
          },
        });
      } catch (error) {
        // Không chặn trải nghiệm nếu ghi nhận lượt xem thất bại.
      }
    };

    trackView();
  }, [auth?.token, id]);

  useEffect(() => {
    const fetchWishlistStatus = async () => {
      if (!auth?.token || !id) {
        setIsWishlisted(false);
        return;
      }

      try {
        const response = await fetch("/api/auth/wishlist", {
          headers: {
            Authorization: `Bearer ${auth.token}`,
          },
        });

        if (!response.ok) {
          setIsWishlisted(false);
          return;
        }

        const data = await response.json();
        const existed = Array.isArray(data?.wishlist)
          ? data.wishlist.some((item) => String(item._id) === String(id))
          : false;
        setIsWishlisted(existed);
      } catch (error) {
        setIsWishlisted(false);
      }
    };

    fetchWishlistStatus();
  }, [auth?.token, id]);

  useEffect(() => {
    const fetchReviewEligibility = async () => {
      if (!auth?.token || !id) {
        setEligibility({ canReview: false, availableOrders: [] });
        setReviewForm((prev) => ({ ...prev, orderId: "" }));
        return;
      }

      try {
        const response = await fetch(`/api/products/${id}/review-eligibility`, {
          headers: {
            Authorization: `Bearer ${auth.token}`,
          },
        });

        const data = await response.json();
        if (!response.ok) {
          setEligibility({ canReview: false, availableOrders: [] });
          return;
        }

        const availableOrders = Array.isArray(data?.availableOrders) ? data.availableOrders : [];
        setEligibility({
          canReview: Boolean(data?.canReview),
          availableOrders,
        });
        setReviewForm((prev) => ({
          ...prev,
          orderId: prev.orderId || (availableOrders[0]?._id || ""),
        }));
      } catch (error) {
        setEligibility({ canReview: false, availableOrders: [] });
      }
    };

    fetchReviewEligibility();
  }, [auth?.token, id]);

  const handleSubmitReview = async (event) => {
    event.preventDefault();

    if (!auth?.token) {
      navigate("/login", { state: { from: `/products/${id}` } });
      return;
    }

    if (!reviewForm.orderId) {
      setReviewError("Vui lòng chọn đơn hàng đã giao để đánh giá.");
      return;
    }

    if (String(reviewForm.comment || "").trim().length < 5) {
      setReviewError("Vui lòng nhập nhận xét tối thiểu 5 ký tự.");
      return;
    }

    setReviewSubmitting(true);
    setReviewError("");
    setReviewMessage("");
    try {
      const response = await fetch(`/api/products/${id}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          orderId: reviewForm.orderId,
          rating: Number(reviewForm.rating),
          comment: String(reviewForm.comment || "").trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setReviewError(data?.message || "Không thể gửi đánh giá.");
        return;
      }

      setReviewMessage(data?.message || "Đánh giá thành công.");
      setReviewForm({ orderId: "", rating: 5, comment: "" });

      const review = data?.review
        ? {
            ...data.review,
            user: {
              _id: data.review.user,
              name: auth?.user?.name || "Bạn",
            },
          }
        : null;

      setProduct((prev) => {
        if (!prev) {
          return prev;
        }

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
        availableOrders: prev.availableOrders.filter((item) => String(item._id) !== String(reviewForm.orderId)),
      }));
    } catch (error) {
      setReviewError("Không thể kết nối tới máy chủ.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleToggleWishlist = async () => {
    if (!auth?.token) {
      navigate("/login", { state: { from: `/products/${id}` } });
      return;
    }

    if (!product?._id || isWishlistLoading) {
      return;
    }

    setIsWishlistLoading(true);
    try {
      const response = await fetch(
        isWishlisted ? `/api/auth/wishlist/${product._id}` : "/api/auth/wishlist",
        {
          method: isWishlisted ? "DELETE" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.token}`,
          },
          body: isWishlisted ? undefined : JSON.stringify({ productId: product._id }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        return;
      }

      const existed = Array.isArray(data?.wishlist)
        ? data.wishlist.some((item) => String(item._id) === String(product._id))
        : false;
      setIsWishlisted(existed);
    } catch (error) {
      console.error("Lỗi cập nhật wishlist:", error);
    } finally {
      setIsWishlistLoading(false);
    }
  };

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
    <main className="container page-content" style={{ padding: "0 20px" }}>
      {/* Điều hướng Breadcrumb */}
      <nav aria-label="breadcrumb" style={{ marginBottom: '24px' }}>
        <ol style={{ display: 'flex', listStyle: 'none', padding: 0, margin: 0, gap: '8px', color: '#6c757d' }}>
          <li><Link to="/" style={{ textDecoration: 'none', color: '#007bff' }}>Trang chủ</Link></li>
          <li>/</li>
          <li><Link to="/products" style={{ textDecoration: 'none', color: '#007bff' }}>Sản phẩm</Link></li>
          <li>/</li>
          <li aria-current="page" style={{ fontWeight: 'bold', color: '#343a40' }}>{product.name}</li>
        </ol>
      </nav>

      <div style={{ display: "flex", gap: "48px", flexWrap: "wrap", backgroundColor: "#fff", padding: "32px", borderRadius: "8px", border: "1px solid #dee2e6" }}>
        {/* Cột hiển thị hình ảnh */}
        <div style={{ flex: "1 1 40%", minWidth: "300px", borderRadius: "8px", border: "1px solid #dee2e6", overflow: "hidden", backgroundColor: "#f8f9fa" }}>
          <img
            src={getProductImageSrc(product)}
            alt={product.name}
            style={{ width: "100%", height: "400px", objectFit: "cover" }}
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = "/placeholder.jpg";
            }}
          />
        </div>

        {/* Cột thông tin chi tiết */}
        <div style={{ flex: "1 1 50%", minWidth: "300px", display: "flex", flexDirection: "column" }}>
          <h2 style={{ fontSize: "32px", marginBottom: "16px", marginTop: 0 }}>{product.name}</h2>
          <p style={{ marginTop: 0, marginBottom: "8px", color: "#f59e0b", fontWeight: "bold" }}>
            {Number(product.averageRating || 0).toFixed(1)} ★ ({Number(product.totalRatings || 0)} đánh giá)
          </p>
          <p style={{ color: "#6c757d", fontSize: "16px", marginBottom: "16px" }}>Danh mục: <strong>{product.category}</strong></p>
          <p style={{ color: "#6c757d", fontSize: "14px", marginTop: 0, marginBottom: "16px" }}>Lượt xem: <strong>{Number(product.totalViews || 0)}</strong></p>
          <p style={{ fontSize: "28px", fontWeight: "bold", color: "#dc3545", marginBottom: "24px" }}>{product.price.toLocaleString("vi-VN")} đ</p>
          <div style={{ marginBottom: "32px", lineHeight: "1.6", color: "#495057" }}>
            <h4 style={{ marginBottom: "8px" }}>Mô tả sản phẩm:</h4>
            <p>{product.description}</p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={isWishlistLoading}
              onClick={handleToggleWishlist}
              style={{
                padding: "14px 24px",
                backgroundColor: isWishlisted ? "#ffe3e3" : "#ffffff",
                color: isWishlisted ? "#c92a2a" : "#495057",
                border: "1px solid #dee2e6",
                borderRadius: "4px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: isWishlistLoading ? "not-allowed" : "pointer",
              }}
            >
              {isWishlistLoading ? "Đang xử lý..." : isWishlisted ? "Đã yêu thích ♥" : "Thêm yêu thích ♡"}
            </button>
            <button onClick={handleAddToCart} style={{ padding: "16px 32px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px", fontSize: "18px", fontWeight: "bold", cursor: "pointer", width: "fit-content" }}>
              Thêm vào giỏ hàng
            </button>
          </div>
        </div>
      </div>

      <section style={{ marginTop: "24px", border: "1px solid #dee2e6", borderRadius: "8px", backgroundColor: "#fff", padding: "24px" }}>
        <h3 style={{ marginTop: 0, marginBottom: "16px" }}>Đánh giá sản phẩm</h3>

        {!auth?.token ? (
          <p style={{ margin: 0, color: "#6c757d" }}>
            Vui lòng <Link to="/login" style={{ color: "#007bff" }}>đăng nhập</Link> để đánh giá sau khi đơn hàng đã giao.
          </p>
        ) : eligibility.canReview ? (
          <form onSubmit={handleSubmitReview} style={{ marginBottom: "24px", border: "1px solid #e9ecef", borderRadius: "8px", padding: "16px", backgroundColor: "#f8fafc" }}>
            <h4 style={{ marginTop: 0, marginBottom: "12px" }}>Viết đánh giá</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: "10px", marginBottom: "10px" }}>
              <select
                value={reviewForm.orderId}
                onChange={(event) => setReviewForm((prev) => ({ ...prev, orderId: event.target.value }))}
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                required
              >
                {eligibility.availableOrders.map((order) => (
                  <option key={order._id} value={order._id}>
                    Đơn {String(order._id).slice(-8).toUpperCase()} - {new Date(order.createdAt).toLocaleDateString("vi-VN")}
                  </option>
                ))}
              </select>
              <select
                value={reviewForm.rating}
                onChange={(event) => setReviewForm((prev) => ({ ...prev, rating: Number(event.target.value) }))}
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              >
                <option value={5}>5 sao</option>
                <option value={4}>4 sao</option>
                <option value={3}>3 sao</option>
                <option value={2}>2 sao</option>
                <option value={1}>1 sao</option>
              </select>
            </div>
            <textarea
              rows={4}
              placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm..."
              value={reviewForm.comment}
              onChange={(event) => setReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: "10px" }}
            />
            {reviewError ? <p style={{ marginTop: 0, color: "#b91c1c" }}>{reviewError}</p> : null}
            {reviewMessage ? <p style={{ marginTop: 0, color: "#166534" }}>{reviewMessage}</p> : null}
            <button type="submit" disabled={reviewSubmitting} style={{ padding: "10px 16px", borderRadius: "6px", border: "none", backgroundColor: "#0f172a", color: "#fff", fontWeight: "bold", cursor: reviewSubmitting ? "not-allowed" : "pointer" }}>
              {reviewSubmitting ? "Đang gửi..." : "Gửi đánh giá"}
            </button>
          </form>
        ) : (
          <p style={{ marginTop: 0, marginBottom: "16px", color: "#6c757d" }}>
            Bạn chỉ có thể đánh giá sản phẩm sau khi đã nhận hàng thành công.
          </p>
        )}

        <div style={{ display: "grid", gap: "12px" }}>
          {(product.reviews || []).length === 0 ? (
            <p style={{ margin: 0, color: "#6c757d" }}>Chưa có đánh giá nào cho sản phẩm này.</p>
          ) : (
            (product.reviews || []).map((review) => (
              <article key={review._id} style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <strong>{review.user?.name || "Người dùng"}</strong>
                  <span style={{ color: "#f59e0b", fontWeight: "bold" }}>{Number(review.rating || 0).toFixed(1)} ★</span>
                </div>
                <p style={{ margin: "8px 0", color: "#374151" }}>{review.comment}</p>
                <p style={{ margin: 0, color: "#9ca3af", fontSize: "12px" }}>{new Date(review.createdAt).toLocaleString("vi-VN")}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

export default ProductDetailPage;