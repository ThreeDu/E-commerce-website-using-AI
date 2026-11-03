import Modal from "../../../components/common/Modal";

function UserPointsModal({ handleSavePoints, newPoints, pointsReason, setNewPoints, setPointsReason, setUserPendingPoints, updatingPoints, userPendingPoints }) {
  if (!userPendingPoints) {
    return null;
  }

  return (
    <Modal>
      <div className="w-full max-w-[500px] bg-white rounded-2xl p-5 shadow-modal" role="dialog" aria-modal="true" aria-labelledby="points-modal-title">
        <h3 id="points-modal-title" className="m-0 mb-1 text-lg font-bold text-admin-ink">
          Điều chỉnh điểm tích lũy
        </h3>
        <p className="m-0 mb-4 text-sm text-admin-muted">
          Cập nhật điểm thưởng cho tài khoản: <strong>{userPendingPoints.email}</strong>
        </p>

        <div className="grid gap-3.5 mb-5">
          <div className="flex justify-between items-center bg-[#f8fbff] p-3 border border-[#dde7f4] rounded-xl">
            <span className="text-admin-muted text-xs font-bold uppercase tracking-wider">Điểm hiện tại</span>
            <span className="text-base font-bold text-admin-ink">
              {(userPendingPoints.loyaltyPoints || 0).toLocaleString("vi-VN")} điểm
            </span>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="new-points-input" className="text-admin-muted text-xs font-bold uppercase tracking-wider">
              Điểm mới
            </label>
            <input
              id="new-points-input"
              type="number"
              min="0"
              className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
              placeholder="Nhập số điểm mới..."
              value={newPoints}
              onChange={(e) => setNewPoints(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="points-reason-input" className="text-admin-muted text-xs font-bold uppercase tracking-wider">
              Lý do thay đổi
            </label>
            <textarea
              id="points-reason-input"
              rows="3"
              className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] resize-y"
              placeholder="Nhập lý do điều chỉnh điểm (ví dụ: Tặng điểm sinh nhật, sửa lỗi giao dịch...)"
              value={pointsReason}
              onChange={(e) => setPointsReason(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            className="px-4 py-2 rounded-xl border border-[#cdd9e8] bg-[#f9fbfe] text-[#5f6f85] font-bold text-sm cursor-pointer transition-colors duration-150 hover:bg-[#eef4fb]"
            onClick={() => setUserPendingPoints(null)}
            disabled={updatingPoints}
          >
            Hủy
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-admin-primary text-white font-bold text-sm cursor-pointer transition-colors duration-150 hover:bg-teal-800"
            onClick={handleSavePoints}
            disabled={updatingPoints}
          >
            {updatingPoints ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default UserPointsModal;
