/**
 * Header component.
 *
 * Renders either the AdminSidebar or UserHeader based on the current route.
 * All layout-specific logic is delegated to the sub-components.
 */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminSidebar from "./layout/AdminSidebar";
import UserHeader from "./layout/UserHeader";
import "../css/header.css";

function Header() {
  const { auth, logout } = useAuth();
  const location = useLocation();

  const isAdmin = auth?.user?.role === "admin";
  const isAdminArea = isAdmin && location.pathname.startsWith("/admin");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  // Toggle admin body class
  useEffect(() => {
    if (isAdminArea) {
      document.body.classList.add("admin-sidebar-active");
    } else {
      document.body.classList.remove("admin-sidebar-active");
    }

    return () => {
      document.body.classList.remove("admin-sidebar-active");
    };
  }, [isAdminArea]);

  if (isAdminArea) {
    return (
      <AdminSidebar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={setIsSidebarOpen}
        onLogout={logout}
      />
    );
  }

  return <UserHeader />;
}

export default Header;
