import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./css/admin/forms.css";
import "./css/admin/theme.css";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ChatbotWidget from "./components/ChatbotWidget";
import StatusNotificationCenter from "./components/StatusNotificationCenter";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/common/ErrorBoundary";
import LoadingFallback from "./components/common/LoadingFallback";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { NotificationProvider } from "./context/NotificationContext";

// ── Eager-loaded pages (critical path, always needed) ──
import HomePage from "./pages/HomePage";
import ProductsPage from "./pages/ProductsPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CartPage from "./pages/CartPage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";

// ── Lazy-loaded pages (lower priority, loaded on demand) ──
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContractPage = lazy(() => import("./pages/ContractPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const OrderHistoryPage = lazy(() => import("./pages/OrderHistoryPage"));
const OrderDetailPage = lazy(() => import("./pages/OrderDetailPage"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));

// ── Admin pages (lazy — only loaded when admin navigates) ──
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminListCategoriesPage = lazy(() => import("./pages/admin/category/AdminListCategoriesPage"));
const AdminAddCategoryPage = lazy(() => import("./pages/admin/category/AdminAddCategoryPage"));
const AdminListProductPage = lazy(() => import("./pages/admin/product/AdminListProductPage"));
const AdminAddProductPage = lazy(() => import("./pages/admin/product/AdminAddProductPage"));
const AdminBulkImportProductPage = lazy(() => import("./pages/admin/product/AdminBulkImportProductPage"));
const AdminEditProductPage = lazy(() => import("./pages/admin/product/AdminEditProductPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminListDiscountsPage = lazy(() => import("./pages/admin/discount/AdminListDiscountsPage"));
const AdminAddDiscountPage = lazy(() => import("./pages/admin/discount/AdminAddDiscountPage"));
const AdminEditDiscountPage = lazy(() => import("./pages/admin/discount/AdminEditDiscountPage"));
const AdminOrdersPage = lazy(() => import("./pages/admin/AdminOrdersPage"));
const AdminSystemLogsPage = lazy(() => import("./pages/admin/AdminSystemLogsPage"));
const AdminNotificationsPage = lazy(() => import("./pages/admin/AdminNotificationsPage"));

const AdminCustomerIntelligencePage = lazy(() => import("./pages/admin/AdminCustomerIntelligencePage"));

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
      <NotificationProvider>
        <CartProvider>
          <BrowserRouter>
            <StatusNotificationCenter />
            <div className="app-shell">
              <Header />
              <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  <Routes>
                    {/* ── Public pages ── */}
                    <Route path="/" element={<HomePage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/contract" element={<ContractPage />} />
                    <Route path="/products" element={<ProductsPage />} />
                    <Route path="/products/:id" element={<ProductDetailPage />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/checkout" element={<CheckoutPage />} />
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

                    {/* ── User protected pages ── */}
                    <Route
                      path="/order-history"
                      element={
                        <ProtectedRoute>
                          <OrderHistoryPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/order-history/:id"
                      element={
                        <ProtectedRoute>
                          <OrderDetailPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <UserDashboard />
                        </ProtectedRoute>
                      }
                    />

                    {/* ── Admin pages ── */}
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
                      path="/admin/products/import"
                      element={
                        <ProtectedRoute requiredRole="admin">
                          <AdminBulkImportProductPage />
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
                      path="/admin/notifications"
                      element={
                        <ProtectedRoute requiredRole="admin">
                          <AdminNotificationsPage />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/admin/intelligence"
                      element={
                        <ProtectedRoute requiredRole="admin">
                          <AdminCustomerIntelligencePage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/orders/:id"
                      element={
                        <ProtectedRoute requiredRole="admin">
                          <OrderDetailPage />
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
                </Suspense>
              </ErrorBoundary>
              <ChatbotWidget />
              <Footer />
            </div>
          </BrowserRouter>
        </CartProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
