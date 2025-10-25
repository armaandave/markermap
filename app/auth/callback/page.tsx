'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthContext } from '../../../components/AuthProvider';
import { getGoogleUserInfo } from '../../../lib/google-auth';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser, setLoading } = useAuthContext();

  useEffect(() => {
    const handleAuthCallback = async () => {
      setLoading(true);
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      console.log('🔍 AUTH CALLBACK DEBUG:');
      console.log('- Code:', code);
      console.log('- Error:', error);
      console.log('- Current URL:', window.location.href);
      console.log('- SessionStorage before:', sessionStorage.getItem('authUser'));
      console.log('- User context before:', user);

      if (error) {
        console.error('🚨 Google OAuth Error:', error);
        router.push('/'); // Redirect to home on error
        setLoading(false);
        return;
      }

      if (code) {
        console.log('🔄 Auth Callback: Received authorization code, exchanging for token via API route...');
        try {
          // Call the server-side API route to exchange the code for a token
          const tokenResponse = await fetch('/api/auth/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code }),
          });

          const tokenData = await tokenResponse.json();
          console.log('🔍 Token response status:', tokenResponse.status);
          console.log('🔍 Token response data:', tokenData);

          if (!tokenResponse.ok) {
            console.error('🚨 Auth Callback: API token exchange failed:', tokenData);
            throw new Error(tokenData.error || 'Failed to exchange code for token via API');
          }

          console.log('🔄 Auth Callback: Successfully exchanged code for token via API.');
          
          const userInfo = await getGoogleUserInfo(tokenData.access_token);
          console.log('🔄 Auth Callback: Fetched user info:', userInfo);

          const authUser = {
            uid: userInfo.sub, // Google's unique user ID
            email: userInfo.email,
            displayName: userInfo.name,
            photoURL: userInfo.picture,
          };

          console.log('🔍 Setting user:', authUser);
          setUser(authUser);
          sessionStorage.setItem('authUser', JSON.stringify(authUser)); // Persist user
          console.log('🔍 SessionStorage after:', sessionStorage.getItem('authUser'));
          console.log('🔄 Auth Callback: User signed in and stored in session.');
          router.push('/'); // Redirect to main app
        } catch (err) {
          console.error('🚨 Auth Callback: Error during authentication process:', err);
          router.push('/'); // Redirect to home on error
        } finally {
          setLoading(false);
        }
      } else {
        console.log('🔄 Auth Callback: No authorization code found, redirecting to home.');
        router.push('/'); // No code, just go home
        setLoading(false);
      }
    };

    handleAuthCallback();
  }, [searchParams, router, setUser, setLoading]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Processing Google sign-in...</p>
        <p className="text-gray-500 text-sm mt-2">Please wait, you will be redirected shortly.</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}