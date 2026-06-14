import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useNotification } from "../context/NotificationContext";
import { fetchWishlist, removeFromWishlist } from "../services/wishlistService";
import { getProductImageSrc } from "../utils/productUtils";
import { parsePrice, formatPrice } from "../utils/priceUtils";
function WishlistPage() {
  const { auth } = useAuth();
  const { addToCart } = useCart();
  const { success, error } = useNotification();
  const [wishlist, setWishlist] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadWishlist = useCallback(async () => {
    if (!auth?.token) {
      setWishlist([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await fetchWishlist(auth.token);
      setWishlist(Array.isArray(data?.wishlist) ? data.wishlist : []);
    } catch (err) {
      error(err?.message || "Không thể tải danh sách yêu thích.");
      setWishlist([]);
    } finally {
      setIsLoading(false);
    }
  }, [auth?.token, error]);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  const handleRemove = async (productId) => {
    if (!auth?.token) return;

    try {
      await removeFromWishlist(productId, auth.token);
      setWishlist((prev) => prev.filter((item) => item._id !== productId));
      success("Đã xóa khỏi danh sách yêu thích.");
    } catch (err) {
      error(err?.message || "Không thể xóa sản phẩm.");
    }
  };

  const handleAddToCart = (product) => {
    addToCart({
      id: product._id,
      name: product.name,
      price: product.price,
      finalPrice: product.finalPrice,
      image: product.image,
      category: product.category,
    });
  };

  if (isLoading) {
    return (
      <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10 p-8 max-w-[1200px] max-[768px]:p-6 max-[768px]:px-3">
        <h1 className="text-[2rem] font-bold text-[#111827] mb-8 max-[768px]:text-2xl max-[768px]:mb-6">Danh sách yêu thích</h1>
        <div className="text-center p-8 text-[#6b7280] text-base">Đang tải...</div>
      </main>
    );
  }

  return (
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10 p-8 max-w-[1200px] max-[768px]:p-6 max-[768px]:px-3">
      <h1 className="text-[2rem] font-bold text-[#111827] mb-8 max-[768px]:text-2xl max-[768px]:mb-6">Danh sách yêu thích</h1>

      {wishlist.length === 0 ? (
        <div className="text-center py-12 px-4 bg-[#f9fafb] rounded-lg flex flex-col items-center gap-4">
          <div className="text-[4rem] opacity-60">❤️</div>
          <p className="text-lg text-[#6b7280] mb-4">Danh sách yêu thích của bạn trống.</p>
          <Link to="/products" className="inline-block py-3 px-6 bg-[#3b82f6] text-white no-underline rounded font-medium transition-colors hover:bg-[#2563eb]">
            Khám phá sản phẩm
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-6 mb-8 max-[768px]:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] max-[768px]:gap-4 max-[480px]:grid-cols-2 max-[480px]:gap-3">
          {wishlist.map((product) => (
            <div key={product._id} className="bg-white border border-[#e5e7eb] rounded-lg overflow-hidden transition-all flex flex-col group hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:border-[#d1d5db]">
              <div className="w-full h-[180px] bg-[#f3f4f6] flex items-center justify-center overflow-hidden max-[768px]:h-[150px]">
                <img
                  src={getProductImageSrc(product)}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder.svg";
                  }}
                />
              </div>
              <div className="p-4 flex flex-col gap-3 grow max-[480px]:p-3">
                <h3 className="text-[0.9375rem] font-semibold text-[#111827] leading-[1.4] line-clamp-2 m-0 max-[768px]:text-sm">{product.name}</h3>
                <div className="text-base font-bold text-[#dc2626]">
                  {formatPrice(parsePrice(product.price))}
                </div>
                <div className="flex gap-2 mt-auto max-[480px]:flex-col">
                  <button
                    className="flex-1 p-2 border-none rounded bg-[#10b981] text-white text-xs font-medium cursor-pointer transition-colors hover:bg-[#059669]"
                    onClick={() => handleAddToCart(product)}
                  >
                    Thêm vào giỏ
                  </button>
                  <button
                    className="flex-1 p-2 rounded bg-[#f3f4f6] text-[#374151] border border-[#d1d5db] text-xs font-medium cursor-pointer transition-colors hover:bg-[#e5e7eb]"
                    onClick={() => handleRemove(product._id)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-center mt-12 pt-8 border-t border-[#e5e7eb]">
        <Link to="/products" className="text-[#3b82f6] no-underline font-medium transition-colors hover:text-[#2563eb]">
          ← Quay lại mua sắm
        </Link>
      </div>
    </main>
  );
}

export default WishlistPage;
