'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'teacher' | 'admin' | 'parent';
  allowedRoles?: ('teacher' | 'admin' | 'parent')[];
  redirectTo?: string;
  fallback?: React.ReactNode;
}

export default function ProtectedRoute({
  children,
  requiredRole,
  allowedRoles,
  redirectTo = '/login',
  fallback
}: ProtectedRouteProps) {
  const { teacher, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push(redirectTo);
        return;
      }

      const role = teacher?.role;
      if (requiredRole && role !== requiredRole) {
        router.push(redirectTo);
        return;
      }

      if (allowedRoles && (!role || !allowedRoles.includes(role))) {
        router.push(redirectTo);
        return;
      }

      setIsChecking(false);
    }
  }, [loading, isAuthenticated, teacher, requiredRole, allowedRoles, router, redirectTo]);

  // Show loading state
  if (loading || isChecking) {
    return fallback || <LoadingSpinner />;
  }

  // Show content if authenticated and authorized
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Return null while redirecting
  return null;
}

// Loading spinner component
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}
