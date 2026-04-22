import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import "../css/chatbot.css";

const SESSION_STORAGE_KEY = "chatbot_session_id";
const BEHAVIOR_STORAGE_KEY = "chatbot_behavior";

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
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
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
  const [messages, setMessages] = useState(() => [
    createMessage(
      "assistant",
      "Xin chao, minh la AI Assistant. Ban can goi y san pham theo nhu cau hay ngan sach nao?"
    ),
  ]);

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
    return Array.isArray(lastAssistant?.quickReplies) ? lastAssistant.quickReplies : [];
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

    const userMsg = createMessage("user", text);
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setPending(true);

    trackEvent({
      eventType: "message",
      queryText: text,
      metadata: {
        page: location.pathname,
      },
    });

    try {
      const behavior = readBehavior();
      const response = await fetch("/api/chatbot/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          sessionId,
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

  if (isAdminArea) {
    return null;
  }

  return (
    <div className={`chatbot-widget ${open ? "open" : ""}`}>
      {open ? (
        <section className="chatbot-panel" aria-label="AI chatbot">
          <header className="chatbot-header">
            <div>
              <strong>AI Shopping Assistant</strong>
              <p>Goi y nhanh theo nhu cau cua ban</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Dong chatbot">
              ×
            </button>
          </header>

          <div className="chatbot-messages">
            {messages.map((msg) => (
              <article key={msg.id} className={`chatbot-message ${msg.role}`}>
                <p>{msg.text}</p>
                {msg.products.length > 0 ? (
                  <div className="chatbot-product-list">
                    {msg.products.map((product) => (
                      <article key={product._id} className="chatbot-product-card">
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
                            <p className="price">{formatVnd(product.price)}</p>
                            {Number(product.originalPrice || 0) > Number(product.price || 0) ? (
                              <p className="old-price">{formatVnd(product.originalPrice)}</p>
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
                          Them vao gio
                        </button>
                      </article>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
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
              placeholder="Nhap nhu cau cua ban..."
              disabled={pending}
            />
            <button type="submit" disabled={pending || !String(input).trim()}>
              {pending ? "..." : "Gui"}
            </button>
          </form>
        </section>
      ) : null}

      <button type="button" className="chatbot-toggle" onClick={() => setOpen((prev) => !prev)}>
        {open ? "Dong" : "Chat AI"}
      </button>
    </div>
  );
}

export default ChatbotWidget;
