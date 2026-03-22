import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
import HomePage from "./pages/HomePage";
import ProductsPage from "./pages/ProductsPage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminListCategoriesPage from "./pages/admin/category/AdminListCategoriesPage";
import AdminAddCategoryPage from "./pages/admin/category/AdminAddCategoryPage";
import AdminListProductPage from "./pages/admin/product/AdminListProductPage";
import AdminAddProductPage from "./pages/admin/product/AdminAddProductPage";
import AdminEditProductPage from "./pages/admin/product/AdminEditProductPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminListDiscountsPage from "./pages/admin/discount/AdminListDiscountsPage";
import AdminAddDiscountPage from "./pages/admin/discount/AdminAddDiscountPage";
import AdminEditDiscountPage from "./pages/admin/discount/AdminEditDiscountPage";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import AdminSystemLogsPage from "./pages/admin/AdminSystemLogsPage";

function GuestRoute({ children }) {
  const { auth } = useAuth();

  if (!auth) {
    return children;
  }

  return auth.user.role === "admin" ? (
    <Navigate to="/admin/dashboard" replace />
  ) : (
    <Navigate to="/" replace />
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-shell">
          <Header />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route
              path="/login"
              element={
                <GuestRoute>
                  <LoginPage />
                </GuestRoute>
              }
            />
            <Route
              path="/register"
              element={
                <GuestRoute>
                  <RegisterPage />
                </GuestRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/categories"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminListCategoriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/categories/add"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminAddCategoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/products"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminListProductPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/products/add"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminAddProductPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/products/edit/:id"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminEditProductPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminUsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/discounts"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminListDiscountsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/discounts/add"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminAddDiscountPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/discounts/edit/:id"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminEditDiscountPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminOrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/system-logs"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminSystemLogsPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
