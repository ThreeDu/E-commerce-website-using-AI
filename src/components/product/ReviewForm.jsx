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
      <p className="text-shop-muted text-sm leading-[1.55]">
        Vui lòng <Link to="/login" className="text-shop-primary font-bold hover:underline">đăng nhập</Link> để gửi đánh giá sau khi đơn hàng đã giao.
      </p>
    );
  }

  if (!eligibility.canReview) {
    return (
      <p className="text-shop-muted text-sm leading-[1.55]">Bạn chỉ có thể đánh giá sản phẩm sau khi đã nhận hàng thành công.</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4">
      <div className="grid grid-cols-[1fr_170px] gap-2.5 mb-2.5 max-[480px]:grid-cols-1">
        <select
          className="w-full border border-shop-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-shop-primary"
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
          className="w-full border border-shop-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-shop-primary"
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
        className="w-full border border-shop-line rounded-xl p-[10px_11px] text-sm bg-white resize-y focus:outline-none focus:border-shop-primary"
        rows={4}
        placeholder="Chia sẻ trải nghiệm của bạn..."
        value={reviewForm.comment}
        onChange={(event) => setReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
      />

      {error ? <p className="mt-2 text-[13px] text-[#b91c1c]">{error}</p> : null}
      {message ? <p className="mt-2 text-[13px] text-shop-success">{message}</p> : null}

      <button type="submit" disabled={submitting} className="rounded-[14px] border border-shop-line bg-white text-shop-ink px-3 py-2.5 text-sm font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-xs hover:bg-[#f0f6ff] disabled:cursor-not-allowed disabled:opacity-70 mt-2.5">
        {submitting ? "Đang gửi..." : "Gửi đánh giá"}
      </button>
    </form>
  );
}

export default ReviewForm;
