import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";

function ChatSessionSidebar({ auth, handleDeleteSession, handleSelectSession, handleStartNewChat, isSidebarOpen, sessionId, sessions, setIsSidebarOpen }) {
  return (
    <aside
      className={`w-64 sm:w-72 bg-slate-900 border-r border-slate-800 text-slate-200 flex flex-col shrink-0 h-full md:relative md:translate-x-0 z-[1200] transition-transform duration-200 ease-out shadow-xl md:shadow-none ${
        isSidebarOpen ? 'fixed inset-y-0 left-0 translate-x-0' : 'fixed inset-y-0 left-0 -translate-x-full'
      }`}
    >
      {/* Sidebar Header with New Chat Button */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={handleStartNewChat}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white transition-all shadow-xs cursor-pointer border-none"
        >
          <FontAwesomeIcon icon={faPlus} />
          <span>Đoạn chat mới</span>
        </button>

        <button
          type="button"
          onClick={() => setIsSidebarOpen(false)}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer border-none"
          aria-label="Đóng sidebar"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">
          Lịch sử hội thoại
        </p>

        {sessions.length === 0 ? (
          <p className="text-xs text-slate-400 italic px-2 py-4">Chưa có cuộc trò chuyện nào</p>
        ) : (
          sessions.map((sess) => {
            const isActive = sess.sessionId === sessionId;
            return (
              <div
                key={sess.sessionId}
                onClick={() => handleSelectSession(sess.sessionId)}
                className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-blue-600/20 text-white font-semibold border-l-2 border-blue-500'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <span className="text-xs truncate pr-6 max-w-[200px]" title={sess.title}>
                  {sess.title}
                </span>

                <button
                  type="button"
                  onClick={(e) => handleDeleteSession(e, sess.sessionId)}
                  title="Xóa phiên trò chuyện"
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg border-none bg-transparent cursor-pointer transition-opacity text-slate-400 hover:text-rose-400"
                >
                  <FontAwesomeIcon icon={faTrash} className="text-[10px]" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="p-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
          {auth.user?.name?.charAt(0).toUpperCase() || 'AD'}
        </div>
        <div className="truncate min-w-0">
          <p className="m-0 text-xs font-semibold text-slate-200 truncate leading-tight">
            {auth.user?.name || 'Administrator'}
          </p>
          <p className="m-0 text-[10px] text-slate-400 truncate leading-tight mt-0.5">
            {auth.user?.email}
          </p>
        </div>
      </div>
    </aside>
  );
}

export default ChatSessionSidebar;
