import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: 'student' | 'instructor' | 'admin';
  avatar_url?: string;
  streak?: {
    current: number;
    longest: number;
  };
  badges?: Array<{
    id: number;
    name: string;
    description: string;
    icon_url: string;
    earned_at: string;
  }>;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  register: (fullName: string, email: string, password?: string, role?: string) => Promise<void>;
  logout: () => void;
  quickSwitch: (role: 'student' | 'instructor' | 'admin') => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('lms_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('lms_access_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshProfile = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      localStorage.setItem('lms_user', JSON.stringify(res.data.user));
    } catch {
      // If token expired and refresh fails, logout
    }
  };

  useEffect(() => {
    if (token) {
      refreshProfile().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (email: string, password = 'Password123!') => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const { access_token, refresh_token, user: userData } = res.data;
      localStorage.setItem('lms_access_token', access_token);
      localStorage.setItem('lms_refresh_token', refresh_token);
      localStorage.setItem('lms_user', JSON.stringify(userData));
      setToken(access_token);
      setUser(userData);
      await refreshProfile();
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (fullName: string, email: string, password = 'Password123!', role = 'student') => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/register', {
        full_name: fullName,
        email,
        password,
        role,
      });
      const { access_token, refresh_token, user: userData } = res.data;
      localStorage.setItem('lms_access_token', access_token);
      localStorage.setItem('lms_refresh_token', refresh_token);
      localStorage.setItem('lms_user', JSON.stringify(userData));
      setToken(access_token);
      setUser(userData);
      await refreshProfile();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('lms_access_token');
    localStorage.removeItem('lms_refresh_token');
    localStorage.removeItem('lms_user');
    setToken(null);
    setUser(null);
  };

  const quickSwitch = async (targetRole: 'student' | 'instructor' | 'admin') => {
    const accounts = {
      student: 'student@lms.local',
      instructor: 'instructor@lms.local',
      admin: 'admin@lms.local',
    };
    await login(accounts[targetRole], 'Password123!');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, quickSwitch, refreshProfile }}>
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
