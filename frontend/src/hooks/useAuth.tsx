'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { apiClient } from '@/lib/client';
import { Teacher, LoginRequest } from '@/types';
import logger from '@/lib/logger';

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

  // Refs to prevent race conditions
  const checkingRef = useRef(false);           // Prevent concurrent checkAuthStatus calls
  const abortRef = useRef<AbortController | null>(null);  // Cancel stale requests

  const checkAuthStatus = async () => {
    // Prevent concurrent calls — if a check is already in progress, skip this one
    if (checkingRef.current) return;
    checkingRef.current = true;

    // Cancel any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const token = apiClient.getToken();
      if (!token) {
        setTeacher(null);
        setLoading(false);
        return;
      }

      // Verify token and get teacher data
      // The Axios interceptor handles 401 by removing token + hard redirect,
      // so we don't remove token here to avoid re-triggering via auth:token-changed.
      const teacherData = await apiClient.getMe();
      if (!controller.signal.aborted) {
        setTeacher(teacherData);
      }

    } catch (err: unknown) {
      // Don't log abort errors
      const error = err as { name?: string; response?: { status?: number }; message?: string };
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        logger.error('Auth check failed:', err);
      }

      // Only clear teacher for actual auth errors (401/403).
      // For network errors or 5xx, keep existing state to avoid logout flicker.
      if (error.response?.status === 401 || error.response?.status === 403) {
        // Don't call removeToken() here — the Axios 401 interceptor already does it.
        // Calling it here would fire auth:token-changed → re-trigger checkAuthStatus → loop.
        setTeacher(null);
      } else if (!controller.signal.aborted) {
        // Network error or 5xx — don't clear teacher, just show error
        setError(error.message || 'Authentication check failed');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
      checkingRef.current = false;
    }
  };

  useEffect(() => {
    void (async () => {
      await checkAuthStatus();
    })();

    const handleTokenChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.action === 'remove') {
        setTeacher(null);
        setLoading(false);
        setError(null);
        return;
      }
      checkAuthStatus();
    };

    window.addEventListener('auth:token-changed', handleTokenChange);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'nabeeh_token' && !e.newValue) {
        setTeacher(null);
        setLoading(false);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('auth:token-changed', handleTokenChange);
      window.removeEventListener('storage', handleStorageChange);
      abortRef.current?.abort();
    };
  }, []);

  const login = async (credentials: LoginRequest) => {
    try {
      setLoading(true);
      setError(null);

      const authResponse = await apiClient.login(credentials);
      setTeacher(authResponse.teacher);

      // Don't redirect here - let the login page handle it
      // The login page will redirect based on the isAuthenticated state

    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      logger.error('Login failed:', err);
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
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

    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      logger.error('Profile update failed:', err);
      const errorMessage = error.response?.data?.message || error.message || 'Profile update failed';
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
