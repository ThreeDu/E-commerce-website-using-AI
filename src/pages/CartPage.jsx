import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashCan } from "@fortawesome/free-solid-svg-icons";
import { useCart } from "../context/CartContext";
import { useNotification } from "../context/NotificationContext";
import { getProductImageSrc } from "../utils/productUtils";
import { parsePrice, formatPrice } from "../utils/priceUtils";
import "../css/cart.css";

function CartPage() {
  const {
    cart,
    removeFromCart,
    updateQuantity,
    toggleItemSelection,
    selectAllItems,
    deselectAllItems,
  } = useCart();
  const { error } = useNotification();
  const [productPrices, setProductPrices] = useState({});
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);

  // Fetch fresh prices for all products in cart
  useEffect(() => {
    const fetchFreshPrices = async () => {
      if (cart.length === 0) {
        setProductPrices({});
        return;
      }

      setIsLoadingPrices(true);
      try {
        const productIds = cart.map((item) => item.id);
        const response = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: productIds }),
        });

        if (!response.ok) throw new Error("Failed to fetch prices");

        const data = await response.json();
        const priceMap = {};
        (Array.isArray(data) ? data : []).forEach((product) => {
          priceMap[product._id] = {
            price: product.price,
            finalPrice: product.finalPrice || product.price,
            discountPercent: product.discountPercent || 0,
            stock: product.stock,
          };
        });
        setProductPrices(priceMap);
      } catch (err) {
        console.error("Error fetching prices:", err);
        setProductPrices({});
      } finally {
        setIsLoadingPrices(false);
      }
    };

    fetchFreshPrices();
  }, [cart.length]);

  // Calculate prices using fresh data or fallback to cart item data
  const getEffectivePrice = (item) => {
    const priceData = productPrices[item.id];
    if (priceData) {
      return priceData.finalPrice || priceData.price;
    }
    return parsePrice(item.finalPrice || item.price);
  };

  const getOriginalPrice = (item) => {
    const priceData = productPrices[item.id];
    if (priceData && priceData.finalPrice !== priceData.price) {
      return priceData.price;
    }
    return item.price ? parsePrice(item.price) : null;
  };

  const getDiscountPercent = (item) => {
    const priceData = productPrices[item.id];
    if (priceData) {
      return priceData.discountPercent;
    }
    return 0;
  };

  const selectedItems = cart.filter((item) => item.selected);
  const hasUnselectedItems = cart.some((item) => !item.selected);
  const allItemsSelected = cart.length > 0 && cart.every((item) => item.selected);

  // Calculate totals for selected items
  const selectedItemsTotal = selectedItems.reduce((total, item) => {
    return total + getEffectivePrice(item) * item.quantity;
  }, 0);

  const allItemsTotal = cart.reduce((total, item) => {
    return total + getEffectivePrice(item) * item.quantity;
  }, 0);

  return (
    <main className="container page-content cart-page">
      <h2 className="cart-page__title">Giỏ hàng của bạn</h2>

      {cart.length === 0 ? (
        <div className="cart-empty">
          <div className="cart-empty__icon">🛒</div>
          <p className="cart-empty__text">Giỏ hàng đang trống.</p>
          <Link to="/products" className="cart-empty__cta">
            Tiếp tục mua sắm
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          {/* Cột danh sách sản phẩm */}
          <div className="cart-items-col">
            {/* Selection bar */}
            <div className="cart-selection-bar">
              <label className="cart-checkbox-label">
                <input
                  type="checkbox"
                  checked={allItemsSelected}
                  onChange={(e) => (e.target.checked ? selectAllItems() : deselectAllItems())}
                />
                <span>Chọn tất cả ({cart.length})</span>
              </label>
              {hasUnselectedItems && (
                <button
                  type="button"
                  className="cart-select-all-btn"
                  onClick={selectAllItems}
                >
                  Chọn tất cả
                </button>
              )}
            </div>

            {isLoadingPrices && cart.length > 0 && (
              <div className="cart-loading-notice">
                Đang cập nhật giá sản phẩm...
              </div>
            )}

            {cart.map((item) => {
              const effectivePrice = getEffectivePrice(item);
              const originalPrice = getOriginalPrice(item);
              const discountPercent = getDiscountPercent(item);

              return (
                <div key={item.id} className="cart-item">
                  <label className="cart-item__checkbox">
                    <input
                      type="checkbox"
                      checked={item.selected || false}
                      onChange={() => toggleItemSelection(item.id)}
                    />
                  </label>

                  <img
                    src={getProductImageSrc(item)}
                    alt={item.name}
                    className="cart-item__image"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = "/placeholder.svg";
                    }}
                  />

                  <div className="cart-item__info">
                    <h4 className="cart-item__name">{item.name}</h4>
                    <div className="cart-item__price-section">
                      {originalPrice && originalPrice !== effectivePrice ? (
                        <>
                          <span className="cart-item__original-price">
                            {formatPrice(originalPrice)}
                          </span>
                          <span className="cart-item__price">
                            {formatPrice(effectivePrice)}
                          </span>
                          {discountPercent > 0 && (
                            <span className="cart-item__discount">
                              -{discountPercent}%
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="cart-item__price">
                          {formatPrice(effectivePrice)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Nút cộng trừ số lượng */}
                  <div className="cart-qty">
                    <button className="cart-qty__btn" onClick={() => updateQuantity(item.id, -1)}>
                      -
                    </button>
                    <span className="cart-qty__value">{item.quantity}</span>
                    <button className="cart-qty__btn" onClick={() => updateQuantity(item.id, 1)}>
                      +
                    </button>
                  </div>

                  {/* Tổng tiền của 1 sản phẩm */}
                  <div className="cart-item__total">
                    {formatPrice(effectivePrice * item.quantity)}
                  </div>

                  {/* Nút Xóa */}
                  <button
                    type="button"
                    className="cart-item__remove"
                    aria-label={`Xóa ${item.name} khỏi giỏ hàng`}
                    onClick={() => removeFromCart(item.id)}
                  >
                    <FontAwesomeIcon icon={faTrashCan} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Cột tóm tắt đơn hàng (Tính tổng) */}
          <div className="cart-summary">
            <h3 className="cart-summary__title">
              {selectedItems.length > 0 ? "Tóm tắt đơn hàng" : "Giỏ hàng"}
            </h3>

            {selectedItems.length > 0 && selectedItems.length < cart.length && (
              <div className="cart-summary__notice">
                Bạn chỉ chọn {selectedItems.length}/{cart.length} sản phẩm
              </div>
            )}

            <div className="cart-summary__row">
              <span>Số lượng:</span>
              <span>
                {selectedItems.reduce((sum, item) => sum + item.quantity, 0)} sản phẩm
                {selectedItems.length < cart.length && ` (chỉ ${selectedItems.length} được chọn)`}
              </span>
            </div>

            <div className="cart-summary__row--total">
              <span>Tổng tiền:</span>
              <span className="cart-summary__total-price">
                {formatPrice(selectedItemsTotal)}
              </span>
            </div>

            {selectedItems.length === 0 ? (
              <button type="button" className="cart-summary__checkout" disabled>
                Chọn sản phẩm để thanh toán
              </button>
            ) : (
              <Link to="/checkout" state={{ selectedItems }} className="cart-summary__checkout">
                Tiến hành thanh toán ({selectedItems.length})
              </Link>
            )}

            {hasUnselectedItems && (
              <div className="cart-summary__info">
                Các sản phẩm chưa chọn sẽ giữ lại trong giỏ hàng
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default CartPage;