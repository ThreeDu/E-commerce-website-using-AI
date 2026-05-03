/**
 * Reusable confirmation modal dialog.
 *
 * Props:
 * - isOpen       {boolean}  Whether the modal is visible
 * - title        {string}   Modal heading
 * - message      {string}   Body text
 * - isLoading    {boolean}  Disables buttons while an action is in progress
 * - onConfirm    {function} Called when user confirms
 * - onCancel     {function} Called when user cancels
 * - confirmLabel {string}   Custom label for confirm button (default: "Xác nhận")
 * - cancelLabel  {string}   Custom label for cancel button (default: "Hủy")
 */
function ConfirmDeleteModal({
  isOpen,
  title = "Xác nhận",
  message = "Bạn có chắc chắn muốn thực hiện hành động này?",
  isLoading = false,
  onConfirm,
  onCancel,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="shopx-modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="shopx-modal-card">
        <h4 style={{ margin: "0 0 8px" }}>{title}</h4>
        <p className="shopx-subtitle" style={{ marginTop: 0 }}>
          {message}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
          <button
            type="button"
            className="shopx-btn shopx-btn--ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="shopx-btn shopx-btn--warn"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Đang xử lý..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDeleteModal;
