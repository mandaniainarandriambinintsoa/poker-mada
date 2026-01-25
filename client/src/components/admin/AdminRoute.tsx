import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface AdminRouteProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
}

export function AdminRoute({ children, requireSuperAdmin = false }: AdminRouteProps) {
  const { isAuthenticated, isLoading, isAdmin, isSuperAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Chargement...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/lobby" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/lobby" replace />;
  }

  return <>{children}</>;
}
