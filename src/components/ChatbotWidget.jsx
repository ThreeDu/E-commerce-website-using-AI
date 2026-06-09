import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import "../css/chatbot.css";

const SESSION_STORAGE_KEY = "chatbot_session_id";
const BEHAVIOR_STORAGE_KEY = "chatbot_behavior";


function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function looksLikeSpecSearchQuery(value) {
  const text = normalizeSearchText(value);
  if (!text) {
    return false;
  }

  return /\b(\d+(?:[.,]\d+)?\s*(gb|tb|mp|hz|mah|inch|")|camera|ram|rom|dung luong|bo nho|man hinh|tan so quet|pin|battery|screen|display|chip)\b/.test(text);
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
    <div className="chatbot-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ node, ...props }) => <table className="chatbot-markdown-table" {...props} />,
          th: ({ node, ...props }) => <th {...props} />,
          td: ({ node, ...props }) => <td {...props} />,
          p: ({ node, ...props }) => <p {...props} />,
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
  const { cart, addToCart } = useCart();
  const { auth } = useAuth();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState([]);

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

  const trackEvent = async ({ eventType, productId = "", category = "", queryText = "", metadata = {} }) => {
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
  };

  const sendMessage = async (content) => {
    const text = String(content || "").trim();
    if (!text || pending) {
      return;
    }

    if (looksLikeCompareQuery(text)) {
      return sendMessageThroughMainChat(text);
    }

    return sendMessageThroughMainChat(text);
  };

  const submitChatMessage = async (text, options = {}) => {
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
  };

  const sendMessageThroughMainChat = async (text) => submitChatMessage(text, { showUserMessage: true });

  const sendDescriptionSearch = async (descriptionText) => {
    const text = String(descriptionText || input || "").trim();
    if (!text || pending) return;

    if (looksLikeCompareQuery(text)) {
      return sendMessageThroughMainChat(text);
    }

    const userMsg = createMessage("user", text);
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setPending(true);

    trackEvent({ eventType: "description_search", queryText: text });

    try {
      const behavior = readBehavior();
      const response = await fetch("/api/chatbot/description-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, descriptionText: text, context: { page: location.pathname, userBehavior: behavior } }),
      });

      const data = await response.json();
      if (!response.ok || !data) {
        setMessages((prev) => [...prev, createMessage("assistant", data?.message || "Không tìm được gợi ý theo mô tả.")]);
        return;
      }

      const products = Array.isArray(data?.products) ? data.products : [];

      setMessages((prev) => [
        ...prev,
        createMessage("assistant", products.length ? `Tìm thấy ${products.length} sản phẩm phù hợp.` : "Không tìm thấy sản phẩm phù hợp.", {
          products,
        }),
      ]);

      products.forEach((item) => {
        trackEvent({ eventType: "impression", productId: item._id, category: item.category, metadata: { source: "chatbot_description_search" } });
      });
    } catch (error) {
      setMessages((prev) => [...prev, createMessage("assistant", "Lỗi khi tìm gợi ý theo mô tả.")]);
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    if (isAdminArea || !open || !sessionId || messages.length > 0 || pending) {
      return;
    }

    void submitChatMessage("Xin chào", { showUserMessage: false });
  }, [open, isAdminArea, sessionId, messages.length, pending]);

  if (isAdminArea) {
    return null;
  }

  return (
    <div className={`chatbot-widget ${open ? "open" : ""}`}>
      {open ? (
        <section className="chatbot-panel" aria-label="AI chatbot">
          <header className="chatbot-header">
            <div className="chatbot-header-main">
              <div className="chatbot-header-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                  <path
                    d="M8 4.5a1 1 0 0 1 2 0v1h4v-1a1 1 0 1 1 2 0v1.2a4.5 4.5 0 0 1 4 4.48v5.32a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 15.5v-5.32a4.5 4.5 0 0 1 4-4.48V4.5Zm0 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8 1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div className="chatbot-header-text">
                <strong>AI Shopping Assistant</strong>
                <p>Gợi ý nhanh theo nhu cầu của bạn</p>
              </div>
            </div>


            

            <button type="button" onClick={() => setOpen(false)} aria-label="Dong chatbot">
              ×
            </button>
          </header>

          <div className="chatbot-messages">
            {messages.map((msg) => (
              <article key={msg.id} className={`chatbot-message ${msg.role}`}>
                <div className={`chatbot-message-row ${msg.role}`}>
                  {msg.role === "assistant" ? (
                    <div className="chatbot-avatar" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                        <path
                          d="M8 4.5a1 1 0 0 1 2 0v1h4v-1a1 1 0 1 1 2 0v1.2a4.5 4.5 0 0 1 4 4.48v5.32a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 15.5v-5.32a4.5 4.5 0 0 1 4-4.48V4.5Zm0 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8 1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                  ) : null}
                  <div className="chatbot-bubble">
                    {msg.role === "assistant" ? renderAssistantMarkdown(msg.text) : <p>{msg.text}</p>}
                    {msg.products.length > 0 ? (
                      <div className="chatbot-product-list">
                        {msg.products.map((product, index) => (
                          <article
                            key={product._id}
                            className="chatbot-product-card"
                            style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
                          >
                            <Link
                              to={`/products/${product._id}`}
                              className="chatbot-product-main"
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
                                onError={(event) => {
                                  event.currentTarget.onerror = null;
                                  event.currentTarget.src = "/placeholder.svg";
                                }}
                              />
                              <div>
                                <h4>{product.name}</h4>
                                <p className="price">{formatVnd(product.finalPrice || product.price)}</p>
                                {Number(product.price || 0) > Number(product.finalPrice || product.price || 0) ? (
                                  <p className="old-price">{formatVnd(product.price)}</p>
                                ) : null}
                                <p className="reason">{product.reason}</p>
                              </div>
                            </Link>

                            <button
                              type="button"
                              className="chatbot-add-cart-btn"
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
                              Thêm vào giỏ
                            </button>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
            {pending ? (
              <article className="chatbot-message assistant">
                <div className="chatbot-message-row assistant">
                  <div className="chatbot-avatar" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                      <path
                        d="M8 4.5a1 1 0 0 1 2 0v1h4v-1a1 1 0 1 1 2 0v1.2a4.5 4.5 0 0 1 4 4.48v5.32a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 15.5v-5.32a4.5 4.5 0 0 1 4-4.48V4.5Zm0 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8 1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  <div className="chatbot-bubble">
                    <div className="chatbot-typing" aria-label="Dang nhap">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              </article>
            ) : null}
          </div>

          {quickReplies.length > 0 ? (
            <div className="chatbot-quick-replies">
              {quickReplies.map((item) => (
                <button key={item} type="button" onClick={() => sendMessage(item)} disabled={pending}>
                  {item}
                </button>
              ))}
            </div>
          ) : null}

          <form
            className="chatbot-input"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage(input);
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Nhập nhu cầu của bạn..."
              disabled={pending}
            />
            <button
              type="submit"
              disabled={pending || !String(input).trim()}
              aria-label="Gửi"
              title="Gửi"
            >
              {pending ? (
                "..."
              ) : (
                <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
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

      <button type="button" className="chatbot-toggle" onClick={() => setOpen((prev) => !prev)}>
        {open ? "Đóng" : "Chat AI"}
      </button>
    </div>
  );
}

export default ChatbotWidget;
