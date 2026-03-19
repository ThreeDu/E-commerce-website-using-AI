import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { verifyAdminToken } from "../services/auth/authService";

function ProtectedRoute({ children, requiredRole }) {
  const { auth, isAuthenticated, logout } = useAuth();
  const [isChecking, setIsChecking] = useState(requiredRole === "admin");
  const [isAllowed, setIsAllowed] = useState(requiredRole !== "admin");

  useEffect(() => {
    if (requiredRole !== "admin") {
      setIsAllowed(true);
      setIsChecking(false);
      return;
    }

    if (!auth?.token) {
      setIsAllowed(false);
      setIsChecking(false);
      return;
    }

    let isMounted = true;

    const runVerification = async () => {
      setIsChecking(true);
      try {
        await verifyAdminToken(auth.token);
        if (isMounted) {
          setIsAllowed(true);
        }
      } catch (error) {
        if (isMounted) {
          setIsAllowed(false);
          logout();
        }
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    runVerification();

    return () => {
      isMounted = false;
    };
  }, [requiredRole, auth?.token, logout]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isChecking) {
    return null;
  }

  if (requiredRole === "admin" && !isAllowed) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && requiredRole !== "admin" && auth?.user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
