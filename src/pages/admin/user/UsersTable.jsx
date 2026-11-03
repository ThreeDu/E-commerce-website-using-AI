import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faCoins, faKey, faTrash } from "@fortawesome/free-solid-svg-icons";

function UsersTable({ cancelEdit, currentUserId, editForm, editingUserId, formatDateTime, handleEditChange, handleSaveEdit, handleStartEditPassword, handleStartEditPoints, handleToggleRole, list, setUserPendingDelete, startEdit, tableDescription, tableTitle }) {
  return (
    <div className="mt-5">
      <div className="mb-2">
        <h3 className="m-0 text-base font-bold text-admin-ink">{tableTitle}</h3>
        <p className="m-0 mt-1 text-admin-muted text-xs font-medium">{tableDescription}</p>
      </div>

      <div className="border border-[#dde7f3] rounded-2xl overflow-hidden bg-white w-full max-w-full shadow-xs mt-3">
        <div className="w-full max-w-full overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed bg-white">
            <thead>
              <tr className="bg-[#f2f7ff] text-[#4a5c75] [&>th]:p-3 [&>th]:font-bold [&>th]:text-xs [&>th]:uppercase [&>th]:tracking-wider [&>th]:border-b [&>th]:border-admin-line">
                <th className="w-[18%]">Họ tên</th>
                <th className="w-[20%]">Email</th>
                <th className="w-[8%]">Điểm</th>
                <th className="w-[8%]">Vai trò</th>
                <th className="w-[16%]">Ngày tạo</th>
                <th className="w-[30%]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-line">
              {list.map((user) => (
                <tr key={user._id} className="transition-colors hover:bg-[#f8fbff] [&>td]:p-3 [&>td]:align-middle">
                  <td className="whitespace-normal break-words font-semibold text-admin-ink">
                    {editingUserId === user._id ? (
                      <input
                        className="w-full border border-admin-line rounded-lg p-1.5 text-sm bg-white focus:outline-none focus:border-admin-primary"
                        name="name"
                        value={editForm.name}
                        onChange={handleEditChange}
                      />
                  ) : (
                    user.name
                  )}
                </td>
                <td className="truncate text-admin-muted text-sm">
                  {editingUserId === user._id ? (
                    <input
                      className="w-full border border-admin-line rounded-lg p-1.5 text-sm bg-white focus:outline-none focus:border-admin-primary"
                      name="email"
                      value={editForm.email}
                      onChange={handleEditChange}
                    />
                  ) : (
                    user.email
                  )}
                </td>
                <td className="truncate text-admin-ink font-semibold">
                  {(user.loyaltyPoints || 0).toLocaleString("vi-VN")}
                </td>
                <td>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer select-none transition-all duration-200 hover:-translate-y-px active:translate-y-0 ${
                      user.role === "admin"
                        ? "bg-[#e8f1ff] text-blue-700 border-[#bcd2ff] hover:shadow-[0_4px_10px_rgba(29,78,216,0.15)]"
                        : "bg-[#e7f9ef] text-admin-success border-[#bfe8d1] hover:shadow-[0_4px_10px_rgba(22,101,52,0.15)]"
                    } ${
                      String(user._id) === String(currentUserId)
                        ? "opacity-65 pointer-events-none hover:translate-y-0 hover:shadow-none"
                        : ""
                    }`}
                    onClick={() => String(user._id) !== String(currentUserId) && handleToggleRole(user)}
                    title={
                      String(user._id) === String(currentUserId)
                        ? "Không thể tự thay đổi vai trò của chính mình"
                        : "Click để thay đổi vai trò"
                    }
                  >
                    {user.role}
                  </span>
                </td>
                <td>{formatDateTime(user.createdAt)}</td>
                <td>
                  {editingUserId === user._id ? (
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(user._id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold text-xs transition-colors duration-150 text-[#0f766e] border-[#99f6e4] bg-[#f0fdfa] hover:bg-[#ccfbf1] hover:border-[#5eead4] hover:text-[#0d9488]"
                      >
                        Lưu
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold text-xs transition-colors duration-150 text-[#475569] border-[#cbd5e1] bg-[#f8fafc] hover:bg-[#f1f5f9] hover:border-[#94a3b8] hover:text-[#0f172a]"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => startEdit(user)}
                        title="Sửa thông tin"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold text-xs transition-colors duration-150 text-[#475569] border-[#cbd5e1] bg-[#f8fafc] hover:bg-[#f1f5f9] hover:border-[#94a3b8] hover:text-[#0f172a]"
                      >
                        <FontAwesomeIcon icon={faPen} /> Sửa
                      </button>
                      {user.role !== "admin" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEditPoints(user)}
                            title="Điều chỉnh điểm tích lũy"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold text-xs transition-colors duration-150 text-[#0f766e] border-[#99f6e4] bg-[#f0fdfa] hover:bg-[#ccfbf1] hover:border-[#5eead4] hover:text-[#0d9488]"
                          >
                            <FontAwesomeIcon icon={faCoins} /> Điểm
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditPassword(user)}
                            title="Đặt lại mật khẩu"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold text-xs transition-colors duration-150 text-[#4338ca] border-[#c7d2fe] bg-[#eef2ff] hover:bg-[#e0e7ff] hover:border-[#a5b4fc] hover:text-[#4f46e5]"
                          >
                            <FontAwesomeIcon icon={faKey} /> Mật khẩu
                          </button>
                        </>
                      )}
                      {String(user._id) === String(currentUserId) ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold text-xs transition-colors duration-150 text-[#b91c1c] border-[#fca5a5] bg-[#fef2f2] opacity-70 cursor-not-allowed"
                          disabled
                        >
                          Hiện tại
                        </button>
                      ) : user.role === "admin" ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold text-xs transition-colors duration-150 text-[#b91c1c] border-[#fca5a5] bg-[#fef2f2] opacity-70 cursor-not-allowed"
                          disabled
                        >
                          Admin
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold text-xs transition-colors duration-150 text-[#b91c1c] border-[#fca5a5] bg-[#fef2f2] hover:bg-[#fee2e2] hover:border-[#f87171] hover:text-[#991b1b]"
                          onClick={() => setUserPendingDelete(user)}
                          title="Xóa người dùng"
                        >
                          <FontAwesomeIcon icon={faTrash} /> Xóa
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center! text-admin-muted p-6!">
                  Không có dữ liệu ở nhóm này.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}

export default UsersTable;
