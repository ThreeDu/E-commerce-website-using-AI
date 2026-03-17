import { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

const AUTH_STORAGE_KEY = "ecommerce_auth";

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  const login = (payload) => {
    setAuth(payload);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
  };

  const logout = () => {
    setAuth(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const value = useMemo(
    () => ({
      auth,
      login,
      logout,
      isAuthenticated: Boolean(auth?.token),
    }),
    [auth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
