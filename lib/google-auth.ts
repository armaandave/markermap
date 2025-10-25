export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Get redirect URI - ALWAYS auto-detect, ignore environment variable completely
export const getGoogleRedirectUri = () => {
  // Auto-detect based on environment
  if (typeof window !== 'undefined') {
    // Client-side: use current domain
    const uri = `${window.location.origin}/auth/callback`;
    console.log('🔍 Client-side redirect URI:', uri);
    return uri;
  } else {
    // Server-side: use Vercel URL or fallback to localhost
    const uri = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/auth/callback`
      : 'http://localhost:3000/auth/callback';
    console.log('🔍 Server-side redirect URI:', uri, 'VERCEL_URL:', process.env.VERCEL_URL);
    return uri;
  }
};

if (!GOOGLE_CLIENT_ID) {
  console.error('🚨 Google OAuth environment variables (client ID) are not set!');
}

export const getGoogleAuthUrl = () => {
  const redirectUri = getGoogleRedirectUri();
  console.log('🔍 Generated Google Auth URL with redirect URI:', redirectUri);
  
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = {
    redirect_uri: redirectUri,
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
  const fullUrl = `${rootUrl}?${queryString}`;
  console.log('🔍 Full Google Auth URL:', fullUrl);
  return fullUrl;
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