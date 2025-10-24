'use client';

import React, { createContext, useContext } from 'react';
import { useAuth, AuthUser } from '../hooks/useAuth';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signInWithGoogle: () => void;
  logout: () => void;
  setAuthUser: (user: AuthUser) => void;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  console.log('🛡️ AuthProvider: Rendering...');

  const auth = useAuth();

  console.log('🛡️ AuthProvider: Auth state - User:', auth.user ? auth.user.email : 'null', 'Loading:', auth.loading);

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};
