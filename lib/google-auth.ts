export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Get redirect URI - always auto-detect, ignore environment variable for production
interface RedirectOptions {
  baseUrl?: string;
}

export const getGoogleRedirectUri = (options: RedirectOptions = {}) => {
  // Auto-detect based on environment
  if (typeof window !== 'undefined') {
    // Client-side: use current domain
    const uri = `${window.location.origin}/auth/callback`;
    console.log('🔍 Client-side redirect URI:', uri);
    return uri;
  } else {
    // Server-side: Check if we're in production vs preview
    const vercelEnv = process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV;
    const productionDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL || 'markermap-nine.vercel.app';
    const vercelUrl = process.env.VERCEL_URL;
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    const normalizeBaseUrl = (value: string) => {
      if (!value) return value;
      const trimmed = value.replace(/\/+$/, '');
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
      }
      if (trimmed.startsWith('localhost') || trimmed.startsWith('127.0.0.1')) {
        return `http://${trimmed}`;
      }
      return `https://${trimmed}`;
    };

    const determineBaseUrl = () => {
      if (vercelEnv === 'production') {
        return normalizeBaseUrl(productionDomain);
      }
      if (vercelUrl) {
        return normalizeBaseUrl(vercelUrl);
      }
      if (configuredSiteUrl) {
        return normalizeBaseUrl(configuredSiteUrl);
      }
      if (process.env.NODE_ENV === 'production') {
        return normalizeBaseUrl(productionDomain);
      }
      return 'http://localhost:3000';
    };

    const baseUrlOverride = options.baseUrl ? normalizeBaseUrl(options.baseUrl) : undefined;
    const baseUrl = baseUrlOverride ?? determineBaseUrl();

    const uri = `${baseUrl}/auth/callback`;

    console.log(
      '🔍 Server-side redirect URI:',
      uri,
      'Environment:',
      vercelEnv,
      'VERCEL_URL:',
      vercelUrl,
      'Production domain:',
      productionDomain
    );
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
    prompt: 'select_account',
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
