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
    <div className={compact ? "relative flex flex-col items-center gap-4" : "m-0 p-6 bg-white rounded-2xl border border-[#e5e7eb]/20 shadow-card flex flex-col items-center gap-6"}>
      {/* Hidden file input - ALWAYS rendered so ref is always available */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: "none" }}
        aria-hidden="true"
      />

      {compact ? (
        <div className="relative w-[120px] h-[120px]">
          <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-[#ddd6fe] to-[#bfdbfe] flex items-center justify-center border-2 border-white shadow-[0_14px_36px_-6px_rgba(99,102,241,0.35),0_10px_20px_-8px_rgba(99,102,241,0.25)]">
            <img
              src={preview || currentAvatar || "/placeholder-avatar.svg"}
              alt={userName || "Avatar"}
              className="w-full h-full object-cover rounded-full"
              onError={(e) => {
                e.currentTarget.src = "/placeholder-avatar.svg";
              }}
            />
          </div>
          <button
            type="button"
            className="absolute bottom-0.5 right-0.5 w-8 h-8 rounded-lg bg-white border border-[#cbd5e1] text-[#1f2937] flex items-center justify-center cursor-pointer transition-all hover:bg-[#f8fafc] shadow-[0_4px_10px_rgba(0,0,0,0.08)] z-10 hover:scale-105"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Thay đổi ảnh đại diện"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
              <path fill="currentColor" d="M9 3 7.5 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.5L15 3H9Zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-6">
          <img
            src={preview || currentAvatar || "/placeholder-avatar.svg"}
            alt={userName || "Avatar"}
            className="w-[140px] h-[140px] rounded-full object-cover border-3 border-[#e5e7eb] shadow-md"
            onError={(e) => {
              e.currentTarget.src = "/placeholder-avatar.svg";
            }}
          />
          <button
            type="button"
            className="absolute bottom-[-8px] right-[-8px] w-10 h-10 rounded-full bg-profile-primary border-3 border-white text-white flex items-center justify-center cursor-pointer transition-all hover:bg-profile-primary-light hover:scale-110 shadow-md z-10"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Thay đổi ảnh đại diện"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path fill="currentColor" d="M9 3 7.5 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.5L15 3H9Zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" />
            </svg>
          </button>
        </div>
      )}

      {isEditing && (
        <div 
          className={compact ? "absolute top-[140px] left-1/2 -translate-x-1/2 bg-white rounded-2xl border border-[#f3f4f6] shadow-lg p-6 flex flex-col gap-6 z-20 min-w-[240px]" : "w-full max-w-[450px] flex flex-col gap-6 p-6 bg-white rounded-2xl border border-[#f3f4f6] shadow-md"}
          style={compact ? { animation: "slideDown 0.2s ease" } : undefined}
        >
          <div className={compact ? "flex justify-center p-4 bg-[#f3f4f6] rounded-xl" : "flex justify-center p-6 bg-[#f3f4f6] rounded-xl"}>
            <img
              src={preview || "/placeholder-avatar.svg"}
              alt="Preview"
              className={compact ? "w-[120px] h-[120px] rounded-2xl object-cover border-2 border-[#e5e7eb] shadow-sm" : "w-[180px] h-[180px] rounded-2xl object-cover border-3 border-[#e5e7eb] shadow-md"}
              onError={(e) => {
                e.currentTarget.src = "/placeholder-avatar.svg";
              }}
            />
          </div>

          <div className="flex flex-col gap-4">
            <button
              type="button"
              className="bg-[#f3f4f6] text-[#1f2937] border border-[#e5e7eb] font-bold rounded-xl py-3 px-4 transition-all hover:bg-[#f3f4f6] hover:border-profile-primary disabled:bg-[#f3f4f6] disabled:text-[#6b7280] disabled:cursor-not-allowed text-xs font-semibold uppercase tracking-wider cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              Chọn ảnh
            </button>

            <div className={compact ? "flex flex-col gap-2" : "flex gap-4 justify-center"}>
              <button
                type="button"
                className="bg-profile-primary text-white font-bold rounded-xl py-3 px-4 transition-all hover:bg-profile-primary-light hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(99,102,241,0.3)] disabled:bg-gray-300 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex-1 text-xs font-semibold uppercase tracking-wider cursor-pointer"
                onClick={handleSave}
                disabled={isUploading || !preview}
              >
                {isUploading ? "Đang cập nhật..." : "Lưu"}
              </button>
              <button
                type="button"
                className="bg-[#f3f4f6] text-[#1f2937] border border-[#e5e7eb] font-bold rounded-xl py-3 px-4 transition-all hover:bg-[#f3f4f6] hover:border-profile-primary disabled:bg-[#f3f4f6] disabled:text-[#6b7280] disabled:cursor-not-allowed flex-1 text-xs font-semibold uppercase tracking-wider cursor-pointer"
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
