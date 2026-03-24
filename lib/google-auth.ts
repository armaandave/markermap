export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface RedirectOptions {
  baseUrl?: string;
}

interface OAuthAvailability {
  allowed: boolean;
  reason: string | null;
}

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

export const getCanonicalSiteHost = () => {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configuredSiteUrl) return null;

  try {
    return new URL(normalizeBaseUrl(configuredSiteUrl)).hostname;
  } catch {
    return null;
  }
};

export const canUseGoogleOAuthOnCurrentHost = (): OAuthAvailability => {
  if (typeof window === 'undefined') {
    return { allowed: true, reason: null };
  }

  const hostname = window.location.hostname;
  const canonicalHost = getCanonicalSiteHost();
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  const isNgrokHost =
    hostname.endsWith('.ngrok-free.app') ||
    hostname.endsWith('.ngrok-free.dev') ||
    hostname.endsWith('.ngrok.io');
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isLocalhost) {
    return { allowed: true, reason: null };
  }

  // Allow tunnel hosts during local development for mobile debugging.
  if (isDevelopment && isNgrokHost) {
    return { allowed: true, reason: null };
  }

  if (canonicalHost && hostname === canonicalHost) {
    return { allowed: true, reason: null };
  }

  const targetDomain = canonicalHost ? `https://${canonicalHost}` : 'the production domain';
  return {
    allowed: false,
    reason: `Google sign-in is disabled on preview URLs. Use ${targetDomain}.`,
  };
};

export const getGoogleRedirectUri = (options: RedirectOptions = {}) => {
  if (typeof window !== 'undefined') {
    const uri = `${window.location.origin}/auth/callback`;
    console.log('🔍 Client-side redirect URI:', uri);
    return uri;
  }

  const baseUrlOverride = options.baseUrl ? normalizeBaseUrl(options.baseUrl) : undefined;
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const configuredBaseUrl = configuredSiteUrl ? normalizeBaseUrl(configuredSiteUrl) : undefined;
  const baseUrl = baseUrlOverride ?? configuredBaseUrl ?? 'http://localhost:3000';

  const uri = `${baseUrl}/auth/callback`;
  console.log('🔍 Server-side redirect URI:', uri);
  return uri;
};

if (!GOOGLE_CLIENT_ID) {
  console.error('🚨 Google OAuth environment variables (client ID) are not set!');
}

export const getGoogleAuthUrl = () => {
  const oauthAvailability = canUseGoogleOAuthOnCurrentHost();
  if (!oauthAvailability.allowed) {
    throw new Error(oauthAvailability.reason || 'Google sign-in is not available on this host');
  }

  const redirectUri = getGoogleRedirectUri();
  console.log('🔍 Generated Google Auth URL with redirect URI:', redirectUri);
  
  // Check if we're on a private IP (local development)
  const isPrivateIp = typeof window !== 'undefined' && 
    window.location.hostname !== 'localhost' && 
    window.location.hostname !== '127.0.0.1' &&
    (window.location.hostname.startsWith('10.') || 
     window.location.hostname.startsWith('192.168.') || 
     window.location.hostname.startsWith('172.'));
  
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options: Record<string, string> = {
    redirect_uri: redirectUri,
    client_id: GOOGLE_CLIENT_ID!,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'select_account',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
  };
  
  // Add device_id and device_name for private IPs (mobile localhost testing)
  if (isPrivateIp && typeof window !== 'undefined') {
    options.device_id = 'local-device-' + Math.random().toString(36).substring(7);
    options.device_name = 'Local Development Device';
    console.log('🔍 Adding device_id and device_name for private IP access');
  }
  
  const queryString = new URLSearchParams(options).toString();
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
