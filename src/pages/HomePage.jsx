import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import "../css/home-neo.css";

function getProductImageSrc(product) {
  const rawValue = String(product?.image || product?.imageUrl || "").trim();
  if (!rawValue) {
    return "/placeholder.jpg";
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

function HomePage() {
  const { addToCart } = useCart();
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/products");
        if (response.ok) {
          const data = await response.json();
          setFeaturedProducts(data.slice(0, 4)); // Lấy 4 sản phẩm đầu tiên
        }

        const catResponse = await fetch("/api/categories");
        if (catResponse.ok) {
          const catData = await catResponse.json();
          setCategories(catData);
        }
      } catch (error) {
        console.error("Lỗi tải dữ liệu trang chủ:", error);
      }
    };
    fetchData();
  }, []);

  const handleCategoryClick = (category) => {
    navigate("/products", {
      state: {
        categoryId: String(category._id),
        category: category.name,
      },
    });
  };

  const handleAddToCart = (product) => {
    if (!auth?.token) {
      navigate("/login", { state: { from: "/products" } });
      return;
    }

    addToCart({ ...product, id: product._id });
  };

  return (
    <main className="container page-content neo-home-page">
      <section className="neo-hero-block">
        <div className="neo-hero-main">
          <p className="neo-eyebrow">Tech-first commerce</p>
          <h2>Minimal layout. Bold experiences.</h2>
          <p>
            AI Shop mang tinh thần Neo-Brutalism: đường nét rõ ràng, độ tương phản cao và trải nghiệm mua sắm gọn, nhanh, chính xác.
          </p>
          <div className="neo-hero-actions">
            <Link to="/products" className="neo-btn neo-btn-primary">Shop now</Link>
            <a href="#about" className="neo-btn neo-btn-ghost">Discover more</a>
          </div>
        </div>

        <div className="neo-hero-side">
          <div className="neo-stat-card">
            <strong>{categories.length}</strong>
            <span>Category blocks</span>
          </div>
          <div className="neo-stat-card neo-stat-accent">
            <strong>{featuredProducts.length}</strong>
            <span>Featured picks</span>
          </div>
        </div>
      </section>

      <section className="neo-section">
        <div className="neo-section-head">
          <h3>Explore by category</h3>
          <Link to="/products">View all products</Link>
        </div>
        <div className="neo-bento-grid neo-bento-grid-categories">
          {categories.map((category, index) => (
            <button
              type="button"
              key={category._id}
              onClick={() => handleCategoryClick(category)}
              className={`neo-bento-card neo-cat-${index % 5}`}
            >
              <span>Category</span>
              <strong>{category.name}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="neo-section">
        <div className="neo-section-head">
          <h3>Bento featured products</h3>
          <Link to="/products">Shop collection</Link>
        </div>
        <div className="neo-bento-grid neo-bento-grid-products">
          {featuredProducts.map((product) => (
            <article className="neo-product-card" key={product._id}>
              <Link to={`/products/${product._id}`} className="neo-product-link">
                <img
                  src={getProductImageSrc(product)}
                  alt={product.name}
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = "/placeholder.jpg";
                  }}
                />
                <h4>{product.name}</h4>
                <p>{Number(product.price || 0).toLocaleString("vi-VN")} đ</p>
              </Link>
              <button className="neo-btn neo-btn-primary" onClick={() => handleAddToCart(product)}>
                Add to cart
              </button>
            </article>
          ))}
        </div>
      </section>

      <section id="about" className="neo-section">
        <div className="neo-info-bento">
          <article>
            <h4>About</h4>
            <p>Giao diện tập trung vào điều quan trọng: sản phẩm, giá trị và hành động mua hàng rõ ràng.</p>
          </article>
          <article>
            <h4>Design language</h4>
            <p>1px border sắc nét, typography đậm, khối bo góc lớn, chuyển động ngắn và dứt khoát.</p>
          </article>
          <article id="contact">
            <h4>Contact</h4>
            <p>Email: support@aishop.local<br />Hotline: 1900 1234</p>
          </article>
        </div>
      </section>
    </main>
  );
}

export default HomePage;