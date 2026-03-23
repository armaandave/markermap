import { NextRequest, NextResponse } from 'next/server';

const getCanonicalUrl = () => {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) return null;

  try {
    return new URL(configured);
  } catch {
    return null;
  }
};

export function middleware(request: NextRequest) {
  const isProduction = process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV === 'production'
    : process.env.NODE_ENV === 'production';

  if (!isProduction) {
    return NextResponse.next();
  }

  const canonicalUrl = getCanonicalUrl();
  if (!canonicalUrl) {
    return NextResponse.next();
  }

  const requestHost = request.nextUrl.hostname;
  const isLocalhost = requestHost === 'localhost' || requestHost === '127.0.0.1' || requestHost === '::1';

  if (isLocalhost || requestHost === canonicalUrl.hostname) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.protocol = canonicalUrl.protocol;
  redirectUrl.hostname = canonicalUrl.hostname;
  redirectUrl.port = canonicalUrl.port;

  return NextResponse.redirect(redirectUrl, 308);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
