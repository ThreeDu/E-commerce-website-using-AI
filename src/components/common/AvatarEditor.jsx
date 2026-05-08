import { useEffect, useRef, useState } from "react";
import { uploadAvatar } from "../../services/avatarService";

function AvatarEditor({
  currentAvatar,
  userName,
  onAvatarUpdated,
  token,
  showError,
  showSuccess,
  compact = false,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [preview, setPreview] = useState(currentAvatar || "");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setPreview(currentAvatar || "");
  }, [currentAvatar]);

  const handleFileSelect = (e) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      showError("Vui lòng chọn tệp hình ảnh hợp lệ.");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showError("Hình ảnh quá lớn (tối đa 2MB).");
      return;
    }

    setIsEditing(true);

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.currentTarget.result;
      setPreview(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!preview) {
      showError("Vui lòng chọn hình ảnh.");
      return;
    }

    setIsUploading(true);
    try {
      const response = await uploadAvatar(preview, token);
      if (response?.user?.avatar) {
        setIsEditing(false);
        showSuccess("Avatar cập nhật thành công!");
        if (onAvatarUpdated) {
          onAvatarUpdated(response.user);
        }
      }
    } catch (err) {
      showError(err?.message || "Không thể cập nhật avatar.");
      setPreview(currentAvatar || "");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setPreview(currentAvatar || "");
  };

  return (
    <div className={`avatar-editor ${compact ? "avatar-editor--compact" : ""}`}>
      {/* Hidden file input - ALWAYS rendered so ref is always available */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: "none" }}
        aria-hidden="true"
      />

      <div className="avatar-display">
        <img
          src={preview || currentAvatar || "/placeholder-avatar.svg"}
          alt={userName || "Avatar"}
          className="avatar-image"
          onError={(e) => {
            e.currentTarget.src = "/placeholder-avatar.svg";
          }}
        />
        <button
          type="button"
          className="avatar-camera-btn"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Thay đổi ảnh đại diện"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path fill="currentColor" d="M9 3 7.5 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.5L15 3H9Zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" />
          </svg>
        </button>
      </div>

      {isEditing && (
        <div className="avatar-editor-panel">
          <div className="avatar-editor-preview">
            <img
              src={preview || "/placeholder-avatar.svg"}
              alt="Preview"
              className="avatar-preview-image"
              onError={(e) => {
                e.currentTarget.src = "/placeholder-avatar.svg";
              }}
            />
          </div>

          <div className="avatar-editor-controls">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              Chọn ảnh
            </button>

            <div className="avatar-editor-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSave}
                disabled={isUploading || !preview}
              >
                {isUploading ? "Đang cập nhật..." : "Lưu"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCancel}
                disabled={isUploading}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AvatarEditor;
