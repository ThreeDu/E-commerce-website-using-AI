import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { getProductImageSrc } from "../utils/productUtils";
import { parsePrice, formatPrice } from "../utils/priceUtils";
import "../css/cart.css";

function CartPage() {
  const { cart, removeFromCart, updateQuantity } = useCart();

  // Tính tổng tiền của toàn bộ giỏ hàng
  const totalPrice = cart.reduce((total, item) => {
    return total + parsePrice(item.price) * item.quantity;
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
            {cart.map((item) => (
              <div key={item.id} className="cart-item">
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
                  <p className="cart-item__price">{formatPrice(parsePrice(item.price))}</p>
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
                  {formatPrice(parsePrice(item.price) * item.quantity)}
                </div>

                {/* Nút Xóa */}
                <button className="cart-item__remove" onClick={() => removeFromCart(item.id)}>
                  Xóa
                </button>
              </div>
            ))}
          </div>

          {/* Cột tóm tắt đơn hàng (Tính tổng) */}
          <div className="cart-summary">
            <h3 className="cart-summary__title">
              Tóm tắt đơn hàng
            </h3>
            <div className="cart-summary__row">
              <span>Số lượng:</span>
              <span>{cart.reduce((sum, item) => sum + item.quantity, 0)} sản phẩm</span>
            </div>
            <div className="cart-summary__row--total">
              <span>Tổng tiền:</span>
              <span className="cart-summary__total-price">{formatPrice(totalPrice)}</span>
            </div>
            <Link to="/checkout" className="cart-summary__checkout">
              Tiến hành thanh toán
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

export default CartPage;