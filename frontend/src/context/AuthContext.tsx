import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authApi } from '../api/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('cloudvault_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('cloudvault_token');
  });
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await authApi.getMe();
      setUser(res.data.user);
      localStorage.setItem('cloudvault_user', JSON.stringify(res.data.user));
    } catch {
      logout();
    }
  };

  useEffect(() => {
    if (token) {
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setToken(res.data.token);
    setUser(res.data.user);
    localStorage.setItem('cloudvault_token', res.data.token);
    localStorage.setItem('cloudvault_user', JSON.stringify(res.data.user));
  };

  const register = async (email: string, password: string) => {
    const res = await authApi.register(email, password);
    setToken(res.data.token);
    setUser(res.data.user);
    localStorage.setItem('cloudvault_token', res.data.token);
    localStorage.setItem('cloudvault_user', JSON.stringify(res.data.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('cloudvault_token');
    localStorage.removeItem('cloudvault_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
