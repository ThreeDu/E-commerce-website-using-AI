import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRobot,
  faPaperPlane,
  faTrash,
  faClock,
  faPlus,
  faBars,
  faXmark
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../context/AuthContext';

function AdminChatbotPage() {
  const { auth } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    return sessionStorage.getItem('admin_chatbot_sid') || crypto.randomUUID();
  });
  const [sessions, setSessions] = useState([]);
  const [activeTitle, setActiveTitle] = useState('Trợ lý AI Quản Trị');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Sync session ID to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('admin_chatbot_sid', sessionId);
  }, [sessionId]);

  // Load chat sessions and current session detail on mount
  useEffect(() => {
    if (auth?.token) {
      fetchSessions();
      loadActiveSessionDetail(sessionId);
    }
  }, [auth?.token]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/admin/chatbot/sessions', {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách phiên chat:', err);
    }
  };

  const loadActiveSessionDetail = async (sid) => {
    try {
      const res = await fetch(`/api/admin/chatbot/sessions/${sid}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages || []);
        setSessionId(data.sessionId);
        if (data.title) {
          setActiveTitle(data.title);
        }
      } else {
        // If not found, start a new blank session
        setMessages([]);
        setActiveTitle('Trợ lý AI Quản Trị');
      }
    } catch (err) {
      console.error('Lỗi khi tải chi tiết phiên chat:', err);
    }
  };

  const handleSelectSession = async (sid) => {
    setIsSidebarOpen(false);
    setIsLoading(true);
    await loadActiveSessionDetail(sid);
    setIsLoading(false);
  };

  const handleDeleteSession = async (e, sid) => {
    e.stopPropagation(); // prevent clicking/selecting session
    if (!window.confirm('Bạn có chắc chắn muốn xóa cuộc trò chuyện này?')) return;

    try {
      const res = await fetch(`/api/admin/chatbot/sessions/${sid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setSessions((prev) => prev.filter((s) => s.sessionId !== sid));
        if (sessionId === sid) {
          handleStartNewChat();
        }
      }
    } catch (err) {
      console.error('Lỗi khi xóa phiên chat:', err);
    }
  };

  const handleStartNewChat = () => {
    const newSid = crypto.randomUUID();
    setSessionId(newSid);
    setMessages([]);
    setActiveTitle('Trợ lý AI Quản Trị');
    setIsSidebarOpen(false);
  };

  const sendMessage = async (text, confirmed = false, confirmationData = null) => {
    if (!text?.trim() && !confirmed) return;

    const userMsg = confirmed ? null : { role: 'user', content: text.trim() };
    if (userMsg) {
      setMessages((prev) => [...prev, userMsg]);
    }
    setInput('');
    setIsLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const history = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }))
        .slice(-10);

      const body = {
        message: confirmed ? confirmationData?.originalMessage || '' : text.trim(),
        history,
        sessionId,
      };
      if (confirmed && confirmationData) {
        body.confirmed = true;
        body.confirmationData = confirmationData;
      }

      setMessages((prev) => prev.filter((m) => m.role !== 'confirmation'));

      // Create stream placeholder for assistant message
      const streamMsgId = `stream_${Date.now()}`;
      setMessages((prev) => [...prev, { role: 'assistant', content: '', id: streamMsgId, streaming: true }]);

      const res = await fetch('/api/admin/chatbot/message/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamMsgId ? { ...m, content: 'Đã xảy ra lỗi kết nối.', streaming: false } : m
          )
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            var currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const payload = JSON.parse(line.slice(6));

              if (currentEvent === 'token' && payload.text) {
                streamedText += payload.text;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === streamMsgId ? { ...m, content: streamedText } : m
                  )
                );
              } else if (currentEvent === 'tools' && Array.isArray(payload.toolsUsed)) {
                for (const tool of payload.toolsUsed) {
                  setMessages((prev) => [
                    ...prev.filter((m) => m.id !== streamMsgId),
                    { role: 'tool', content: `Đã thực hiện: ${tool.name}`, toolName: tool.name },
                    prev.find((m) => m.id === streamMsgId),
                  ]);
                }
              } else if (currentEvent === 'confirmation' && payload) {
                setMessages((prev) => [
                  ...prev.filter((m) => m.id !== streamMsgId),
                  {
                    role: 'confirmation',
                    content: payload.description || 'Xác nhận thao tác?',
                    confirmationData: { ...payload, originalMessage: text?.trim() },
                  },
                ]);
              }
            } catch { /* skip unparseable */ }
            currentEvent = null;
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamMsgId
            ? { ...m, content: streamedText || 'Đã xử lý xong.', streaming: false }
            : m
        )
      );

      await fetchSessions();
      if (messages.length === 0 && !confirmed) {
        const title = text.trim().length > 40 ? text.trim().substring(0, 40) + '...' : text.trim();
        setActiveTitle(title);
      }
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.streaming
            ? { ...m, content: 'Không thể kết nối tới server.', streaming: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleConfirm = (confirmationData) => {
    sendMessage('', true, confirmationData);
  };

  const handleCancelConfirm = () => {
    setMessages((prev) => prev.filter((m) => m.role !== 'confirmation'));
    setMessages((prev) => [...prev, { role: 'assistant', content: 'Đã hủy thao tác.' }]);
  };

  const suggestions = [
    'Doanh thu hôm nay bao nhiêu?',
    'Kiểm tra đơn hàng pending',
    'Sản phẩm nào sắp hết hàng?',
    'Xem lịch sử log hệ thống gần nhất',
  ];

  if (!auth || auth.user?.role !== 'admin') return null;

  return (
    <main className="w-full h-screen bg-[#17212b] text-[#d0dbe8] flex overflow-hidden relative">
      {/* Mobile Drawer Overlay Backdrop */}
      {isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="hidden max-[768px]:block fixed inset-0 bg-black/60 z-[1190] border-none outline-none cursor-default"
        />
      )}

      {/* Left Panel: Chat sessions history sidebar */}
      <aside
        className={`w-[260px] bg-[#1a2736] border-r border-white/5 flex flex-col shrink-0 h-full max-[768px]:fixed max-[768px]:inset-y-0 max-[768px]:left-0 max-[768px]:z-[1200] transition-transform duration-200 ease-out ${
          isSidebarOpen ? 'max-[768px]:translate-x-0' : 'max-[768px]:-translate-x-full'
        }`}
      >
        {/* Sidebar Header with New Chat Button */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <button
            onClick={handleStartNewChat}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-white/10 bg-white/[0.04] text-xs font-bold text-white cursor-pointer hover:bg-white/[0.08] transition-all hover:scale-[1.02]"
          >
            <FontAwesomeIcon icon={faPlus} />
            Trò chuyện mới
          </button>
          
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="hidden max-[768px]:flex ml-2 w-9 h-9 rounded-xl border-none items-center justify-center bg-white/[0.04] text-white/50 cursor-pointer"
            aria-label="Đóng sidebar"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin scrollbar-acb">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider px-2 mb-2">Lịch sử hội thoại</p>
          
          {sessions.length === 0 ? (
            <p className="text-[11px] text-white/30 italic px-2">Chưa có cuộc trò chuyện nào</p>
          ) : (
            sessions.map((sess) => {
              const isActive = sess.sessionId === sessionId;
              return (
                <div
                  key={sess.sessionId}
                  onClick={() => handleSelectSession(sess.sessionId)}
                  className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                    isActive
                      ? 'bg-[#1f8b4d] text-white font-semibold'
                      : 'hover:bg-white/[0.05] text-[#d0dbe8]'
                  }`}
                >
                  <span className="text-xs truncate pr-6 max-w-[200px]" title={sess.title}>
                    {sess.title}
                  </span>
                  
                  <button
                    onClick={(e) => handleDeleteSession(e, sess.sessionId)}
                    title="Xóa phiên trò chuyện"
                    className={`absolute right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg border-none bg-transparent cursor-pointer transition-all ${
                      isActive
                        ? 'text-white/80 hover:bg-black/20 hover:text-white'
                        : 'text-white/40 hover:bg-white/10 hover:text-[#ff4d6a]'
                    }`}
                  >
                    <FontAwesomeIcon icon={faTrash} className="text-[10px]" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/5 bg-[#141e2a] flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#1f8b4d] flex items-center justify-center font-bold text-xs text-white">
            AD
          </div>
          <div className="truncate">
            <p className="m-0 text-xs font-semibold text-white/80 truncate">{auth.user?.name || 'Administrator'}</p>
            <p className="m-0 text-[10px] text-white/40 truncate">{auth.user?.email}</p>
          </div>
        </div>
      </aside>

      {/* Right Panel: Chat Workspace */}
      <div className="flex-1 bg-[#17212b] flex flex-col overflow-hidden h-full">
        {/* Container centering content */}
        <div className="w-full max-w-[1000px] mx-auto flex-1 flex flex-col h-full overflow-hidden px-4 md:px-6">
          
          {/* Header */}
          <header className="flex items-center justify-between py-4 border-b border-white/[0.08] shrink-0">
            <div className="flex items-center gap-3">
              {/* Menu Toggle button (hidden on Desktop, visible on Tablet/Mobile) */}
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="hidden max-[768px]:flex items-center justify-center w-9 h-9 rounded-full bg-[#263544] text-white/70 border-none cursor-pointer hover:bg-white/[0.06]"
                aria-label="Mở sidebar"
              >
                <FontAwesomeIcon icon={faBars} />
              </button>

              <div className="w-10 h-10 rounded-full bg-[#263544] border border-white/10 flex items-center justify-center text-[#00ff88] shadow-sm">
                <FontAwesomeIcon icon={faRobot} className="text-lg" />
              </div>
              
              <div className="truncate max-w-[400px]">
                <h2 className="m-0 text-sm font-extrabold text-[#f4f9ff] tracking-tight truncate">{activeTitle}</h2>
                <p className="mt-0.5 mb-0 text-[11px] text-[#00ff88] flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] inline-block animate-pulse" />
                  Sẵn sàng hỗ trợ quản lý hệ thống
                </p>
              </div>
            </div>
            
            <button
              onClick={handleStartNewChat}
              title="Làm mới cuộc trò chuyện"
              className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.04] text-white/50 border-none cursor-pointer transition-all duration-200 hover:bg-[#ff4d6a]/15 hover:text-[#ff4d6a] hover:scale-105"
            >
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </header>

          {/* Messages Area (Scrollable only) */}
          <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-6 scrollbar-thin pr-1 scrollbar-acb">
            {messages.length === 0 && (
              <div className="w-full max-w-[700px] m-auto py-10 px-6 flex flex-col items-center text-center gap-4 animate-acb-slide-up">
                <div className="w-16 h-16 rounded-full bg-[#263544] border border-white/10 flex items-center justify-center text-[#00ff88] text-3xl mb-2 shadow-[0_8px_30px_rgba(0,0,0,0.3)] animate-pulse">
                  🤖
                </div>
                <h3 className="m-0 mb-1 text-2xl text-[#f4f9ff] font-bold tracking-tight">Xin chào, Admin!</h3>
                <p className="m-0 text-base text-[#d0dbe8]/70 leading-[1.8] whitespace-normal break-normal overflow-wrap-normal max-w-[600px]">
                  Tôi là trợ lý AI dành cho quản trị viên.<br />
                  Tôi có thể hỗ trợ thống kê doanh thu, quản lý đơn hàng,<br />
                  kiểm tra tồn kho, tạo khuyến mãi và phân tích dữ liệu.
                </p>
              </div>
            )}

            {messages.map((msg, i) => {
              if (msg.role === 'tool') {
                return (
                  <div key={i} className="flex items-center justify-center my-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-[11px] text-[#00ff88] font-mono shadow-[0_2px_8px_rgba(0,0,0,0.1)] animate-acb-slide-up">
                      <FontAwesomeIcon icon={faClock} className="text-[10px]" />
                      <span>{msg.content}</span>
                    </div>
                  </div>
                );
              }
              if (msg.role === 'confirmation') {
                return (
                  <div key={i} className="flex gap-3 items-start animate-acb-slide-up">
                    {/* Robot Avatar */}
                    <div className="w-8 h-8 rounded-full bg-[#263544] border border-white/10 flex items-center justify-center text-[#00ff88] text-sm shrink-0">
                      🤖
                    </div>
                    <div className="p-4 rounded-[20px] rounded-tl-[4px] bg-[#ffaa00]/[0.08] border border-[#ffaa00]/20 max-w-[75%] shadow-lg">
                      <p className="m-0 mb-3 text-xs text-[#ffaa00] leading-relaxed font-semibold">⚠️ {msg.content}</p>
                      <div className="flex gap-2">
                        <button
                          className="px-4 py-2 rounded-full border-none cursor-pointer text-[11px] font-bold bg-gradient-to-br from-[#00ff88] to-[#00cc6a] text-[#0b1f33] shadow-[0_4px_12px_rgba(0,255,136,0.2)] transition-transform duration-150 hover:scale-105"
                          onClick={() => handleConfirm(msg.confirmationData)}
                        >
                          Xác nhận
                        </button>
                        <button
                          className="px-4 py-2 rounded-full border-none cursor-pointer text-[11px] font-bold bg-white/[0.06] text-[#aab] transition-colors duration-150 hover:bg-[#ff4d6a]/15 hover:text-[#ff4d6a]"
                          onClick={handleCancelConfirm}
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              const isUser = msg.role === 'user';

              return (
                <div
                  key={i}
                  className={`flex gap-3 items-start animate-acb-slide-up ${isUser ? 'flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 font-bold border ${
                    isUser
                      ? 'bg-[#1f8b4d]/20 border-[#1f8b4d]/40 text-[#00ff88]'
                      : 'bg-[#263544] border-white/10 text-[#00ff88]'
                  }`}>
                    {isUser ? 'AD' : '🤖'}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[75%] px-4 py-3 rounded-[20px] text-xs leading-relaxed break-words shadow-[0_4px_12px_rgba(0,0,0,0.15)] ${
                      isUser
                        ? 'bg-[#1f8b4d] text-white rounded-tr-[4px] border border-white/[0.05]'
                        : 'bg-[#263544] text-[#d0dbe8] rounded-tl-[4px] border border-white/[0.04] [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:text-[11px] [&_th]:p-2.5 [&_th]:border [&_th]:border-white/10 [&_th]:text-left [&_th]:bg-[#00ff88]/[0.08] [&_th]:text-[#00ff88] [&_th]:font-bold [&_td]:p-2.5 [&_td]:border [&_td]:border-white/10 [&_td]:text-left [&_code]:bg-white/[0.08] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px] [&_pre]:bg-black/30 [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_pre]:my-3 [&_strong]:text-[#00ff88] [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:pl-5 [&_ol]:my-2 [&_a]:text-[#00ff88] [&_a]:underline'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      msg.content ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      ) : (
                        <div className="flex gap-1.5 p-1 items-center">
                          <span className="w-2 h-2 rounded-full bg-[#00ff88]/50 animate-acb-bounce" />
                          <span className="w-2 h-2 rounded-full bg-[#00ff88]/50 animate-acb-bounce [animation-delay:0.15s]" />
                          <span className="w-2 h-2 rounded-full bg-[#00ff88]/50 animate-acb-bounce [animation-delay:0.3s]" />
                        </div>
                      )
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && !messages.some((m) => m.streaming) && (
              <div className="flex gap-3 items-start animate-acb-slide-up">
                <div className="w-8 h-8 rounded-full bg-[#263544] border border-white/10 flex items-center justify-center text-xs shrink-0 font-bold">
                  🤖
                </div>
                <div className="flex gap-1.5 px-4 py-3 rounded-[20px] rounded-tl-[4px] bg-[#263544] border border-white/[0.04]">
                  <span className="w-2 h-2 rounded-full bg-[#00ff88]/50 animate-acb-bounce" />
                  <span className="w-2 h-2 rounded-full bg-[#00ff88]/50 animate-acb-bounce [animation-delay:0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-[#00ff88]/50 animate-acb-bounce [animation-delay:0.3s]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Sticky footer input area */}
          <footer className="mt-auto py-4 border-t border-white/[0.08] bg-[#17212b] shrink-0 flex flex-col gap-3">
            {/* Quick suggestions chips */}
            <div className="flex flex-wrap gap-2.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="px-3.5 py-2 rounded-full border border-white/[0.08] bg-[#263544] text-[#d0dbe8] text-[11px] font-medium cursor-pointer transition-all duration-150 hover:bg-[#1f8b4d] hover:border-[#1f8b4d] hover:scale-105 hover:-translate-y-0.5 whitespace-nowrap shadow-sm hover:shadow-[0_4px_12px_rgba(31,139,77,0.3)]"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Input field */}
            <div className="flex items-end gap-3 bg-[#263544]/60 border border-white/[0.08] rounded-[24px] p-2 focus-within:border-white/[0.15] transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi trợ lý AI quản trị..."
                rows={1}
                disabled={isLoading}
                className="flex-1 resize-none border-none bg-transparent text-[#e6eef7] text-xs font-[inherit] leading-[1.45] min-h-[40px] max-h-[120px] py-2 px-3 outline-none placeholder:text-white/35 focus:ring-0 focus:outline-none"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                aria-label="Gửi tin nhắn"
                className="w-9 h-9 rounded-full border-none cursor-pointer flex items-center justify-center text-sm bg-[#1f8b4d] text-white shrink-0 transition-all duration-150 hover:scale-105 hover:bg-[#1f8b4d]/90 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
              >
                <FontAwesomeIcon icon={faPaperPlane} />
              </button>
            </div>
          </footer>

        </div>
      </div>
    </main>
  );
}

export default AdminChatbotPage;
