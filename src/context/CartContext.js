import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useNotification } from "./NotificationContext";
import { trackEvent } from "../services/analyticsService";

const CartContext = createContext();

const CART_STORAGE_PREFIX = "ecommerce_cart";

function getCartStorageKey(userId) {
  return `${CART_STORAGE_PREFIX}:${userId || "guest"}`;
}

export function CartProvider({ children }) {
  const { auth } = useAuth();
  const { success } = useNotification();
  const userId = auth?.user?.id || null;
  const storageKey = useMemo(() => getCartStorageKey(userId), [userId]);

  // Use refs for values needed inside callbacks to avoid stale closures
  // while keeping the callbacks themselves stable (no dependency on auth/success).
  const authRef = useRef(auth);
  authRef.current = auth;

  const successRef = useRef(success);
  successRef.current = success;

  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(getCartStorageKey(null));
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      return [];
    }
  });

  // Reload cart when user changes (login / logout)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setCart(saved ? JSON.parse(saved) : []);
    } catch (error) {
      setCart([]);
    }
  }, [storageKey]);

  // Persist cart to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(cart));
  }, [storageKey, cart]);

  // ── Stable callbacks (never re-created) ──

  const addToCart = useCallback((product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        // Tăng số lượng nếu sản phẩm đã có trong giỏ
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      // Thêm mới nếu chưa có (với trạng thái selected = true)
      return [...prevCart, { ...product, quantity: 1, selected: true }];
    });

    successRef.current(`Đã thêm ${product.name} vào giỏ hàng!`, {
      title: "Giỏ hàng",
      duration: 3000,
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart((prevCart) => {
      const removedItem = prevCart.find((item) => item.id === productId);

      if (removedItem) {
        trackEvent({
          eventName: "remove_from_cart",
          token: authRef.current?.token,
          metadata: {
            productId: String(removedItem.id || productId),
            productName: String(removedItem.name || ""),
            category: String(removedItem.category || ""),
            quantity: Number(removedItem.quantity || 1),
            price: Number(removedItem.finalPrice || removedItem.price || 0),
          },
        });

        successRef.current(`Đã xóa ${removedItem.name} khỏi giỏ hàng.`, {
          title: "Giỏ hàng",
          duration: 3000,
        });
      }

      return prevCart.filter((item) => item.id !== productId);
    });
  }, []);

  // Cập nhật số lượng sản phẩm (cộng/trừ)
  const updateQuantity = useCallback((productId, amount) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === productId ? { ...item, quantity: Math.max(1, item.quantity + amount) } : item
      )
    );
  }, []);

  // Xóa toàn bộ giỏ hàng (dùng khi đặt hàng thành công)
  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  // Toggle selection trạng thái của một sản phẩm
  const toggleItemSelection = useCallback((productId) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === productId ? { ...item, selected: !item.selected } : item
      )
    );
  }, []);

  // Chọn tất cả sản phẩm
  const selectAllItems = useCallback(() => {
    setCart((prevCart) => prevCart.map((item) => ({ ...item, selected: true })));
  }, []);

  // Bỏ chọn tất cả sản phẩm
  const deselectAllItems = useCallback(() => {
    setCart((prevCart) => prevCart.map((item) => ({ ...item, selected: false })));
  }, []);

  // Xóa các sản phẩm được chọn từ giỏ hàng
  const removeSelectedItems = useCallback(() => {
    setCart((prevCart) => prevCart.filter((item) => !item.selected));
  }, []);

  // ── Memoize context value to prevent unnecessary re-renders ──
  const value = useMemo(
    () => ({
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      toggleItemSelection,
      selectAllItems,
      deselectAllItems,
      removeSelectedItems,
    }),
    [
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      toggleItemSelection,
      selectAllItems,
      deselectAllItems,
      removeSelectedItems,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);