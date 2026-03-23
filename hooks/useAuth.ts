import { useState, useEffect } from 'react';
import { canUseGoogleOAuthOnCurrentHost, getGoogleAuthUrl } from '../lib/google-auth';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleOAuthEnabled, setGoogleOAuthEnabled] = useState(true);
  const [googleOAuthDisabledReason, setGoogleOAuthDisabledReason] = useState<string | null>(null);

  console.log('🔐 useAuth: Hook initialized. Loading state:', loading);

  // Check for existing auth on mount
  useEffect(() => {
    const checkAuth = () => {
      try {
        console.log('🔐 useAuth: useEffect triggered - checking auth state');
        console.log('🔐 useAuth: Checking localStorage for authUser...');
        const storedUser = localStorage.getItem('authUser');
        console.log('🔐 useAuth: Raw storedUser:', storedUser);
        
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          console.log('🔐 useAuth: Parsed user data:', userData);
          console.log('🔐 useAuth: Found stored user:', userData.email, 'UID:', userData.uid);
          setUser(userData);
          
          // Create or update user profile in Supabase (silently)
          fetch('/api/users/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: userData.uid,
              email: userData.email,
              displayName: userData.displayName,
              profilePictureUrl: userData.photoURL,
            }),
          }).catch(error => {
            console.warn('⚠️ useAuth: Failed to sync user profile:', error);
          });
        } else {
          console.log('🔐 useAuth: No stored user found in localStorage');
        }
      } catch (error) {
        console.error('🔐 useAuth: Error checking stored auth:', error);
        localStorage.removeItem('authUser');
      } finally {
        console.log('🔐 useAuth: Setting loading to false');
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    const availability = canUseGoogleOAuthOnCurrentHost();
    setGoogleOAuthEnabled(availability.allowed);
    setGoogleOAuthDisabledReason(availability.reason);
  }, []);

  const signInWithGoogle = () => {
    const availability = canUseGoogleOAuthOnCurrentHost();
    setGoogleOAuthEnabled(availability.allowed);
    setGoogleOAuthDisabledReason(availability.reason);

    if (!availability.allowed) {
      console.warn('🔐 useAuth: Google sign-in blocked for current host:', availability.reason);
      return;
    }

    console.log('🔐 useAuth: Starting Google sign-in...');
    const authUrl = getGoogleAuthUrl();
    console.log('🔐 useAuth: Redirecting to:', authUrl);
    window.location.href = authUrl;
  };

  const logout = () => {
    console.log('🔐 useAuth: Logging out...');
    localStorage.removeItem('authUser');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  const setAuthUser = (userData: AuthUser, tokens?: { access_token?: string; refresh_token?: string }) => {
    console.log('🔐 useAuth: Setting auth user:', userData.email);
    localStorage.setItem('authUser', JSON.stringify(userData));
    if (tokens?.access_token) {
      localStorage.setItem('access_token', tokens.access_token);
    }
    if (tokens?.refresh_token) {
      localStorage.setItem('refresh_token', tokens.refresh_token);
    }
    setUser(userData);
  };

  console.log('🔐 useAuth: Returning state - User:', user ? user.email : 'null', 'Loading:', loading);

  return {
    user,
    loading,
    googleOAuthEnabled,
    googleOAuthDisabledReason,
    signInWithGoogle,
    logout,
    setAuthUser,
    setUser, // Expose setUser for the callback handler
    setLoading, // Expose setLoading for the callback handler
  };
};
