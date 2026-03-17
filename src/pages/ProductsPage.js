const demoProducts = [
  { id: 1, name: "Laptop AI", price: "22.900.000 VND" },
  { id: 2, name: "Tai nghe Pro", price: "1.990.000 VND" },
  { id: 3, name: "Chuột Gaming", price: "790.000 VND" },
];

function ProductsPage() {
  return (
    <main className="container page-content">
      <h2>Danh sách sản phẩm</h2>
      <div className="product-grid">
        {demoProducts.map((product) => (
          <article key={product.id} className="product-card">
            <h3>{product.name}</h3>
            <p>{product.price}</p>
          </article>
        ))}
      </div>
    </main>
  );
}

export default ProductsPage;
