import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';

// Get user profile
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('🚨 User Profile: Error fetching profile:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  } catch (error) {
    console.error('🚨 User Profile: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Create or update user profile
export async function POST(request: Request) {
  try {
    const { userId, email, displayName, profilePictureUrl } = await request.json();

    if (!userId || !email) {
      return NextResponse.json({ error: 'User ID and email are required' }, { status: 400 });
    }

    console.log('👥 User Profile: Creating/updating profile for', userId);

    const userData = {
      user_id: userId,
      email,
      display_name: displayName || null,
      profile_picture_url: profilePictureUrl || null,
    };

    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert(userData, { onConflict: 'user_id' });

    if (error) {
      console.error('🚨 User Profile: Error upserting profile:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ User Profile: Profile created/updated successfully');
    return NextResponse.json({ success: true, user: data });
  } catch (error) {
    console.error('🚨 User Profile: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

