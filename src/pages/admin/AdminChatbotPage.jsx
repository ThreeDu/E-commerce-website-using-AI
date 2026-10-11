import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRobot,
  faPaperPlane,
  faTrash,
  faPlus,
  faBars,
  faXmark,
  faWandMagicSparkles,
  faCheck,
  faTriangleExclamation,
  faChartLine,
  faReceipt,
  faBoxesStacked,
  faFileLines,
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

  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Sync session ID to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('admin_chatbot_sid', sessionId);
  }, [sessionId]);

  const fetchSessions = useCallback(async () => {
    if (!auth?.token) return;
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
  }, [auth?.token]);

  const loadActiveSessionDetail = useCallback(async (sid) => {
    if (!auth?.token) return;
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
        setMessages([]);
        setActiveTitle('Trợ lý AI Quản Trị');
      }
    } catch (err) {
      console.error('Lỗi khi tải chi tiết phiên chat:', err);
    }
  }, [auth?.token]);

  // Load chat sessions and current session detail on mount
  useEffect(() => {
    if (auth?.token) {
      fetchSessions();
      loadActiveSessionDetail(sessionId);
    }
  }, [auth?.token, fetchSessions, loadActiveSessionDetail, sessionId]);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior,
      });
    }
  }, []);

  // Ensure top of page when entering
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Auto-scroll chat container ONLY when messages exist or while streaming/loading
  useEffect(() => {
    if (messages.length > 0 || isLoading) {
      scrollToBottom('smooth');
    }
  }, [messages, isLoading, scrollToBottom]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleSelectSession = async (sid) => {
    setIsSidebarOpen(false);
    setIsLoading(true);
    await loadActiveSessionDetail(sid);
    setIsLoading(false);
  };

  const handleDeleteSession = async (e, sid) => {
    e.stopPropagation();
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
                const updatedText = streamedText;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === streamMsgId ? { ...m, content: updatedText } : m
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
            } catch {
              // skip unparseable
            }
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

  const promptCards = [
    {
      title: 'Doanh thu hôm nay',
      desc: 'Tra cứu tổng doanh số và số đơn hoàn tất hôm nay',
      prompt: 'Doanh thu hôm nay bao nhiêu?',
      icon: faChartLine,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
      title: 'Đơn hàng chờ xử lý',
      desc: 'Kiểm tra danh sách đơn đang ở trạng thái pending',
      prompt: 'Kiểm tra các đơn hàng đang chờ xử lý',
      icon: faReceipt,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    },
    {
      title: 'Sản phẩm sắp hết hàng',
      desc: 'Liệt kê các mặt hàng có tồn kho dưới ngưỡng an toàn',
      prompt: 'Những sản phẩm nào sắp hết hàng trong kho?',
      icon: faBoxesStacked,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    {
      title: 'Log hệ thống gần nhất',
      desc: 'Xem lịch sử các tác vụ quản trị vừa thực hiện',
      prompt: 'Xem lịch sử log hệ thống gần nhất',
      icon: faFileLines,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
  ];

  const suggestions = [
    'Doanh thu hôm nay bao nhiêu?',
    'Kiểm tra đơn hàng pending',
    'Sản phẩm nào sắp hết hàng?',
    'Xem lịch sử log hệ thống gần nhất',
  ];

  if (!auth || auth.user?.role !== 'admin') return null;

  return (
    <main className="h-[calc(100vh-64px)] w-full bg-slate-50 text-slate-800 flex overflow-hidden relative">
      {/* Mobile Drawer Overlay Backdrop */}
      {isSidebarOpen && (
        <button
          type="button"
          onClick={() => setIsSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-slate-950/60 z-[1190] border-none outline-none cursor-default backdrop-blur-xs"
          aria-label="Đóng danh sách phiên"
        />
      )}

      {/* Left Panel: Chat sessions history sidebar (Deep Slate matching Admin Navigation) */}
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

      {/* Right Panel: Clean LLM Chat Workspace */}
      <div className="flex-1 min-w-0 bg-slate-50 flex flex-col overflow-hidden h-full">
        {/* Workspace Header */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Sidebar Toggle Button */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:text-slate-900 border-none cursor-pointer"
              aria-label="Mở danh sách phiên chat"
            >
              <FontAwesomeIcon icon={faBars} />
            </button>

            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-sm shrink-0 shadow-xs">
              <FontAwesomeIcon icon={faRobot} />
            </div>

            <div className="truncate">
              <h2 className="m-0 text-sm font-bold text-slate-900 tracking-tight truncate">
                {activeTitle}
              </h2>
              <div className="text-[11px] text-emerald-600 flex items-center gap-1.5 font-medium leading-none mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                <span>Trợ lý AI sẵn sàng hỗ trợ</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleStartNewChat}
            title="Tạo đoạn chat mới"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-blue-600 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
          >
            <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
            <span className="hidden sm:inline">Hội thoại mới</span>
          </button>
        </header>

        {/* Chat Message Scrollable Container */}
        <div ref={messagesContainerRef} className="flex-1 min-w-0 overflow-y-auto px-4 sm:px-6 py-6 scrollbar-thin scrollbar-thumb-slate-300">
          <div className="w-full max-w-3xl mx-auto flex flex-col gap-5">
            {/* Empty State with Prompt Cards */}
            {messages.length === 0 && (
              <div className="w-full my-auto py-8 flex flex-col items-center text-center animate-fade-in">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white text-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
                  <FontAwesomeIcon icon={faWandMagicSparkles} />
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight m-0 mb-2">
                  Xin chào, Admin!
                </h3>
                <p className="text-sm text-slate-600 w-full max-w-[560px] leading-relaxed m-0 mb-8 break-normal">
                  Tôi là trợ lý AI quản trị hệ thống. Tôi có thể hỗ trợ bạn tra cứu doanh thu, kiểm tra đơn hàng, quản lý kho, tạo mã giảm giá và phân tích dữ liệu nhanh chóng.
                </p>

                {/* Quick prompt cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl text-left">
                  {promptCards.map((card, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => sendMessage(card.prompt)}
                      className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30 transition-all hover:-translate-y-0.5 hover:shadow-sm cursor-pointer flex items-start gap-3.5 text-left"
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 border ${card.color}`}>
                        <FontAwesomeIcon icon={card.icon} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 m-0 mb-0.5">
                          {card.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 m-0 leading-snug">
                          {card.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages stream */}
            {messages.map((msg, i) => {
              // Tool execution pill
              if (msg.role === 'tool') {
                return (
                  <div key={i} className="flex items-center justify-center my-1 animate-fade-in">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-[11px] text-blue-700 font-mono shadow-2xs font-semibold">
                      <FontAwesomeIcon icon={faCheck} className="text-[10px] text-blue-600" />
                      <span>{msg.content}</span>
                    </div>
                  </div>
                );
              }

              // Operation Confirmation request
              if (msg.role === 'confirmation') {
                return (
                  <div key={i} className="flex gap-3 items-start animate-fade-in max-w-2xl">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-xs shrink-0 shadow-xs">
                      <FontAwesomeIcon icon={faTriangleExclamation} />
                    </div>
                    <div className="p-4 rounded-2xl rounded-tl-xs bg-amber-50 border border-amber-300 shadow-sm">
                      <p className="m-0 mb-3 text-xs text-amber-900 font-bold leading-relaxed">
                        ⚠️ Yêu cầu xác nhận thao tác quản trị:
                      </p>
                      <p className="m-0 mb-3 text-xs text-slate-700 leading-relaxed font-medium">
                        {msg.content}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleConfirm(msg.confirmationData)}
                          className="px-4 py-1.5 rounded-lg border-none bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          Xác nhận thực hiện
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelConfirm}
                          className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Hủy bỏ
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
                  className={`flex gap-3 items-start animate-fade-in ${
                    isUser ? 'flex-row-reverse self-end max-w-2xl' : 'self-start max-w-2xl'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 font-bold shadow-xs ${
                      isUser
                        ? 'bg-slate-900 text-white'
                        : 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white'
                    }`}
                  >
                    {isUser ? 'AD' : <FontAwesomeIcon icon={faRobot} />}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`px-4 sm:px-5 py-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs break-words ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tr-xs font-medium'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:text-xs [&_th]:p-2 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:text-slate-800 [&_th]:font-bold [&_td]:p-2 [&_td]:border [&_td]:border-slate-200 [&_code]:bg-slate-100 [&_code]:text-blue-700 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-slate-900 [&_pre]:text-slate-100 [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_pre]:my-2 [&_strong]:text-slate-900 [&_strong]:font-bold [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:pl-5 [&_ol]:my-1.5 [&_a]:text-blue-600 [&_a]:underline'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      msg.content ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      ) : (
                        <div className="flex gap-1.5 py-1 items-center">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" />
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.15s]" />
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.3s]" />
                        </div>
                      )
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              );
            })}

            {/* Loading indicator */}
            {isLoading && !messages.some((m) => m.streaming) && (
              <div className="flex gap-3 items-start animate-fade-in self-start">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-xs shrink-0 shadow-xs">
                  <FontAwesomeIcon icon={faRobot} />
                </div>
                <div className="flex gap-1.5 px-4 py-3 rounded-2xl rounded-tl-xs bg-white border border-slate-200 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.3s]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Dock (Floating at bottom) */}
        <footer className="p-4 sm:p-5 border-t border-slate-200 bg-white/95 backdrop-blur-md shrink-0">
          <div className="w-full max-w-3xl mx-auto flex flex-col gap-2.5">
            {/* Quick Suggestions Chips */}
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => sendMessage(s)}
                  className="px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 text-slate-600 text-xs font-semibold cursor-pointer transition-all shadow-2xs whitespace-nowrap"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Input Box */}
            <div className="flex items-end gap-2.5 bg-slate-50 border border-slate-300 rounded-2xl p-2.5 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-2xs">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi trợ lý AI quản trị (Shift+Enter để xuống dòng)..."
                rows={1}
                disabled={isLoading}
                className="flex-1 resize-none border-none bg-transparent text-slate-800 text-xs sm:text-sm font-[inherit] leading-relaxed min-h-[38px] max-h-[120px] py-1 px-2 outline-none placeholder:text-slate-400 focus:ring-0 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                aria-label="Gửi yêu cầu"
                className="w-10 h-10 rounded-xl border-none cursor-pointer flex items-center justify-center text-sm bg-blue-600 hover:bg-blue-700 text-white shrink-0 transition-all shadow-xs hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none"
              >
                <FontAwesomeIcon icon={faPaperPlane} />
              </button>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

export default AdminChatbotPage;
