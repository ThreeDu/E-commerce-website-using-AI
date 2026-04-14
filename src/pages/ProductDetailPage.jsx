import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import "../css/shop-experience.css";

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
      setReviewActionError("Noi dung danh gia phai toi thieu 5 ky tu.");
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
        setReviewActionError(data?.message || "Khong the cap nhat danh gia.");
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

      setReviewActionMessage("Cap nhat danh gia thanh cong.");
      handleCancelEditReview();
    } catch (error) {
      setReviewActionError("Khong the ket noi toi may chu.");
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
        setReviewActionError(data?.message || "Khong the xoa danh gia.");
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

      setReviewActionMessage("Da xoa danh gia.");
      setReviewDeleteTargetId("");
    } catch (error) {
      setReviewActionError("Khong the ket noi toi may chu.");
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

  return (
    <main className="container page-content">
      <div className="shopx-page">
        <nav className="shopx-breadcrumb" aria-label="breadcrumb">
          <ol>
            <li>
              <Link to="/">Trang chu</Link>
            </li>
            <li>/</li>
            <li>
              <Link to="/products">San pham</Link>
            </li>
            <li>/</li>
            <li aria-current="page">{product.name}</li>
          </ol>
        </nav>

        <section className="shopx-panel shopx-detail">
          <div>
            <img
              src={getProductImageSrc(product)}
              alt={product.name}
              className="shopx-detail-image"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = "/placeholder.jpg";
              }}
            />
          </div>
          <div>
            <h1 className="shopx-detail-name">{product.name}</h1>
            <p className="shopx-subtitle" style={{ marginTop: "12px" }}>
              Danh muc: <strong>{product.category}</strong>
            </p>

            <div className="shopx-meta-row" style={{ marginTop: "12px" }}>
              <span className="shopx-chip shopx-chip--rating">
                {Number(product.averageRating || 0).toFixed(1)} sao ({Number(product.totalRatings || 0)} danh gia)
              </span>
              <span className="shopx-chip shopx-chip--views">{Number(product.totalViews || 0)} luot xem</span>
              <span className="shopx-chip shopx-chip--sold">{Number(product.totalPurchases || 0)} luot mua</span>
            </div>

            <p className="shopx-price">{Number(product.price || 0).toLocaleString("vi-VN")} đ</p>
            <p className="shopx-detail-desc">{product.description}</p>

            <div className="shopx-detail-actions">
              <button
                type="button"
                disabled={isWishlistLoading}
                onClick={handleToggleWishlist}
                className={`shopx-btn shopx-btn--ghost ${isWishlisted ? "shopx-btn--active" : ""}`}
              >
                {isWishlistLoading ? "Dang xu ly..." : isWishlisted ? "Da yeu thich" : "Them yeu thich"}
              </button>
              <button type="button" onClick={handleAddToCart} className="shopx-btn shopx-btn--primary">
                Them vao gio hang
              </button>
            </div>
          </div>
        </section>

        <section className="shopx-panel shopx-review-box">
          <h3 style={{ marginTop: 0 }}>Danh gia san pham</h3>

          {!auth?.token ? (
            <p className="shopx-subtitle">
              Vui long <Link to="/login">dang nhap</Link> de gui danh gia sau khi don hang da giao.
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
                      Don {String(order._id).slice(-8).toUpperCase()} - {new Date(order.createdAt).toLocaleDateString("vi-VN")}
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
                placeholder="Chia se trai nghiem cua ban..."
                value={reviewForm.comment}
                onChange={(event) => setReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
              />

              {reviewError ? <p className="shopx-msg shopx-msg--error">{reviewError}</p> : null}
              {reviewMessage ? <p className="shopx-msg shopx-msg--ok">{reviewMessage}</p> : null}

              <button type="submit" disabled={reviewSubmitting} className="shopx-btn shopx-btn--primary" style={{ marginTop: "10px" }}>
                {reviewSubmitting ? "Dang gui..." : "Gui danh gia"}
              </button>
            </form>
          ) : (
            <p className="shopx-subtitle">Ban chi co the danh gia san pham sau khi da nhan hang thanh cong.</p>
          )}

          {reviewActionError ? <p className="shopx-msg shopx-msg--error">{reviewActionError}</p> : null}
          {reviewActionMessage ? <p className="shopx-msg shopx-msg--ok">{reviewActionMessage}</p> : null}

          <div className="shopx-review-list">
            {(product.reviews || []).length === 0 ? (
              <p className="shopx-subtitle">Chua co danh gia nao cho san pham nay.</p>
            ) : (
              (product.reviews || []).map((review) => {
                const reviewerId = String(review?.user?._id || review?.user || "");
                const isMine = currentUserId && reviewerId === currentUserId;
                const isEditing = editingReviewId === String(review._id);

                return (
                  <article key={review._id} className="shopx-review-item">
                    <div className="shopx-review-head">
                      <span className="shopx-review-name">{review.user?.name || "Nguoi dung"}</span>
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
                            {reviewActionLoadingId === String(review._id) ? "Dang luu..." : "Luu sua"}
                          </button>
                          <button type="button" className="shopx-btn shopx-btn--ghost" onClick={handleCancelEditReview}>
                            Huy
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
                              Sua
                            </button>
                            <button
                              type="button"
                              className="shopx-btn shopx-btn--warn"
                              disabled={reviewActionLoadingId === String(review._id)}
                              onClick={() => handleDeleteReview(review._id)}
                            >
                              {reviewActionLoadingId === String(review._id) ? "Dang xoa..." : "Xoa"}
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
          <div className="shopx-modal-backdrop" role="dialog" aria-modal="true" aria-label="Xac nhan xoa danh gia">
            <div className="shopx-modal-card">
              <h4 style={{ margin: "0 0 8px" }}>Xac nhan xoa danh gia</h4>
              <p className="shopx-subtitle" style={{ marginTop: 0 }}>
                Hanh dong nay se xoa vinh vien danh gia cua ban cho san pham nay.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                <button
                  type="button"
                  className="shopx-btn shopx-btn--ghost"
                  onClick={() => setReviewDeleteTargetId("")}
                  disabled={reviewActionLoadingId === reviewDeleteTargetId}
                >
                  Huy
                </button>
                <button
                  type="button"
                  className="shopx-btn shopx-btn--warn"
                  onClick={handleConfirmDeleteReview}
                  disabled={reviewActionLoadingId === reviewDeleteTargetId}
                >
                  {reviewActionLoadingId === reviewDeleteTargetId ? "Dang xoa..." : "Xac nhan xoa"}
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