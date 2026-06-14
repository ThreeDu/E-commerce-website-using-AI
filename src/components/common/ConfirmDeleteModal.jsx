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
    <div className="fixed inset-0 z-[1200] p-[18px] bg-[rgba(15,23,42,0.55)] flex items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-[min(460px,100%)] bg-white rounded-[22px] border border-shop-line shadow-shop p-4">
        <h4 className="m-0 mb-2">{title}</h4>
        <p className="mt-0 text-shop-muted text-sm leading-[1.55]">
          {message}
        </p>
        <div className="flex justify-end gap-2 mt-2.5">
          <button
            type="button"
            className="rounded-[14px] border border-shop-line py-2.5 px-3 font-sans text-sm font-bold cursor-pointer transition-all duration-150 bg-white text-shop-ink hover:translate-y-[-1px] hover:shadow-card disabled:cursor-not-allowed disabled:opacity-70"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rounded-xl border border-[rgba(180,83,83,0.18)] py-2 px-3 text-xs font-bold cursor-pointer transition-all duration-150 bg-red-100 text-red-700 hover:bg-red-200 hover:border-[rgba(180,83,83,0.28)] disabled:cursor-not-allowed disabled:opacity-70"
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
