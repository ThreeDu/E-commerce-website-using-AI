import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
const SESSION_STORAGE_KEY = "chatbot_session_id";
const BEHAVIOR_STORAGE_KEY = "chatbot_behavior";


function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}


function looksLikeCompareQuery(value) {
  const text = normalizeSearchText(value);
  if (!text) {
    return false;
  }

  const compareSeparators = /\s+(?:và|va|vs\.?|v\.s\.?|with|and|so voi|so sanh|giua|\/|vs\s+|vs\.\s+)/i;
  const parts = text
    .split(compareSeparators)
    .map((item) => item.trim())
    .filter(Boolean);

  const isProductLikePart = (part) => {
    if (!part) {
      return false;
    }

    if (
      /\b(iphone|samsung|galaxy|xiaomi|oppo|vivo|realme|ipad|macbook|pro|max|ultra|plus|mini|fold|flip)\b/.test(part)
    ) {
      return true;
    }

    if (/\b\d{1,2}\s*gb\s*\/\s*\d{2,4}\s*(gb|tb)\b/.test(part)) {
      return true;
    }

    if (/\b\d{2,4}\s*(gb|tb)\b/.test(part)) {
      return true;
    }

    return /\b\d{2,3}\s*hz\b/.test(part) || /\b\d{3,5}\s*mah\b/.test(part);
  };

  if (parts.length >= 2) {
    const hasTwoProductLikeParts = parts.slice(0, 2).every((part) => isProductLikePart(part));
    if (hasTwoProductLikeParts) {
      return true;
    }
  }

  return /\b(so sanh|compare|vs\.?|v\.s\.?|doi chieu|doi sach|di chung voi|giua)\b/.test(text) && parts.length >= 2;
}

function getProductImageSrc(product) {
  const rawValue = String(product?.image || product?.imageUrl || "").trim();
  if (!rawValue) {
    return "/placeholder.svg";
  }

  if (
    rawValue.startsWith("http://") ||
    rawValue.startsWith("https://") ||
    rawValue.startsWith("data:image/") ||
    rawValue.startsWith("/")
  ) {
    return rawValue;
  }

  return `/${rawValue.replace(/^\/+/, "")}`;
}

function createMessage(role, text, extra = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    products: extra.products || [],
    quickReplies: extra.quickReplies || [],
  };
}

function formatVnd(value) {
  const rounded = Math.round(Number(value || 0));
  return `${rounded.toLocaleString("vi-VN")} đ`;
}

function renderAssistantMarkdown(text) {
  return (
    <div className="grid gap-2.5 overflow-x-auto">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ node, ...props }) => (
            <table className="w-full min-w-full border-collapse border-spacing-0 border-2 border-[#1e1e1e] rounded-lg overflow-hidden shadow-[4px_4px_0px_#1e1e1e] bg-gradient-to-b from-[#f7f1ff] to-[#eef8ff] text-xs" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="p-2 px-2.5 border-r border-b border-[#1e1e1e]/12 align-top bg-gradient-to-b from-[#ffe8c7] to-[#ffd9f0] font-extrabold text-[#1e1e1e] text-left last:border-r-0" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="p-2 px-2.5 border-r border-b border-[#1e1e1e]/12 align-top text-[#202124] leading-relaxed last:border-r-0 first:font-bold hover:bg-white/70" {...props} />
          ),
          p: ({ node, ...props }) => <p className="m-0 mt-2 first:mt-0 whitespace-pre-wrap" {...props} />,
        }}
      >
        {String(text || "")}
      </ReactMarkdown>
    </div>
  );
}

function getOrCreateSessionId() {
  const existed = localStorage.getItem(SESSION_STORAGE_KEY);
  if (existed) {
    return existed;
  }

  const generated = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  localStorage.setItem(SESSION_STORAGE_KEY, generated);
  return generated;
}

function readBehavior() {
  try {
    const raw = localStorage.getItem(BEHAVIOR_STORAGE_KEY);
    if (!raw) {
      return {
        viewedProductIds: [],
        preferredCategories: [],
        cartProductIds: [],
        recentPaths: [],
      };
    }

    const parsed = JSON.parse(raw);
    return {
      viewedProductIds: Array.isArray(parsed.viewedProductIds) ? parsed.viewedProductIds : [],
      preferredCategories: Array.isArray(parsed.preferredCategories) ? parsed.preferredCategories : [],
      cartProductIds: Array.isArray(parsed.cartProductIds) ? parsed.cartProductIds : [],
      recentPaths: Array.isArray(parsed.recentPaths) ? parsed.recentPaths : [],
    };
  } catch (error) {
    return {
      viewedProductIds: [],
      preferredCategories: [],
      cartProductIds: [],
      recentPaths: [],
    };
  }
}

function writeBehavior(nextBehavior) {
  localStorage.setItem(BEHAVIOR_STORAGE_KEY, JSON.stringify(nextBehavior));
}



function ChatbotWidget() {
  const location = useLocation();
  const { cart, addToCart, reloadCart } = useCart();
  const { auth } = useAuth();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [input, setInput] = useState("");
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
      setRecording(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setInput((prev) => {
          const space = prev && !prev.endsWith(" ") ? " " : "";
          return prev + space + transcript;
        });
      }
    };

    recognition.onerror = () => {
      setRecording(false);
    };

    recognition.onend = () => {
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
      const headers = {
        "Content-Type": "application/json",
      };

      if (auth?.token) {
        headers.Authorization = `Bearer ${auth.token}`;
      }

      await fetch("/api/chatbot/event", {
        method: "POST",
        headers,
        body: JSON.stringify({
          sessionId,
          eventType,
          productId,
          category,
          queryText,
          metadata,
        }),
      });
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
      const recentHistory = nextMessages.slice(-8).map((item) => ({
        role: item.role,
        content: item.text,
        products: Array.isArray(item.products) ? item.products : [],
      }));
      const headers = {
          "Content-Type": "application/json",
      };

      if (auth?.token) {
        headers.Authorization = `Bearer ${auth.token}`;
      }

      const response = await fetch("/api/chatbot/message", {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: text,
          sessionId,
          history: recentHistory,
          context: {
            page: location.pathname,
            userBehavior: behavior,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setMessages((prev) => [
          ...prev,
          createMessage("assistant", data?.message || "He thong tam thoi ban, ban thu lai sau."),
        ]);
        return;
      }

      if (data?.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        localStorage.setItem(SESSION_STORAGE_KEY, data.sessionId);
      }

      setMessages((prev) => [
        ...prev,
        createMessage("assistant", data?.reply || "Minh da nhan thong tin.", {
          products: Array.isArray(data?.products) ? data.products : [],
          quickReplies: Array.isArray(data?.quickReplies) ? data.quickReplies : [],
        }),
      ]);

      if (data?.cartUpdated && typeof reloadCart === "function") {
        reloadCart();
      }

      const products = Array.isArray(data?.products) ? data.products : [];
      products.forEach((item) => {
        trackEvent({
          eventType: "impression",
          productId: item._id,
          category: item.category,
          queryText: text,
          metadata: {
            source: "chatbot_recommendation",
          },
        });
      });
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        createMessage("assistant", "Khong the ket noi chatbot luc nay. Ban thu lai trong giay lat."),
      ]);
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
    if (isAdminArea || !open || !sessionId || messages.length > 0 || pending) {
      return;
    }

    void submitChatMessage("Xin chào", { showUserMessage: false });
  }, [open, isAdminArea, sessionId, messages.length, pending, submitChatMessage]);

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

          <div className="p-2.5 overflow-y-auto display grid gap-2.5 bg-gradient-to-b from-[#f3f7ff] to-[#fbf9ff] scrollbar-thin">
            {messages.map((msg) => (
              <article key={msg.id} className="w-full">
                <div className={`flex gap-2 items-start ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" ? (
                    <div className="w-7 h-7 rounded-full grid place-items-center text-[#0f2233] bg-gradient-to-br from-[#d8ecff] to-[#f6f2ff] border border-[#0f494f]/15 shadow-sm [&>svg]:w-4 [&>svg]:h-4" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                        <path
                          d="M8 4.5a1 1 0 0 1 2 0v1h4v-1a1 1 0 1 1 2 0v1.2a4.5 4.5 0 0 1 4 4.48v5.32a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 15.5v-5.32a4.5 4.5 0 0 1 4-4.48V4.5Zm0 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8 1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                  ) : null}
                  <div className={`max-w-[84%] rounded-[18px] p-2.5 px-3 border border-[#0f2233]/10 shadow-sm animate-chatbot-pop ${msg.role === "user" ? "bg-[#efeaff] border-[#0f494f]/12 origin-top-right" : "bg-[#f7faff] origin-top-left"}`}>
                    {msg.role === "assistant" ? renderAssistantMarkdown(msg.text) : <p className="m-0 text-sm leading-relaxed">{msg.text.replace(/\s*\[Mã:\s*[a-f0-9]+\]/gi, "")}</p>}
                    {msg.products.length > 0 ? (
                      <div className="mt-2 grid gap-2">
                        {msg.products.map((product, index) => (
                          <article
                            key={product._id}
                            className="grid gap-2 text-[#0f2233] p-3 border border-black/8 rounded-xl bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-[#0f494f]/18 animate-chatbot-pop group"
                            style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
                          >
                            <Link
                              to={`/products/${product._id}`}
                              className="grid grid-cols-[56px_1fr] gap-2 text-[#0f2233] no-underline"
                              onClick={() => {
                                trackEvent({
                                  eventType: "click",
                                  productId: product._id,
                                  category: product.category,
                                  metadata: {
                                    source: "chatbot_card_click",
                                  },
                                });
                              }}
                            >
                              <img
                                src={getProductImageSrc(product)}
                                alt={product.name}
                                className="w-14 h-14 object-cover rounded-lg bg-[#eef4fa] transition-all group-hover:scale-[1.04] group-hover:shadow-md"
                                onError={(event) => {
                                  event.currentTarget.onerror = null;
                                  event.currentTarget.src = "/placeholder.svg";
                                }}
                              />
                              <div>
                                <h4 className="m-0 text-xs font-bold leading-tight">{product.name}</h4>
                                <p className="mt-1 text-xs font-bold text-[#0f314f] transition-colors group-hover:text-[#1a4d7a]">{formatVnd(product.finalPrice || product.price)}</p>
                                {Number(product.price || 0) > Number(product.finalPrice || product.price || 0) ? (
                                  <p className="mt-0.5 text-[11px] text-[#6b7280] line-through">{formatVnd(product.price)}</p>
                                ) : null}
                                <p className="mt-0.5 text-[11px] text-[#64748b]">{product.reason}</p>
                              </div>
                            </Link>

                            <div className="flex gap-1 mt-1.5 w-full">
                              <button
                                type="button"
                                className="flex-1 border border-black/10 bg-white text-[#0f2233] rounded-lg min-h-[30px] text-[11px] font-semibold cursor-pointer transition-all hover:bg-[#edf4ff] active:scale-97"
                                onClick={() => {
                                  addToCart({ ...product, id: product._id });
                                  trackEvent({
                                    eventType: "cart",
                                    productId: product._id,
                                    category: product.category,
                                    metadata: {
                                      source: "chatbot_add_to_cart",
                                    },
                                  });
                                }}
                              >
                                Thêm giỏ
                              </button>
                              
                              <button
                                type="button"
                                className="flex-1 border border-black/10 bg-[#fbf5ff] text-[#6b21a8] rounded-lg min-h-[30px] text-[11px] font-semibold cursor-pointer transition-all hover:bg-[#f3e8ff] active:scale-97"
                                onClick={() => {
                                  if (!compareProduct1) {
                                    setCompareProduct1(product);
                                    setMessages((prev) => [
                                      ...prev,
                                      createMessage("assistant", `Bạn đã chọn **${product.name}** làm sản phẩm đầu tiên. Vui lòng bấm nút **"So sánh"** trên một sản phẩm khác trong danh sách, hoặc gõ tên sản phẩm thứ hai để xem so sánh và nhận xét từ AI.`),
                                    ]);
                                  } else {
                                    if (compareProduct1._id === product._id) {
                                      setCompareProduct1(null);
                                      setMessages((prev) => [
                                        ...prev,
                                        createMessage("assistant", `Đã hủy chọn so sánh sản phẩm **${product.name}**.`),
                                      ]);
                                    } else {
                                      const prod1 = compareProduct1;
                                      setCompareProduct1(null);
                                      sendMessage(`So sánh ${prod1.name} [Mã: ${prod1._id}] và ${product.name} [Mã: ${product._id}]`);
                                    }
                                  }
                                }}
                              >
                                So sánh
                              </button>

                              <button
                                type="button"
                                className="flex-1 border border-black/10 bg-[#f0fdf4] text-[#166534] rounded-lg min-h-[30px] text-[11px] font-semibold cursor-pointer transition-all hover:bg-[#dcfce7] active:scale-97"
                                onClick={() => {
                                  sendMessage(`Tư vấn chi tiết cấu hình sản phẩm ${product.name} [Mã: ${product._id}]`);
                                }}
                              >
                                Chi tiết
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
            {pending ? (
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
            <div className="p-2 px-3 flex items-center justify-between border-t border-purple-100 bg-[#fdf4ff] text-[#6b21a8] text-xs font-semibold animate-fade-in">
              <span className="truncate">
                Đang chọn: <strong>{compareProduct1.name}</strong> (Bấm "So sánh" trên thẻ khác)
              </span>
              <button
                type="button"
                className="text-red-500 hover:text-red-700 font-bold ml-2 cursor-pointer"
                onClick={() => setCompareProduct1(null)}
              >
                Hủy
              </button>
            </div>
          ) : null}

          <form
            className="border-t border-black/8 grid grid-cols-[1fr_auto_auto] gap-2 p-2.5 bg-white items-center"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage(input);
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={recording ? "Đang lắng nghe..." : "Nhập nhu cầu của bạn..."}
              disabled={pending}
              className={`border rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 ${
                recording ? "border-red-400 bg-red-50 focus:ring-red-200" : "border-black/10 focus:ring-[#dfeeff]"
              }`}
            />
            
            <button
              type="button"
              onClick={toggleRecording}
              disabled={pending}
              title={recording ? "Dừng ghi âm" : "Ghi âm giọng nói"}
              className={`border border-black/10 rounded-xl min-w-[40px] h-[36px] flex items-center justify-center cursor-pointer transition-all active:scale-95 ${
                recording 
                  ? "bg-red-500 text-white animate-pulse" 
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                {recording ? (
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                ) : (
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                )}
              </svg>
            </button>

            <button
              type="submit"
              disabled={pending || !String(input).trim()}
              aria-label="Gửi"
              title="Gửi"
              className="border border-black/10 rounded-xl bg-[#dfeeff] text-[#0f314f] min-w-[44px] h-[36px] font-bold cursor-pointer transition-all hover:shadow-sm active:scale-96 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? (
                "..."
              ) : (
                <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true" className="w-[18px] h-[18px]">
                  <path
                    d="M3.4 11.2a1 1 0 0 0 0 1.6l16.6 8.4a1 1 0 0 0 1.4-1.1l-3.1-7.1-15-1.8Zm0 1.6 16.6-8.4a1 1 0 0 1 1.4 1.1l-3.1 7.1-15 1.8Z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </button>
          </form>
        </section>
      ) : null}

      <button type="button" className="border border-black/10 rounded-full bg-[#dfeeff] text-[#0f314f] py-2.5 px-4.5 text-sm font-bold cursor-pointer shadow-[0_10px_24px_rgba(15,34,51,0.15)] transition-all duration-[100ms] hover:bg-[#e8f4ff] hover:shadow-[0_12px_28px_rgba(15,34,51,0.18)] active:scale-97" onClick={() => setOpen((prev) => !prev)}>
        {open ? "Đóng" : "Chat AI"}
      </button>
    </div>
  );
}

export default ChatbotWidget;
