import { NextResponse } from 'next/server';
import { getGoogleRedirectUri } from '../../../../lib/google-auth';

export async function POST(request: Request) {
  const { code } = await request.json();

  if (!code) {
    return NextResponse.json({ error: 'Authorization code is missing' }, { status: 400 });
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = getGoogleRedirectUri();

  console.log('🔐 API TOKEN DEBUG:');
  console.log('- Code:', code);
  console.log('- Client ID:', clientId);
  console.log('- Client Secret present:', !!clientSecret);
  console.log('- Redirect URI:', redirectUri);
  console.log('- VERCEL_URL:', process.env.VERCEL_URL);

  if (!clientId || !clientSecret || !redirectUri) {
    console.error('🚨 Server-side: Missing Google OAuth environment variables!');
    return NextResponse.json({ error: 'Server configuration error: Missing OAuth credentials' }, { status: 500 });
  }

  const url = 'https://oauth2.googleapis.com/token';
  const values = {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(values).toString(),
    });

    const data = await response.json();
    console.log('🔐 Google API Response:');
    console.log('- Status:', response.status);
    console.log('- Data:', data);

    if (!response.ok) {
      console.error('🚨 Server-side: Failed to get Google access token:', data);
      return NextResponse.json({ error: data.error_description || 'Failed to get access token' }, { status: response.status });
    }

    console.log('🔐 Server-side: Successfully exchanged code for token');
    return NextResponse.json(data);
  } catch (error) {
    console.error('🚨 Server-side: Error exchanging code for token:', error);
    return NextResponse.json({ error: 'Internal server error during token exchange' }, { status: 500 });
  }
}


