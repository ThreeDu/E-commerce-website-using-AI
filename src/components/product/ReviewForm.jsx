/**
 * Review submission form.
 *
 * Manages its own form state and calls the parent's onReviewSubmitted
 * callback with the API response data so the parent can update the product.
 *
 * Extracted from ProductDetailPage.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { createReview } from "../../services/productService";

function ReviewForm({ productId, eligibility, onReviewSubmitted }) {
  const { auth } = useAuth();
  const navigate = useNavigate();

  const [reviewForm, setReviewForm] = useState({
    orderId: eligibility.availableOrders[0]?._id || "",
    rating: 5,
    comment: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!auth?.token) {
      navigate("/login", { state: { from: `/products/${productId}` } });
      return;
    }

    if (!reviewForm.orderId) {
      setError("Vui lòng chọn đơn hàng đã giao để đánh giá.");
      return;
    }

    if (String(reviewForm.comment || "").trim().length < 5) {
      setError("Vui lòng nhập nhận xét tối thiểu 5 ký tự.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const data = await createReview(productId, {
        orderId: reviewForm.orderId,
        rating: Number(reviewForm.rating),
        comment: String(reviewForm.comment || "").trim(),
      }, auth.token);

      setMessage(data?.message || "Đánh giá thành công.");
      const submittedOrderId = reviewForm.orderId;
      setReviewForm({ orderId: "", rating: 5, comment: "" });

      // Notify parent to update product state
      if (onReviewSubmitted) {
        onReviewSubmitted(data, submittedOrderId);
      }
    } catch (err) {
      setError(err?.message || "Không thể kết nối tới máy chủ.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!auth?.token) {
    return (
      <p className="shopx-subtitle">
        Vui lòng <Link to="/login">đăng nhập</Link> để gửi đánh giá sau khi đơn hàng đã giao.
      </p>
    );
  }

  if (!eligibility.canReview) {
    return (
      <p className="shopx-subtitle">Bạn chỉ có thể đánh giá sản phẩm sau khi đã nhận hàng thành công.</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: "16px" }}>
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

      {error ? <p className="shopx-msg shopx-msg--error">{error}</p> : null}
      {message ? <p className="shopx-msg shopx-msg--ok">{message}</p> : null}

      <button type="submit" disabled={submitting} className="shopx-btn shopx-btn--primary" style={{ marginTop: "10px" }}>
        {submitting ? "Đang gửi..." : "Gửi đánh giá"}
      </button>
    </form>
  );
}

export default ReviewForm;
