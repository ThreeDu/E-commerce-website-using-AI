import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashCan } from "@fortawesome/free-solid-svg-icons";
import { useCart } from "../context/CartContext";
import { getProductImageSrc } from "../utils/productUtils";
import { parsePrice, formatPrice } from "../utils/priceUtils";
function CartPage() {
  const {
    cart,
    removeFromCart,
    updateQuantity,
    toggleItemSelection,
    selectAllItems,
    deselectAllItems,
  } = useCart();
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
  }, [cart]);

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

  return (
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10 px-5 text-[#1e293b]">
      <h2 className="mb-6 text-[28px]">Giỏ hàng của bạn</h2>

      {cart.length === 0 ? (
        <div className="text-center py-[60px] px-5 bg-[#f8fafc] rounded-2xl">
          <div className="text-5xl mb-4">🛒</div>
          <p className="text-lg mb-6 text-[#64748b]">Giỏ hàng đang trống.</p>
          <Link to="/products" className="inline-block py-3 px-6 bg-[#4f46e5] text-white no-underline rounded-xl font-bold hover:bg-[#4338ca]">
            Tiếp tục mua sắm
          </Link>
        </div>
      ) : (
        <div className="flex gap-8 flex-wrap max-[768px]:flex-col max-[768px]:gap-6">
          {/* Cột danh sách sản phẩm */}
          <div className="flex-[1_1_60%] min-w-[300px] max-[768px]:flex-auto max-[768px]:min-w-0">
            {/* Selection bar */}
            <div className="flex items-center justify-between py-3 px-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-[14px] mb-4">
              <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-[#1e293b]">
                <input
                  type="checkbox"
                  className="w-[18px] h-[18px] cursor-pointer"
                  checked={allItemsSelected}
                  onChange={(e) => (e.target.checked ? selectAllItems() : deselectAllItems())}
                />
                <span>Chọn tất cả ({cart.length})</span>
              </label>
              {hasUnselectedItems && (
                <button
                  type="button"
                  className="py-2 px-3 bg-[#4f46e5] text-white border-none rounded-xl cursor-pointer text-sm font-medium hover:bg-[#4338ca]"
                  onClick={selectAllItems}
                >
                  Chọn tất cả
                </button>
              )}
            </div>

            {isLoadingPrices && cart.length > 0 && (
              <div className="p-3 bg-[#eff6ff] border border-[#dbeafe] rounded-xl mb-4 text-[#334155] text-sm">
                Đang cập nhật giá sản phẩm...
              </div>
            )}

            {cart.map((item) => {
              const effectivePrice = getEffectivePrice(item);
              const originalPrice = getOriginalPrice(item);
              const discountPercent = getDiscountPercent(item);

              return (
                <div key={item.id} className="flex items-center py-3.5 px-4 border border-[#e2e8f0] rounded-2xl mb-4 bg-white gap-3.5 text-[#1e293b] max-[768px]:flex-wrap max-[768px]:gap-2">
                  <label className="flex items-center cursor-pointer min-w-[24px]">
                    <input
                      type="checkbox"
                      checked={item.selected || false}
                      onChange={() => toggleItemSelection(item.id)}
                    />
                  </label>

                  <img
                    src={getProductImageSrc(item)}
                    alt={item.name}
                    className="w-20 h-20 object-cover rounded bg-[#e9ecef] shrink-0 max-[768px]:w-[60px] max-[768px]:h-[60px]"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = "/placeholder.svg";
                    }}
                  />

                  <div className="flex-1 min-w-[100px] flex flex-col justify-center">
                    <h4 className="m-0 mb-2 text-base font-semibold leading-[1.45] text-[#1e293b]">{item.name}</h4>
                  </div>

                  {/* Nút cộng trừ số lượng */}
                  <div className="flex items-center gap-3 shrink-0">
                    <button className="w-8 h-8 rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] cursor-pointer font-bold text-[#334155] hover:bg-[#eef2ff] hover:border-[#c7d2fe]" onClick={() => updateQuantity(item.id, -1)}>
                      -
                    </button>
                    <span className="text-base font-medium w-6 text-center">{item.quantity}</span>
                    <button className="w-8 h-8 rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] cursor-pointer font-bold text-[#334155] hover:bg-[#eef2ff] hover:border-[#c7d2fe]" onClick={() => updateQuantity(item.id, 1)}>
                      +
                    </button>
                  </div>

                  {/* Tổng tiền của 1 sản phẩm */}
                  <div className="w-[130px] flex flex-col items-end justify-center shrink-0 max-[768px]:w-full max-[768px]:text-left max-[768px]:order-[10] max-[768px]:mt-2">
                    {originalPrice && originalPrice !== effectivePrice ? (
                      <>
                        <div className="text-[#64748b] line-through text-[13px] font-normal mb-0.5 whitespace-nowrap">
                          {formatPrice(originalPrice * item.quantity)}
                        </div>
                        <div className="text-[#e11d48] font-bold text-lg whitespace-nowrap">
                          {formatPrice(effectivePrice * item.quantity)}
                        </div>
                        {discountPercent > 0 && (
                          <span className="bg-[#fff1f2] text-[#be123c] py-0.5 px-1.5 rounded-full text-[11px] font-bold mt-1">
                            -{discountPercent}%
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="text-[#e11d48] font-bold text-lg whitespace-nowrap">
                        {formatPrice(effectivePrice * item.quantity)}
                      </div>
                    )}
                  </div>

                  {/* Nút Xóa */}
                  <button
                    type="button"
                    className="w-9 h-9 inline-flex items-center justify-center bg-[#f8fafc] text-[#94a3b8] border border-[#e2e8f0] rounded-xl cursor-pointer shrink-0 transition-all hover:bg-[#fee2e2] hover:text-[#b91c1c] hover:border-[#fecaca] hover:-translate-y-px max-[768px]:order-[11]"
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
          <div className="flex-[1_1_30%] min-w-[280px] bg-[#f8fafc] p-6 rounded-2xl h-fit border border-[#e2e8f0] max-[768px]:flex-auto max-[768px]:min-w-0">
            <h3 className="mb-6 text-xl border-b border-[#e2e8f0] pb-3 text-[#1e293b]">
              {selectedItems.length > 0 ? "Tóm tắt đơn hàng" : "Giỏ hàng"}
            </h3>

            {selectedItems.length > 0 && selectedItems.length < cart.length && (
              <div className="bg-[#eef2ff] border border-[#c7d2fe] text-[#4338ca] p-3 rounded-xl mb-4 text-sm">
                Bạn chỉ chọn {selectedItems.length}/{cart.length} sản phẩm
              </div>
            )}

            <div className="flex justify-between mb-4 text-base text-[#334155] leading-[1.7]">
              <span>Số lượng:</span>
              <span>
                {selectedItems.reduce((sum, item) => sum + item.quantity, 0)} sản phẩm
                {selectedItems.length < cart.length && ` (chỉ ${selectedItems.length} được chọn)`}
              </span>
            </div>

            <div className="flex justify-between mb-6 text-xl leading-[1.6] [&>span]:font-bold">
              <span>Tổng tiền:</span>
              <span className="text-[#e11d48]">
                {formatPrice(selectedItemsTotal)}
              </span>
            </div>

            {selectedItems.length === 0 ? (
              <button type="button" className="block text-center w-full py-3.5 bg-[#4f46e5] text-white no-underline rounded-xl text-base font-bold cursor-pointer border-none transition-colors hover:bg-[#4338ca] disabled:bg-[#ccc] disabled:cursor-not-allowed" disabled>
                Chọn sản phẩm để thanh toán
              </button>
            ) : (
              <Link to="/checkout" state={{ selectedItems }} className="block text-center w-full py-3.5 bg-[#4f46e5] text-white no-underline rounded-xl text-base font-bold cursor-pointer border-none transition-colors hover:bg-[#4338ca]">
                Tiến hành thanh toán ({selectedItems.length})
              </Link>
            )}

            {hasUnselectedItems && (
              <div className="mt-3 p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-[#64748b] text-sm">
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