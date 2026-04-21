import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import "../css/shop-experience.css";

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

function getProductPricing(product) {
  const basePrice = Math.max(0, Number(product?.price || 0));
  const rawDiscountPercent = Math.max(0, Math.min(100, Number(product?.discountPercent || 0)));
  const finalPriceFromApi = Math.max(0, Number(product?.finalPrice || 0));

  const fallbackFinalPrice = Math.round(basePrice * (1 - rawDiscountPercent / 100));
  const finalPrice =
    finalPriceFromApi > 0 && finalPriceFromApi < basePrice ? finalPriceFromApi : fallbackFinalPrice;

  const hasDiscount = basePrice > 0 && finalPrice < basePrice;
  const discountPercent = hasDiscount
    ? Math.max(1, Math.round(((basePrice - finalPrice) / basePrice) * 100))
    : 0;

  return {
    basePrice,
    finalPrice: hasDiscount ? finalPrice : basePrice,
    hasDiscount,
    discountPercent,
  };
}

function isOutOfStock(product) {
  return Number(product?.stock || 0) <= 0;
}

function ProductDetailPage() {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { auth } = useAuth();
  const { success, error: notifyError, warning } = useNotification();
  const navigate = useNavigate();
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isWishlistLoading, setIsWishlistLoading] = useState(false);
  const [eligibility, setEligibility] = useState({ canReview: false, availableOrders: [] });
  const [reviewForm, setReviewForm] = useState({ orderId: "", rating: 5, comment: "" });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [editingReviewId, setEditingReviewId] = useState("");
  const [editReviewForm, setEditReviewForm] = useState({ rating: 5, comment: "" });
  const [reviewActionLoadingId, setReviewActionLoadingId] = useState("");
  const [reviewActionMessage, setReviewActionMessage] = useState("");
  const [reviewActionError, setReviewActionError] = useState("");
  const [reviewDeleteTargetId, setReviewDeleteTargetId] = useState("");

  const handleAddToCart = () => {
    if (!auth?.token) {
      navigate("/login", { state: { from: `/products/${id}` } });
      return;
    }

    if (!product || isOutOfStock(product)) {
      return;
    }

    addToCart({ ...product, id: product._id });
  };

  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const currentUserId = String(auth?.user?.id || auth?.user?._id || "");

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
      warning("Vui lòng đăng nhập để sử dụng danh sách yêu thích.", { title: "Yêu thích" });
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
        notifyError(data?.message || "Không thể cập nhật danh sách yêu thích.", { title: "Yêu thích" });
        return;
      }

      const existed = Array.isArray(data?.wishlist)
        ? data.wishlist.some((item) => String(item._id) === String(product._id))
        : false;
      setIsWishlisted(existed);

      const productName = String(product?.name || "sản phẩm");
      success(
        existed
          ? `Đã thêm ${productName} vào danh sách yêu thích.`
          : `Đã xóa ${productName} khỏi danh sách yêu thích.`,
        { title: "Yêu thích" }
      );
    } catch (error) {
      console.error("Lỗi cập nhật wishlist:", error);
      notifyError("Không thể kết nối đến máy chủ.", { title: "Yêu thích" });
    } finally {
      setIsWishlistLoading(false);
    }
  };

  const handleStartEditReview = (review) => {
    setEditingReviewId(String(review?._id || ""));
    setEditReviewForm({
      rating: Number(review?.rating || 5),
      comment: String(review?.comment || ""),
    });
    setReviewActionError("");
    setReviewActionMessage("");
  };

  const handleCancelEditReview = () => {
    setEditingReviewId("");
    setEditReviewForm({ rating: 5, comment: "" });
  };

  const handleUpdateReview = async (reviewId) => {
    const trimmedComment = String(editReviewForm.comment || "").trim();
    if (trimmedComment.length < 5) {
      setReviewActionError("Nội dung đánh giá phải tối thiểu 5 ký tự.");
      return;
    }

    setReviewActionLoadingId(String(reviewId));
    setReviewActionError("");
    setReviewActionMessage("");
    try {
      const response = await fetch(`/api/products/${id}/reviews/${reviewId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          rating: Number(editReviewForm.rating),
          comment: trimmedComment,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setReviewActionError(data?.message || "Không thể cập nhật đánh giá.");
        return;
      }

      const updatedReview = data?.review || {};
      setProduct((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          reviews: (prev.reviews || []).map((review) =>
            String(review._id) === String(reviewId)
              ? {
                  ...review,
                  rating: Number(updatedReview.rating || editReviewForm.rating),
                  comment: updatedReview.comment || trimmedComment,
                  updatedAt: updatedReview.updatedAt || new Date().toISOString(),
                }
              : review
          ),
          averageRating: Number(data?.averageRating || prev.averageRating || 0),
          totalRatings: Number(data?.totalRatings || prev.totalRatings || 0),
        };
      });

      setReviewActionMessage("Cập nhật đánh giá thành công.");
      handleCancelEditReview();
    } catch (error) {
      setReviewActionError("Không thể kết nối tới máy chủ.");
    } finally {
      setReviewActionLoadingId("");
    }
  };

  const handleDeleteReview = async (reviewId) => {
    setReviewDeleteTargetId(String(reviewId));
  };

  const handleConfirmDeleteReview = async () => {
    const reviewId = String(reviewDeleteTargetId || "").trim();
    if (!reviewId) {
      return;
    }

    setReviewActionLoadingId(String(reviewId));
    setReviewActionError("");
    setReviewActionMessage("");
    try {
      const response = await fetch(`/api/products/${id}/reviews/${reviewId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        setReviewActionError(data?.message || "Không thể xóa đánh giá.");
        return;
      }

      setProduct((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          reviews: (prev.reviews || []).filter((review) => String(review._id) !== String(reviewId)),
          averageRating: Number(data?.averageRating || prev.averageRating || 0),
          totalRatings: Number(data?.totalRatings || prev.totalRatings || 0),
        };
      });

      setReviewActionMessage("Đã xóa đánh giá.");
      setReviewDeleteTargetId("");
    } catch (error) {
      setReviewActionError("Không thể kết nối tới máy chủ.");
    } finally {
      setReviewActionLoadingId("");
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

  const pricing = getProductPricing(product);
  const outOfStock = isOutOfStock(product);

  return (
    <main className="container page-content">
      <div className="shopx-page">
        <section className="shopx-panel shopx-detail">
          <div className={`shopx-detail-media ${outOfStock ? "is-out-of-stock" : ""}`}>
            {pricing.hasDiscount ? <span className="shopx-sale-badge">-{pricing.discountPercent}%</span> : null}
            {outOfStock ? <span className="shopx-stock-badge">Hết hàng</span> : null}
            <img
              src={getProductImageSrc(product)}
              alt={product.name}
              className="shopx-detail-image"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = "/placeholder.svg";
              }}
            />
          </div>
          <div>
            <h1 className="shopx-detail-name">{product.name}</h1>
            <p className="shopx-subtitle" style={{ marginTop: "12px" }}>
              Danh mục: <strong>{product.category}</strong>
            </p>

            <div className="shopx-meta-row" style={{ marginTop: "12px" }}>
              <span className="shopx-chip shopx-chip--rating">
                {Number(product.averageRating || 0).toFixed(1)} sao ({Number(product.totalRatings || 0)} đánh giá)
              </span>
              <span className="shopx-chip shopx-chip--views">{Number(product.totalViews || 0)} lượt xem</span>
              <span className="shopx-chip shopx-chip--sold">{Number(product.totalPurchases || 0)} lượt mua</span>
            </div>

            <p className="shopx-price">{pricing.finalPrice.toLocaleString("vi-VN")} đ</p>
            {pricing.hasDiscount ? (
              <p className="shopx-old-price">{pricing.basePrice.toLocaleString("vi-VN")} đ</p>
            ) : null}

            <div className="shopx-detail-actions">
              <button
                type="button"
                disabled={isWishlistLoading}
                onClick={handleToggleWishlist}
                className={`shopx-btn shopx-btn--ghost shopx-btn--wishlist ${isWishlisted ? "shopx-btn--active" : ""}`}
              >
                {isWishlistLoading ? "Đang xử lý..." : isWishlisted ? "Đã yêu thích" : "Thêm yêu thích"}
              </button>
              <button
                type="button"
                onClick={handleAddToCart}
                className={`shopx-btn shopx-btn--primary shopx-btn--cart ${outOfStock ? "shopx-btn--out-of-stock" : ""}`}
                disabled={outOfStock}
              >
                {outOfStock ? "Hết hàng" : "Thêm vào giỏ hàng"}
              </button>
            </div>

            <p className="shopx-detail-desc">{product.description}</p>
          </div>
        </section>

        <section className="shopx-panel shopx-review-box">
          <h3 style={{ marginTop: 0 }}>Đánh giá sản phẩm</h3>

          {!auth?.token ? (
            <p className="shopx-subtitle">
              Vui lòng <Link to="/login">đăng nhập</Link> để gửi đánh giá sau khi đơn hàng đã giao.
            </p>
          ) : eligibility.canReview ? (
            <form onSubmit={handleSubmitReview} style={{ marginBottom: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 170px", gap: "10px", marginBottom: "10px" }}>
                <select
                  className="shopx-select"
                  value={reviewForm.orderId}
                  onChange={(event) => setReviewForm((prev) => ({ ...prev, orderId: event.target.value }))}
                  required
                >
                  {eligibility.availableOrders.map((order) => (
                    <option key={order._id} value={order._id}>
                      Đơn {String(order._id).slice(-8).toUpperCase()} - {new Date(order.createdAt).toLocaleDateString("vi-VN")}
                    </option>
                  ))}
                </select>
                <select
                  className="shopx-select"
                  value={reviewForm.rating}
                  onChange={(event) => setReviewForm((prev) => ({ ...prev, rating: Number(event.target.value) }))}
                >
                  <option value={5}>5 sao</option>
                  <option value={4}>4 sao</option>
                  <option value={3}>3 sao</option>
                  <option value={2}>2 sao</option>
                  <option value={1}>1 sao</option>
                </select>
              </div>

              <textarea
                className="shopx-textarea"
                rows={4}
                placeholder="Chia sẻ trải nghiệm của bạn..."
                value={reviewForm.comment}
                onChange={(event) => setReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
              />

              {reviewError ? <p className="shopx-msg shopx-msg--error">{reviewError}</p> : null}
              {reviewMessage ? <p className="shopx-msg shopx-msg--ok">{reviewMessage}</p> : null}

              <button type="submit" disabled={reviewSubmitting} className="shopx-btn shopx-btn--primary" style={{ marginTop: "10px" }}>
                {reviewSubmitting ? "Đang gửi..." : "Gửi đánh giá"}
              </button>
            </form>
          ) : (
            <p className="shopx-subtitle">Bạn chỉ có thể đánh giá sản phẩm sau khi đã nhận hàng thành công.</p>
          )}

          {reviewActionError ? <p className="shopx-msg shopx-msg--error">{reviewActionError}</p> : null}
          {reviewActionMessage ? <p className="shopx-msg shopx-msg--ok">{reviewActionMessage}</p> : null}

          <div className="shopx-review-list">
            {(product.reviews || []).length === 0 ? (
              <p className="shopx-subtitle">Chưa có đánh giá nào cho sản phẩm này.</p>
            ) : (
              (product.reviews || []).map((review) => {
                const reviewerId = String(review?.user?._id || review?.user || "");
                const isMine = currentUserId && reviewerId === currentUserId;
                const isEditing = editingReviewId === String(review._id);

                return (
                  <article key={review._id} className="shopx-review-item">
                    <div className="shopx-review-head">
                      <span className="shopx-review-name">{review.user?.name || "Người dùng"}</span>
                      <span className="shopx-chip shopx-chip--rating">{Number(review.rating || 0).toFixed(1)} sao</span>
                    </div>

                    {isEditing ? (
                      <div style={{ marginTop: "10px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "8px", marginBottom: "8px" }}>
                          <select
                            className="shopx-select"
                            value={editReviewForm.rating}
                            onChange={(event) => setEditReviewForm((prev) => ({ ...prev, rating: Number(event.target.value) }))}
                          >
                            <option value={5}>5 sao</option>
                            <option value={4}>4 sao</option>
                            <option value={3}>3 sao</option>
                            <option value={2}>2 sao</option>
                            <option value={1}>1 sao</option>
                          </select>
                          <textarea
                            className="shopx-textarea"
                            rows={3}
                            value={editReviewForm.comment}
                            onChange={(event) => setEditReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
                          />
                        </div>
                        <div className="shopx-review-actions">
                          <button
                            type="button"
                            className="shopx-btn shopx-btn--primary"
                            disabled={reviewActionLoadingId === String(review._id)}
                            onClick={() => handleUpdateReview(review._id)}
                          >
                            {reviewActionLoadingId === String(review._id) ? "Đang lưu..." : "Lưu sửa"}
                          </button>
                          <button type="button" className="shopx-btn shopx-btn--ghost" onClick={handleCancelEditReview}>
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p style={{ margin: "8px 0 6px", lineHeight: 1.6 }}>{review.comment}</p>
                        <p className="shopx-review-time">
                          {new Date(review.updatedAt || review.createdAt).toLocaleString("vi-VN")}
                        </p>

                        {isMine ? (
                          <div className="shopx-review-actions">
                            <button type="button" className="shopx-btn shopx-btn--ghost" onClick={() => handleStartEditReview(review)}>
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="shopx-btn shopx-btn--warn"
                              disabled={reviewActionLoadingId === String(review._id)}
                              onClick={() => handleDeleteReview(review._id)}
                            >
                              {reviewActionLoadingId === String(review._id) ? "Đang xóa..." : "Xóa"}
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>

        {reviewDeleteTargetId ? (
          <div className="shopx-modal-backdrop" role="dialog" aria-modal="true" aria-label="Xác nhận xóa đánh giá">
            <div className="shopx-modal-card">
              <h4 style={{ margin: "0 0 8px" }}>Xác nhận xóa đánh giá</h4>
              <p className="shopx-subtitle" style={{ marginTop: 0 }}>
                Hành động này sẽ xóa vĩnh viễn đánh giá của bạn cho sản phẩm này.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                <button
                  type="button"
                  className="shopx-btn shopx-btn--ghost"
                  onClick={() => setReviewDeleteTargetId("")}
                  disabled={reviewActionLoadingId === reviewDeleteTargetId}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="shopx-btn shopx-btn--warn"
                  onClick={handleConfirmDeleteReview}
                  disabled={reviewActionLoadingId === reviewDeleteTargetId}
                >
                  {reviewActionLoadingId === reviewDeleteTargetId ? "Đang xóa..." : "Xác nhận xóa"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default ProductDetailPage;