import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';

// Get all friends (pending, accepted, etc.)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status'); // 'pending', 'accepted', or 'all'

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('👥 Friends: Fetching friends for user:', userId, 'status:', status);

    // Fetch friendships where user is either user_id or friend_id
    const { data: friendships, error: friendshipsError } = await supabaseAdmin
      .from('friendships')
      .select('*')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (friendshipsError) {
      console.error('🚨 Friends: Error fetching friendships:', friendshipsError);
      return NextResponse.json({ error: friendshipsError.message }, { status: 500 });
    }

    // Filter by status if specified
    let filteredFriendships = friendships || [];
    if (status && status !== 'all') {
      filteredFriendships = filteredFriendships.filter(f => f.status === status);
    }

    // Get friend details
    const friendIds = new Set<string>();
    filteredFriendships.forEach(friendship => {
      if (friendship.user_id === userId) {
        friendIds.add(friendship.friend_id);
      } else {
        friendIds.add(friendship.user_id);
      }
    });

    // Fetch user details for friends
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('*')
      .in('user_id', Array.from(friendIds));

    if (usersError) {
      console.error('🚨 Friends: Error fetching user details:', usersError);
    }

    // Combine friendship and user data
    const friendsWithDetails = filteredFriendships.map(friendship => {
      const friendId = friendship.user_id === userId ? friendship.friend_id : friendship.user_id;
      const friendUser = users?.find(u => u.user_id === friendId);
      
      return {
        ...friendship,
        friend: friendUser || {
          user_id: friendId,
          display_name: friendId.substring(0, 8),
          email: '',
          profile_picture_url: null,
        },
        isIncoming: friendship.friend_id === userId,
      };
    });

    console.log('✅ Friends: Fetched', friendsWithDetails.length, 'friends');
    return NextResponse.json({ friends: friendsWithDetails });
  } catch (error) {
    console.error('🚨 Friends: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Create or update friendship
export async function POST(request: Request) {
  try {
    const { userId, friendId, action } = await request.json();

    if (!userId || !friendId) {
      return NextResponse.json({ error: 'User ID and Friend ID are required' }, { status: 400 });
    }

    if (action === 'send_request') {
      console.log('👥 Friends: Sending friend request from', userId, 'to', friendId);

      // Check if friendship already exists
      const { data: existing } = await supabaseAdmin
        .from('friendships')
        .select('*')
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
        .single();

      if (existing) {
        return NextResponse.json({ error: 'Friendship already exists' }, { status: 400 });
      }

      // Create new friendship with 'pending' status
      const { data, error } = await supabaseAdmin
        .from('friendships')
        .insert({
          user_id: userId,
          friend_id: friendId,
          status: 'pending',
        });

      if (error) {
        console.error('🚨 Friends: Error creating friendship:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('✅ Friends: Friend request sent successfully');
      return NextResponse.json({ success: true, data });
    } else if (action === 'accept_request') {
      console.log('👥 Friends: Accepting friend request from', friendId, 'to', userId);

      // Update friendship status to 'accepted'
      const { error } = await supabaseAdmin
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('user_id', friendId)
        .eq('friend_id', userId);

      if (error) {
        console.error('🚨 Friends: Error accepting request:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('✅ Friends: Friend request accepted successfully');
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('🚨 Friends: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update friendship status (for accepting/rejecting)
export async function PATCH(request: Request) {
  try {
    const { friendshipId, userId, status } = await request.json();

    if (!friendshipId || !status) {
      return NextResponse.json({ error: 'Friendship ID and status are required' }, { status: 400 });
    }

    console.log('👥 Friends: Updating friendship', friendshipId, 'to status', status);

    const { error } = await supabaseAdmin
      .from('friendships')
      .update({ status })
      .eq('id', friendshipId);

    if (error) {
      console.error('🚨 Friends: Error updating friendship:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Friends: Friendship updated successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('🚨 Friends: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete friendship (unfriend)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const friendshipId = searchParams.get('id');

    if (!friendshipId) {
      return NextResponse.json({ error: 'Friendship ID is required' }, { status: 400 });
    }

    console.log('👥 Friends: Deleting friendship', friendshipId);

    const { error } = await supabaseAdmin
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (error) {
      console.error('🚨 Friends: Error deleting friendship:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Friends: Friendship deleted successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('🚨 Friends: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

