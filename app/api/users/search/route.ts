import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const userId = searchParams.get('userId'); // Current user ID to exclude

    if (!query || !userId) {
      return NextResponse.json({ error: 'Query and user ID are required' }, { status: 400 });
    }

    console.log('🔍 User Search: Searching for users with query:', query, 'excluding user:', userId);

    // Search users by email or username
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .or(`email.ilike.%${query}%,display_name.ilike.%${query}%`)
      .neq('user_id', userId)
      .limit(10);

    if (error) {
      console.error('🚨 User Search: Error searching users:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter out existing friends
    const { data: friendships } = await supabaseAdmin
      .from('friendships')
      .select('*')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    const existingFriendIds = new Set<string>();
    friendships?.forEach(friendship => {
      if (friendship.user_id === userId) {
        existingFriendIds.add(friendship.friend_id);
      } else {
        existingFriendIds.add(friendship.user_id);
      }
    });

    const filteredUsers = (users || []).filter(user => !existingFriendIds.has(user.user_id));

    console.log('✅ User Search: Found', filteredUsers.length, 'users');
    return NextResponse.json({ users: filteredUsers });
  } catch (error) {
    console.error('🚨 User Search: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

