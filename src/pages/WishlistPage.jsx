import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useNotification } from "../context/NotificationContext";
import { fetchWishlist, removeFromWishlist } from "../services/wishlistService";
import { getProductImageSrc } from "../utils/productUtils";
import { parsePrice, formatPrice } from "../utils/priceUtils";
import "../css/wishlist-page.css";

function WishlistPage() {
  const { auth } = useAuth();
  const { addToCart } = useCart();
  const { success, error } = useNotification();
  const [wishlist, setWishlist] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadWishlist();
  }, [auth?.token]);

  const loadWishlist = async () => {
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
  };

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
      <main className="container page-content wishlist-page">
        <h1 className="wishlist-page__title">Danh sách yêu thích</h1>
        <div className="loading">Đang tải...</div>
      </main>
    );
  }

  return (
    <main className="container page-content wishlist-page">
      <h1 className="wishlist-page__title">Danh sách yêu thích</h1>

      {wishlist.length === 0 ? (
        <div className="wishlist-empty">
          <div className="wishlist-empty__icon">❤️</div>
          <p className="wishlist-empty__text">Danh sách yêu thích của bạn trống.</p>
          <Link to="/products" className="wishlist-empty__cta">
            Khám phá sản phẩm
          </Link>
        </div>
      ) : (
        <div className="wishlist-grid">
          {wishlist.map((product) => (
            <div key={product._id} className="wishlist-item">
              <div className="wishlist-item__image-container">
                <img
                  src={getProductImageSrc(product)}
                  alt={product.name}
                  className="wishlist-item__image"
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder.svg";
                  }}
                />
              </div>
              <div className="wishlist-item__content">
                <h3 className="wishlist-item__name">{product.name}</h3>
                <div className="wishlist-item__price">
                  {formatPrice(parsePrice(product.price))}
                </div>
                <div className="wishlist-item__actions">
                  <button
                    className="wishlist-item__add-to-cart"
                    onClick={() => handleAddToCart(product)}
                  >
                    Thêm vào giỏ
                  </button>
                  <button
                    className="wishlist-item__remove"
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

      <div className="wishlist-footer">
        <Link to="/products" className="wishlist-footer__link">
          ← Quay lại mua sắm
        </Link>
      </div>
    </main>
  );
}

export default WishlistPage;
