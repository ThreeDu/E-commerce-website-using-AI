/**
 * Header component.
 *
 * Renders either the Admin layout (AdminSidebar + AdminHeader) or UserHeader based on current route.
 */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminSidebar from "./layout/AdminSidebar";
import AdminHeader from "./layout/AdminHeader";
import UserHeader from "./layout/UserHeader";

function Header() {
  const { auth, logout } = useAuth();
  const location = useLocation();

  const isAdmin = auth?.user?.role === "admin";
  const isAdminArea = isAdmin && location.pathname.startsWith("/admin");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem("admin_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("admin_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  // Close sidebar drawer on route change
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  // Toggle admin body classes
  useEffect(() => {
    if (isAdminArea) {
      document.body.classList.add("admin-sidebar-active");
      if (isCollapsed) {
        document.body.classList.add("admin-sidebar-collapsed");
      } else {
        document.body.classList.remove("admin-sidebar-collapsed");
      }
    } else {
      document.body.classList.remove("admin-sidebar-active", "admin-sidebar-collapsed");
    }

    return () => {
      document.body.classList.remove("admin-sidebar-active", "admin-sidebar-collapsed");
    };
  }, [isAdminArea, isCollapsed]);

  if (isAdminArea) {
    return (
      <>
        <AdminSidebar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={setIsSidebarOpen}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
          onLogout={logout}
        />
        <AdminHeader
          onToggleSidebar={setIsSidebarOpen}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
          onLogout={logout}
        />
      </>
    );
  }

  return <UserHeader />;
}

export default Header;
