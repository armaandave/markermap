import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';

// Backfill users table with existing accounts from folders and markers
export async function POST(request: Request) {
  try {
    console.log('👥 User Backfill: Starting...');

    // Get all unique user IDs from folders
    const { data: folders, error: foldersError } = await supabaseAdmin
      .from('folders')
      .select('user_id')
      .not('user_id', 'is', null);

    if (foldersError) {
      console.error('🚨 User Backfill: Error fetching folders:', foldersError);
      return NextResponse.json({ error: foldersError.message }, { status: 500 });
    }

    // Get all unique user IDs from markers
    const { data: markers, error: markersError } = await supabaseAdmin
      .from('markers')
      .select('user_id')
      .not('user_id', 'is', null);

    if (markersError) {
      console.error('🚨 User Backfill: Error fetching markers:', markersError);
      return NextResponse.json({ error: markersError.message }, { status: 500 });
    }

    // Combine and get unique user IDs
    const allUserIds = new Set<string>();
    folders?.forEach(folder => {
      if (folder.user_id) allUserIds.add(folder.user_id);
    });
    markers?.forEach(marker => {
      if (marker.user_id) allUserIds.add(marker.user_id);
    });

    console.log('👥 User Backfill: Found', allUserIds.size, 'unique users');

    // Create user records
    const userRecords = Array.from(allUserIds).map(userId => ({
      user_id: userId,
      email: `${userId}@temp.com`, // Placeholder, will be updated when they sign in
      display_name: `User ${userId.substring(0, 8)}`,
      profile_picture_url: null,
    }));

    if (userRecords.length > 0) {
      const { data, error: insertError } = await supabaseAdmin
        .from('users')
        .upsert(userRecords, { onConflict: 'user_id' });

      if (insertError) {
        console.error('🚨 User Backfill: Error inserting users:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      console.log('✅ User Backfill: Created', userRecords.length, 'user records');
    }

    return NextResponse.json({ 
      success: true, 
      usersCreated: userRecords.length,
      message: `Created ${userRecords.length} user profiles. They will be updated with real email/names when users sign in.`
    });
  } catch (error) {
    console.error('🚨 User Backfill: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

