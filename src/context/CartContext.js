import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";

const CartContext = createContext();

const CART_STORAGE_PREFIX = "ecommerce_cart";

function getCartStorageKey(userId) {
  return `${CART_STORAGE_PREFIX}:${userId || "guest"}`;
}

export function CartProvider({ children }) {
  const { auth } = useAuth();
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
  const [toast, setToast] = useState({ show: false, message: "" });
  const toastTimeoutRef = useRef(null);

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
    
    // Hiển thị thông báo Toast
    setToast({ show: true, message: `Đã thêm ${product.name} vào giỏ hàng!` });
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ show: false, message: "" });
    }, 3000); // Tự động ẩn sau 3 giây
  };

  // Xóa sản phẩm khỏi giỏ hàng
  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
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

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart }}>
      {children}
      
      {/* Giao diện Toast hiển thị trên cùng */}
      {toast.show && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          backgroundColor: "#333",
          color: "#fff",
          padding: "16px 24px",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "16px"
        }}>
          <span style={{ color: "#4caf50", fontSize: "20px" }}>✔</span>
          {toast.message}
        </div>
      )}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);