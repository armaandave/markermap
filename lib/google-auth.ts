export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Get redirect URI - use environment variable if set, otherwise auto-detect
export const getGoogleRedirectUri = () => {
  if (process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI) {
    return process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI;
  }
  
  // Auto-detect based on environment
  if (typeof window !== 'undefined') {
    // Client-side: use current domain
    return `${window.location.origin}/auth/callback`;
  } else {
    // Server-side: use Vercel URL or fallback to localhost
    return process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/auth/callback`
      : 'http://localhost:3000/auth/callback';
  }
};

export const GOOGLE_REDIRECT_URI = getGoogleRedirectUri();

if (!GOOGLE_CLIENT_ID) {
  console.error('🚨 Google OAuth environment variables (client ID) are not set!');
}

export const getGoogleAuthUrl = () => {
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = {
    redirect_uri: GOOGLE_REDIRECT_URI,
    client_id: GOOGLE_CLIENT_ID,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
  };
  const queryString = new URLSearchParams(options as Record<string, string>).toString();
  return `${rootUrl}?${queryString}`;
};

export const getGoogleUserInfo = async (accessToken: string) => {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('🚨 Failed to get Google user info:', data);
      throw new Error(data.error_description || 'Failed to get user info');
    }
    return data;
  } catch (error) {
    console.error('🚨 Error fetching Google user info:', error);
    throw error;
  }
};