import { createContext, useContext, useEffect, useMemo, useState } from "react";
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

  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(getCartStorageKey(null));
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      return [];
    }
  });
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setCart(saved ? JSON.parse(saved) : []);
    } catch (error) {
      setCart([]);
    }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(cart));
  }, [storageKey, cart]);

  const addToCart = (product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        // Tăng số lượng nếu sản phẩm đã có trong giỏ
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      // Thêm mới nếu chưa có
      return [...prevCart, { ...product, quantity: 1 }];
    });
    
    success(`Đã thêm ${product.name} vào giỏ hàng!`, {
      title: "Giỏ hàng",
      duration: 3000,
    });
  };

  // Xóa sản phẩm khỏi giỏ hàng
  const removeFromCart = (productId) => {
    const removedItem = cart.find((item) => item.id === productId);
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));

    if (removedItem) {
      trackEvent({
        eventName: "remove_from_cart",
        token: auth?.token,
        metadata: {
          productId: String(removedItem.id || productId),
          productName: String(removedItem.name || ""),
          category: String(removedItem.category || ""),
          quantity: Number(removedItem.quantity || 1),
          price: Number(removedItem.finalPrice || removedItem.price || 0),
        },
      });

      success(`Đã xóa ${removedItem.name} khỏi giỏ hàng.`, {
        title: "Giỏ hàng",
        duration: 3000,
      });
    }
  };

  // Cập nhật số lượng sản phẩm (cộng/trừ)
  const updateQuantity = (productId, amount) => {
    setCart((prevCart) => 
      prevCart.map((item) => item.id === productId ? { ...item, quantity: Math.max(1, item.quantity + amount) } : item)
    );
  };

  // Xóa toàn bộ giỏ hàng (dùng khi đặt hàng thành công)
  const clearCart = () => {
    setCart([]);
  };

  return <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart }}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);