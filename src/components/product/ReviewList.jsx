/**
 * Review list with inline edit / delete support.
 *
 * Manages its own editing and delete-confirmation state.
 * Calls parent callbacks to update the product when reviews change.
 *
 * Extracted from ProductDetailPage.
 */
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { updateReview, deleteReview } from "../../services/productService";
import ConfirmDeleteModal from "../common/ConfirmDeleteModal";

function ReviewList({ reviews, productId, onReviewUpdated, onReviewDeleted }) {
  const { auth } = useAuth();
  const currentUserId = String(auth?.user?.id || auth?.user?._id || "");

  const [editingReviewId, setEditingReviewId] = useState("");
  const [editReviewForm, setEditReviewForm] = useState({ rating: 5, comment: "" });
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState("");

  const handleStartEdit = (review) => {
    setEditingReviewId(String(review?._id || ""));
    setEditReviewForm({
      rating: Number(review?.rating || 5),
      comment: String(review?.comment || ""),
    });
    setActionError("");
    setActionMessage("");
  };

  const handleCancelEdit = () => {
    setEditingReviewId("");
    setEditReviewForm({ rating: 5, comment: "" });
  };

  const handleUpdate = async (reviewId) => {
    const trimmedComment = String(editReviewForm.comment || "").trim();
    if (trimmedComment.length < 5) {
      setActionError("Nội dung đánh giá phải tối thiểu 5 ký tự.");
      return;
    }

    setActionLoadingId(String(reviewId));
    setActionError("");
    setActionMessage("");
    try {
      const data = await updateReview(productId, reviewId, {
        rating: Number(editReviewForm.rating),
        comment: trimmedComment,
      }, auth.token);

      setActionMessage("Cập nhật đánh giá thành công.");
      handleCancelEdit();

      if (onReviewUpdated) {
        onReviewUpdated(data, reviewId, editReviewForm);
      }
    } catch (error) {
      setActionError(error?.message || "Không thể kết nối tới máy chủ.");
    } finally {
      setActionLoadingId("");
    }
  };

  const handleConfirmDelete = async () => {
    const reviewId = String(deleteTargetId || "").trim();
    if (!reviewId) {
      return;
    }

    setActionLoadingId(String(reviewId));
    setActionError("");
    setActionMessage("");
    try {
      const data = await deleteReview(productId, reviewId, auth.token);

      setActionMessage("Đã xóa đánh giá.");
      setDeleteTargetId("");

      if (onReviewDeleted) {
        onReviewDeleted(data, reviewId);
      }
    } catch (error) {
      setActionError(error?.message || "Không thể kết nối tới máy chủ.");
    } finally {
      setActionLoadingId("");
    }
  };

  return (
    <>
      {actionError ? <p className="shopx-msg shopx-msg--error">{actionError}</p> : null}
      {actionMessage ? <p className="shopx-msg shopx-msg--ok">{actionMessage}</p> : null}

      <div className="shopx-review-list">
        {reviews.length === 0 ? (
          <p className="shopx-subtitle">Chưa có đánh giá nào cho sản phẩm này.</p>
        ) : (
          reviews.map((review) => {
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
                        disabled={actionLoadingId === String(review._id)}
                        onClick={() => handleUpdate(review._id)}
                      >
                        {actionLoadingId === String(review._id) ? "Đang lưu..." : "Lưu sửa"}
                      </button>
                      <button type="button" className="shopx-btn shopx-btn--ghost" onClick={handleCancelEdit}>
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
                        <button type="button" className="shopx-btn shopx-btn--ghost" onClick={() => handleStartEdit(review)}>
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="shopx-btn shopx-btn--warn"
                          disabled={actionLoadingId === String(review._id)}
                          onClick={() => setDeleteTargetId(String(review._id))}
                        >
                          {actionLoadingId === String(review._id) ? "Đang xóa..." : "Xóa"}
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

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTargetId)}
        title="Xác nhận xóa đánh giá"
        message="Hành động này sẽ xóa vĩnh viễn đánh giá của bạn cho sản phẩm này."
        isLoading={actionLoadingId === deleteTargetId}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId("")}
        confirmLabel="Xác nhận xóa"
      />
    </>
  );
}

export default ReviewList;
