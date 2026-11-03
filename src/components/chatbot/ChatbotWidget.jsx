import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { sendChatbotMessage, trackChatbotEvent } from "../../services/chatbotService";
import { postStream, readSseEvents } from "../../services/streamClient";
import ChatInputForm from "./ChatInputForm";
import ChatMessageList from "./ChatMessageList";
import { getOrCreateSessionId, readBehavior, writeBehavior, createMessage, SESSION_STORAGE_KEY, looksLikeCompareQuery } from "./chatbotHelpers";

const OPEN_STORAGE_KEY = "chatbot_open";

function ChatbotWidget() {
  const location = useLocation();
  const { cart, addToCart, reloadCart } = useCart();
  const { auth } = useAuth();
  // Mặc định đóng để không che nội dung; nhớ lựa chọn mở/đóng của người dùng giữa các lần tải trang.
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_STORAGE_KEY, open ? "1" : "0");
    } catch {
      // localStorage bị chặn: chỉ mất phần ghi nhớ trạng thái
    }
  }, [open]);
  const [pending, setPending] = useState(false);
  const [input, setInput] = useState("");
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const latestAiMessageRef = useRef(null);
  const userWasNearBottomRef = useRef(true);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState([]);
  const [recording, setRecording] = useState(false);
  const [compareProduct1, setCompareProduct1] = useState(null);

  const recognition = useMemo(() => {
    if (typeof window !== "undefined") {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous = false;
        rec.lang = "vi-VN";
        rec.interimResults = false;
        return rec;
      }
    }
    return null;
  }, []);

  useEffect(() => {
    if (!recognition) return;

    recognition.onstart = () => {
      console.log("Speech recognition started");
      setRecording(true);
    };

    recognition.onresult = (event) => {
      console.log("Speech recognition result event:", event);
      const resultIndex = event.resultIndex;
      const transcript = event.results[resultIndex][0].transcript;
      if (transcript) {
        setInput((prev) => {
          const space = prev && !prev.endsWith(" ") ? " " : "";
          return prev + space + transcript.trim();
        });
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        alert("Không thể truy cập microphone. Vui lòng cấp quyền truy cập microphone cho trang web này trong cài đặt trình duyệt (Click vào biểu tượng ổ khóa ở đầu thanh địa chỉ URL).");
      } else if (event.error === "network") {
        alert("Không thể kết nối đến máy chủ nhận diện giọng nói của Google (Lỗi Network). Vui lòng kiểm tra lại đường truyền Internet, tạm thời tắt các dịch vụ VPN/Proxy/Chặn quảng cáo, hoặc thử lại sau.");
      } else if (event.error === "no-speech") {
        console.log("No speech detected.");
      } else {
        alert("Lỗi nhận diện giọng nói: " + event.error);
      }
      setRecording(false);
    };

    recognition.onend = () => {
      console.log("Speech recognition ended");
      setRecording(false);
    };
  }, [recognition]);

  const toggleRecording = useCallback(() => {
    if (!recognition) {
      alert("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.");
      return;
    }
    if (recording) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (e) {
        // Already started
      }
    }
  }, [recognition, recording]);

  const isAdminArea = location.pathname.startsWith("/admin");

  useEffect(() => {
    if (isAdminArea) {
      return;
    }

    const nextSession = getOrCreateSessionId();
    setSessionId(nextSession);
  }, [isAdminArea]);

  useEffect(() => {
    if (isAdminArea) {
      return;
    }

    const behavior = readBehavior();
    const nextPaths = [location.pathname, ...(behavior.recentPaths || [])]
      .filter(Boolean)
      .slice(0, 20);

    let nextViewedProductIds = behavior.viewedProductIds || [];
    const match = location.pathname.match(/^\/products\/([^/]+)/);
    if (match?.[1]) {
      nextViewedProductIds = [match[1], ...nextViewedProductIds.filter((item) => item !== match[1])].slice(0, 30);
    }

    writeBehavior({
      ...behavior,
      recentPaths: nextPaths,
      viewedProductIds: nextViewedProductIds,
    });
  }, [location.pathname, isAdminArea]);

  useEffect(() => {
    if (isAdminArea) {
      return;
    }

    const behavior = readBehavior();
    const cartProductIds = Array.isArray(cart)
      ? cart
          .map((item) => String(item?._id || item?.id || "").trim())
          .filter(Boolean)
      : [];

    writeBehavior({
      ...behavior,
      cartProductIds,
    });
  }, [cart, isAdminArea]);

  const quickReplies = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((item) => item.role === "assistant");
    const rawReplies = Array.isArray(lastAssistant?.quickReplies) ? lastAssistant.quickReplies : [];
    return rawReplies;
  }, [messages]);

  const trackEvent = useCallback(async ({ eventType, productId = "", category = "", queryText = "", metadata = {} }) => {
    if (!sessionId || !eventType) {
      return;
    }

    try {
      await trackChatbotEvent({
        sessionId,
        eventType,
        productId,
        category,
        queryText,
        metadata,
      }, auth?.token);
    } catch (error) {
      // Không chặn UX nếu tracking lỗi.
    }
  }, [sessionId, auth?.token]);

  const submitChatMessage = useCallback(async (text, options = {}) => {
    const showUserMessage = options.showUserMessage !== false;
    const userMsg = createMessage("user", text);
    const nextMessages = showUserMessage ? [...messages, userMsg] : [...messages];

    if (showUserMessage) {
      setMessages((prev) => [...prev, userMsg]);
    }

    setInput("");
    setPending(true);

    if (showUserMessage) {
      trackEvent({
        eventType: "message",
        queryText: text,
        metadata: {
          page: location.pathname,
        },
      });
    }

    try {
      const behavior = readBehavior();

      // Create empty assistant message for streaming
      const streamMsgId = `stream_${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { ...createMessage("assistant", ""), id: streamMsgId, streaming: true },
      ]);

      const response = await postStream("/api/chatbot/message/stream", {
        message: text,
        sessionId,
        context: {
          page: location.pathname,
          userBehavior: behavior,
        },
      }, auth?.token);

      if (!response.ok) {
        // Fallback to non-streaming
        const fallbackData = await sendChatbotMessage({
          message: text,
          sessionId,
          history: nextMessages.slice(-8).map((item) => ({
            role: item.role,
            content: item.text,
            products: Array.isArray(item.products) ? item.products : [],
          })),
          context: { page: location.pathname, userBehavior: behavior },
        }, auth?.token).catch((error) => {
          // Phản hồi lỗi vẫn có thể chứa reply để hiển thị
          if (!error.status) throw error;
          return error.data;
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamMsgId
              ? {
                  ...m,
                  text: fallbackData?.reply || "Hệ thống tạm thời bận.",
                  products: fallbackData?.products || [],
                  quickReplies: fallbackData?.quickReplies || [],
                  streaming: false,
                }
              : m
          )
        );
        if (fallbackData?.cartUpdated && typeof reloadCart === "function") reloadCart();
        return;
      }

      // Parse SSE stream
      let streamedText = "";
      let streamProducts = [];
      let streamQuickReplies = [];

      await readSseEvents(response, (currentEvent, payload) => {
        if (currentEvent === "token" && payload.text) {
          streamedText += payload.text;
          const updatedText = streamedText;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamMsgId ? { ...m, text: updatedText } : m
            )
          );
        } else if (currentEvent === "products") {
          streamProducts = payload.products || [];
          streamQuickReplies = payload.quickReplies || [];
        } else if (currentEvent === "done") {
          if (payload.sessionId && payload.sessionId !== sessionId) {
            setSessionId(payload.sessionId);
            localStorage.setItem(SESSION_STORAGE_KEY, payload.sessionId);
          }
          if (payload.cartUpdated && typeof reloadCart === "function") reloadCart();
        } else if (currentEvent === "error") {
          streamedText = payload.message || "Đã có lỗi xảy ra.";
          const updatedText = streamedText;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamMsgId ? { ...m, text: updatedText } : m
            )
          );
        }
      });

      // Finalize the streamed message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamMsgId
            ? {
                ...m,
                text: streamedText || "Mình đã nhận thông tin.",
                products: streamProducts,
                quickReplies: streamQuickReplies,
                streaming: false,
              }
            : m
        )
      );

      // Track product impressions
      streamProducts.forEach((item) => {
        trackEvent({
          eventType: "impression",
          productId: item._id,
          category: item.category,
          queryText: text,
          metadata: { source: "chatbot_recommendation" },
        });
      });
    } catch (error) {
      setMessages((prev) => {
        // If stream message exists, update it with error
        const hasStream = prev.some((m) => m.streaming);
        if (hasStream) {
          return prev.map((m) =>
            m.streaming ? { ...m, text: "Không thể kết nối chatbot lúc này. Bạn thử lại trong giây lát.", streaming: false } : m
          );
        }
        return [
          ...prev,
          createMessage("assistant", "Không thể kết nối chatbot lúc này. Bạn thử lại trong giây lát."),
        ];
      });
    } finally {
      setPending(false);
    }
  }, [messages, location.pathname, auth?.token, sessionId, trackEvent, reloadCart]);

  const sendMessageThroughMainChat = useCallback(async (text) => submitChatMessage(text, { showUserMessage: true }), [submitChatMessage]);

  const sendMessage = useCallback(async (content) => {
    const text = String(content || "").trim();
    if (!text || pending) {
      return;
    }

    if (looksLikeCompareQuery(text)) {
      return sendMessageThroughMainChat(text);
    }

    return sendMessageThroughMainChat(text);
  }, [pending, sendMessageThroughMainChat]);

  useEffect(() => {
    if (textareaRef.current) {
      if (!input) {
        textareaRef.current.style.height = "38px";
      } else {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
      }
    }
  }, [input]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const text = String(input).trim();
      if (text && !pending) {
        sendMessage(text);
      }
    }
  }, [input, pending, sendMessage]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 150;
    const position = container.scrollHeight - container.scrollTop - container.clientHeight;
    userWasNearBottomRef.current = position <= threshold;
  }, []);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === "user") {
      scrollToBottom("smooth");
    } else if (lastMessage.role === "assistant") {
      if (userWasNearBottomRef.current && latestAiMessageRef.current) {
        latestAiMessageRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => scrollToBottom("auto"), 60);
      return () => clearTimeout(timer);
    }
  }, [open, scrollToBottom]);

  const latestAiId = useMemo(() => {
    const lastAi = [...messages].reverse().find((msg) => msg.role === "assistant");
    return lastAi ? lastAi.id : null;
  }, [messages]);

  useEffect(() => {
    if (isAdminArea || !open || messages.length > 0) {
      return;
    }

    setMessages([
      createMessage(
        "assistant",
        "Chào bạn! Tôi có thể hỗ trợ gì cho bạn hôm nay? Bạn đang cần tìm kiếm sản phẩm nào, hay muốn được tư vấn về dòng thiết bị nào ạ?",
        {
          quickReplies: ["Tìm điện thoại", "Tìm laptop", "Xem khuyến mãi"],
        }
      ),
    ]);
  }, [open, isAdminArea, messages.length]);

  if (isAdminArea) {
    return null;
  }

  return (
    <div className={`fixed right-[18px] bottom-[18px] z-[1400] grid gap-2.5 justify-items-end max-[640px]:right-[10px] max-[640px]:bottom-[10px] ${open ? "open" : ""}`}>
      {open ? (
        <section 
          className={`w-[min(420px,calc(100vw-24px))] max-h-[min(640px,calc(100vh-96px))] grid grid-rows-[auto_1fr_auto_auto] bg-white border border-black/10 rounded-3xl overflow-hidden transition-all duration-[200ms] max-[640px]:w-[min(100vw-12px,420px)] max-[640px]:max-h-[min(78vh,620px)] ${
            open 
              ? "scale-100 shadow-[0_18px_40px_rgba(15,34,51,0.12),0_0_0_6px_rgba(208,228,255,0.35)]" 
              : "scale-98 shadow-[0_18px_40px_rgba(15,34,51,0.12)]"
          }`}
          aria-label="AI chatbot"
        >
          <header className="p-3 px-3.5 border-b border-black/8 flex justify-between gap-2 items-center bg-[#e9f6ff]/90 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="w-8.5 h-8.5 rounded-xl grid place-items-center bg-gradient-to-br from-[#e0f2ff] to-[#f4ebff] text-[#0f314f] border border-[#0f314f]/12 shadow-[0_4px_10px_rgba(15,49,79,0.12)] [&>svg]:w-5 [&>svg]:h-5" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                  <path
                    d="M8 4.5a1 1 0 0 1 2 0v1h4v-1a1 1 0 1 1 2 0v1.2a4.5 4.5 0 0 1 4 4.48v5.32a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 15.5v-5.32a4.5 4.5 0 0 1 4-4.48V4.5Zm0 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8 1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div className="grid gap-0.5">
                <strong className="block text-[#0f2233] text-sm">AI Shopping Assistant</strong>
                <p className="m-0 mt-1 text-[#334155] font-semibold text-xs">Gợi ý nhanh theo nhu cầu của bạn</p>
              </div>
            </div>

            <button type="button" className="border border-black/12 bg-white rounded-lg w-7 h-7 flex items-center justify-center cursor-pointer transition-all hover:bg-[#eef6ff] hover:shadow-card active:scale-94" onClick={() => setOpen(false)} aria-label="Dong chatbot">
              ×
            </button>
          </header>

          <div 
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="p-2.5 overflow-y-auto display grid gap-2.5 bg-gradient-to-b from-[#f3f7ff] to-[#fbf9ff] scrollbar-thin"
          >
            <ChatMessageList addToCart={addToCart} compareProduct1={compareProduct1} createMessage={createMessage} latestAiId={latestAiId} latestAiMessageRef={latestAiMessageRef} messages={messages} sendMessage={sendMessage} setCompareProduct1={setCompareProduct1} setMessages={setMessages} trackEvent={trackEvent} />
            {pending && !messages.some((m) => m.streaming) ? (
              <article className="w-full">
                <div className="flex gap-2 items-start justify-start">
                  <div className="w-7 h-7 rounded-full grid place-items-center text-[#0f2233] bg-gradient-to-br from-[#d8ecff] to-[#f6f2ff] border border-[#0f494f]/15 shadow-sm [&>svg]:w-4 [&>svg]:h-4" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                      <path
                        d="M8 4.5a1 1 0 0 1 2 0v1h4v-1a1 1 0 1 1 2 0v1.2a4.5 4.5 0 0 1 4 4.48v5.32a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 15.5v-5.32a4.5 4.5 0 0 1 4-4.48V4.5Zm0 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8 1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  <div className="max-w-[84%] rounded-[18px] p-2.5 px-3 border border-[#0f2233]/10 bg-[#f7faff] shadow-sm animate-chatbot-pop origin-top-left">
                    <div className="inline-flex items-center gap-1 min-h-[18px]" aria-label="Dang nhap">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5b6a7c] animate-chatbot-dot" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5b6a7c] animate-chatbot-dot" style={{ animationDelay: "0.15s" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5b6a7c] animate-chatbot-dot" style={{ animationDelay: "0.3s" }} />
                    </div>
                  </div>
                </div>
              </article>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          {quickReplies.length > 0 ? (
            <div className="p-2 px-2.5 flex gap-1.5 flex-wrap border-t border-black/6 bg-white">
              {quickReplies.map((item) => (
                <button key={item} type="button" className="border border-black/10 bg-white text-[#1f2937] rounded-full py-1.5 px-2.5 text-xs cursor-pointer transition-all hover:bg-[#f1f6ff] hover:shadow-sm active:scale-97" onClick={() => sendMessage(item)} disabled={pending}>
                  {item}
                </button>
              ))}
            </div>
          ) : null}

          {compareProduct1 ? (
            <div className="p-2 px-3 flex items-center justify-between border-t border-purple-100 bg-[#fdf4ff] text-[#6b21a8] text-xs font-semibold animate-fade-in gap-2 min-w-0">
              <span className="truncate min-w-0 flex-1">
                Đang chọn: <strong>{compareProduct1.name}</strong> (Bấm \"So sánh\" trên thẻ khác)
              </span>
              <button
                type="button"
                className="text-red-500 hover:text-red-700 font-bold shrink-0 cursor-pointer ml-1"
                onClick={() => setCompareProduct1(null)}
              >
                Hủy
              </button>
            </div>
          ) : null}

          <ChatInputForm handleKeyDown={handleKeyDown} input={input} pending={pending} recording={recording} sendMessage={sendMessage} setInput={setInput} textareaRef={textareaRef} toggleRecording={toggleRecording} />
        </section>
      ) : null}

      <button type="button" className="border border-black/10 rounded-full bg-[#dfeeff] text-[#0f314f] py-2.5 px-4.5 text-sm font-bold cursor-pointer shadow-[0_10px_24px_rgba(15,34,51,0.15)] transition-all duration-[100ms] hover:bg-[#e8f4ff] hover:shadow-[0_12px_28px_rgba(15,34,51,0.18)] active:scale-97" onClick={() => setOpen((prev) => !prev)}>
        {open ? "Đóng" : "Chat AI"}
      </button>
    </div>
  );
}

export default ChatbotWidget;
