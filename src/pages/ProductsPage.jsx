const allProducts = [
  { id: 1, name: "Điện thoại AI Pro", price: "25.000.000 đ" },
  { id: 2, name: "Laptop DevBook 16", price: "40.000.000 đ" },
  { id: 3, name: "Tai nghe Noise Cancel", price: "3.500.000 đ" },
  { id: 4, name: "Đồng hồ thông minh", price: "5.000.000 đ" },
  { id: 5, name: "Bàn phím cơ RGB", price: "2.100.000 đ" },
  { id: 6, name: "Chuột không dây Ergonomic", price: "950.000 đ" },
  { id: 7, name: "Màn hình 4K 27 inch", price: "12.500.000 đ" },
  { id: 8, name: "Webcam Full HD", price: "1.200.000 đ" },
];

function ProductsPage() {
  return (
    <main className="container page-content">
      <h2 style={{ marginBottom: "24px", fontSize: "24px" }}>
        Tất cả sản phẩm
      </h2>
      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
        {allProducts.map((product) => (
          <div
            key={product.id}
            style={{
              flex: "1 1 calc(25% - 24px)",
              minWidth: "200px",
              border: "1px solid #dee2e6",
              borderRadius: "8px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "200px",
                backgroundColor: "#f8f9fa",
                borderRadius: "4px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#adb5bd",
                fontSize: "14px",
              }}
            >
              Ảnh SP
            </div>
            <h4 style={{ fontSize: "18px", marginBottom: "8px" }}>
              {product.name}
            </h4>
            <p
              style={{
                color: "#dc3545",
                fontWeight: "bold",
                fontSize: "19px",
                marginBottom: "16px",
              }}
            >
              {product.price}
            </p>
            <button
              style={{
                marginTop: "auto",
                padding: "8px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "14px",
              }}
            >
              Thêm vào giỏ
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}

export default ProductsPage;
