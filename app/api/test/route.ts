import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'API is working',
    timestamp: new Date().toISOString(),
    env: {
      hasClientId: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      vercelUrl: process.env.VERCEL_URL,
    }
  });
}
