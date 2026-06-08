'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '@/lib/api';
import { Teacher, LoginRequest } from '@/types';

interface AuthContextType {
  teacher: Teacher | null;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<Teacher>) => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing authentication on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = apiClient.getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      // Verify token and get teacher data
      const teacherData = await apiClient.getMe();
      setTeacher(teacherData);

    } catch (err: any) {
      console.error('Auth check failed:', err);
      // Clear invalid token
      apiClient.removeToken();
      setTeacher(null);

      // Don't show error for initial auth check
      if (err.response?.status !== 401) {
        setError(err.message || 'Authentication check failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials: LoginRequest) => {
    try {
      setLoading(true);
      setError(null);

      const authResponse = await apiClient.login(credentials);
      setTeacher(authResponse.teacher);

      // Don't redirect here - let the login page handle it
      // The login page will redirect based on the isAuthenticated state

    } catch (err: any) {
      console.error('Login failed:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    apiClient.removeToken();
    setTeacher(null);
    setError(null);

    if (typeof window !== 'undefined') {
      // Get current locale from URL or default to 'en'
      const currentLocale = window.location.pathname.split('/')[1] || 'en';
      window.location.href = `/${currentLocale}/login`;
    }
  };

  const updateProfile = async (data: Partial<Teacher>) => {
    try {
      setLoading(true);
      setError(null);

      const updatedTeacher = await apiClient.updateProfile(data);
      setTeacher(updatedTeacher);

    } catch (err: any) {
      console.error('Profile update failed:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Profile update failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    teacher,
    loading,
    error,
    login,
    logout,
    updateProfile,
    isAuthenticated: !!teacher
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for checking permissions
export function usePermissions() {
  const { teacher } = useAuth();

  const hasRole = (role: string) => {
    return teacher?.role === role;
  };

  const isTeacher = () => hasRole('teacher');
  const isAdmin = () => hasRole('admin');
  const isParent = () => hasRole('parent');

  return {
    hasRole,
    isTeacher,
    isAdmin,
    isParent,
    role: teacher?.role
  };
}
