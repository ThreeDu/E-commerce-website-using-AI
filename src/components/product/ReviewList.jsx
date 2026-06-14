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
      {actionError ? <p className="mt-2 text-[13px] text-[#b91c1c]">{actionError}</p> : null}
      {actionMessage ? <p className="mt-2 text-[13px] text-shop-success">{actionMessage}</p> : null}

      <div className="grid gap-2.5 mt-3">
        {reviews.length === 0 ? (
          <p className="text-shop-muted text-sm leading-[1.55]">Chưa có đánh giá nào cho sản phẩm này.</p>
        ) : (
          reviews.map((review) => {
            const reviewerId = String(review?.user?._id || review?.user || "");
            const isMine = currentUserId && reviewerId === currentUserId;
            const isEditing = editingReviewId === String(review._id);

            return (
              <article key={review._id} className="border border-[rgba(148,163,184,0.22)] rounded-[18px] bg-gradient-to-b from-white to-[#f8fbff] p-4.5 shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                <div className="flex justify-between items-start gap-2.5 flex-wrap mb-3 pb-3 border-b border-[rgba(148,163,184,0.12)]">
                  <span className="font-extrabold text-shop-ink text-[15px]">{review.user?.name || "Người dùng"}</span>
                  <span className="inline-flex items-center rounded-full border border-shop-line px-2.5 py-1 text-xs font-bold bg-[#fff5d9] text-[#92400e]">{Number(review.rating || 0).toFixed(1)} sao</span>
                </div>

                {isEditing ? (
                  <div className="mt-2.5">
                    <div className="grid grid-cols-[140px_1fr] gap-2 mb-2 max-[480px]:grid-cols-1">
                      <select
                        className="w-full border border-shop-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-shop-primary"
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
                        className="w-full border border-shop-line rounded-xl p-[10px_11px] text-sm bg-white resize-y focus:outline-none focus:border-shop-primary"
                        rows={3}
                        value={editReviewForm.comment}
                        onChange={(event) => setEditReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
                      />
                    </div>
                    <div className="mt-3 flex gap-2 pt-3 border-t border-[rgba(148,163,184,0.12)]">
                      <button
                        type="button"
                        className="rounded-[14px] border border-shop-line bg-white text-shop-ink px-3 py-2 text-sm font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-xs hover:bg-[#f0f6ff] disabled:cursor-not-allowed disabled:opacity-70"
                        disabled={actionLoadingId === String(review._id)}
                        onClick={() => handleUpdate(review._id)}
                      >
                        {actionLoadingId === String(review._id) ? "Đang lưu..." : "Lưu sửa"}
                      </button>
                      <button type="button" className="rounded-[14px] border border-shop-line bg-white text-[#1d1d1f] px-3 py-2 text-sm font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-xs hover:bg-shop-bg disabled:cursor-not-allowed disabled:opacity-70" onClick={handleCancelEdit}>
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="m-0 mt-2 mb-1.5 text-shop-ink leading-1.6">{review.comment}</p>
                    <p className="text-xs text-shop-muted">
                      {new Date(review.updatedAt || review.createdAt).toLocaleString("vi-VN")}
                    </p>

                    {isMine ? (
                      <div className="mt-3 flex gap-2 pt-3 border-t border-[rgba(148,163,184,0.12)]">
                        <button type="button" className="rounded-[14px] border border-shop-line bg-white text-[#1d1d1f] px-3 py-2 text-sm font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-xs hover:bg-shop-bg disabled:cursor-not-allowed disabled:opacity-70" onClick={() => handleStartEdit(review)}>
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-[rgba(180,83,83,0.18)] bg-[#fee2e2] text-[#b91c1c] px-3 py-2 text-xs font-bold cursor-pointer transition-all duration-150 hover:bg-[#fecaca] hover:border-[rgba(180,83,83,0.28)] disabled:cursor-not-allowed"
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
