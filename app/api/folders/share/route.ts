import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { Folder } from '../../../../lib/db';

// Get folder shares (folders shared with user or by user)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type'); // 'shared-with-me' or 'shared-by-me'

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('📁 Folder Shares: Fetching shares for user:', userId, 'type:', type);

    let query = supabaseAdmin
      .from('folder_shares')
      .select('*');

    if (type === 'shared-with-me') {
      query = query.eq('shared_with_id', userId);
    } else if (type === 'shared-by-me') {
      query = query.eq('owner_id', userId);
    } else {
      // Get both types
      query = query.or(`shared_with_id.eq.${userId},owner_id.eq.${userId}`);
    }

    const { data: shares, error } = await query;

    if (error) {
      console.error('🚨 Folder Shares: Error fetching shares:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If fetching shared-with-me, also get the folder and owner details
    if (type === 'shared-with-me' || !type) {
      const folderIds = shares?.map(s => s.folder_id) || [];
      
      if (folderIds.length > 0) {
        const { data: folders } = await supabaseAdmin
          .from('folders')
          .select('*')
          .in('id', folderIds);

        const { data: ownerIds } = await supabaseAdmin
          .from('folder_shares')
          .select('owner_id')
          .in('folder_id', folderIds);

        const uniqueOwnerIds = [...new Set(ownerIds?.map(o => o.owner_id) || [])];
        
        const { data: owners } = await supabaseAdmin
          .from('users')
          .select('*')
          .in('user_id', uniqueOwnerIds);

        // Combine data
        const sharesWithDetails = shares?.map(share => {
          const folder = folders?.find(f => f.id === share.folder_id);
          const owner = owners?.find(o => o.user_id === share.owner_id);
          
          return {
            ...share,
            folder,
            owner: owner || { 
              user_id: share.owner_id, 
              display_name: share.owner_id.substring(0, 8),
              email: '',
              profile_picture_url: null,
            },
          };
        });

        console.log('✅ Folder Shares: Fetched', sharesWithDetails?.length || 0, 'shares with details');
        return NextResponse.json({ shares: sharesWithDetails });
      }
    }

    // If fetching shared-by-me or no type specified, populate sharedWith user details
    if (type === 'shared-by-me' || !type) {
      const sharedWithIds = [...new Set(shares?.map(s => s.shared_with_id) || [])];
      
      if (sharedWithIds.length > 0) {
        const { data: sharedWithUsers } = await supabaseAdmin
          .from('users')
          .select('*')
          .in('user_id', sharedWithIds);

        // Combine data
        const sharesWithDetails = shares?.map(share => {
          const sharedWith = sharedWithUsers?.find(u => u.user_id === share.shared_with_id);
          
          return {
            ...share,
            sharedWith: sharedWith || { 
              user_id: share.shared_with_id, 
              display_name: share.shared_with_id.substring(0, 8),
              email: '',
              profile_picture_url: null,
            },
          };
        });

        console.log('✅ Folder Shares: Fetched', sharesWithDetails?.length || 0, 'shares with details');
        return NextResponse.json({ shares: sharesWithDetails });
      }
    }

    console.log('✅ Folder Shares: Fetched', shares?.length || 0, 'shares');
    return NextResponse.json({ shares: shares || [] });
  } catch (error) {
    console.error('🚨 Folder Shares: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Share a folder with another user
export async function POST(request: Request) {
  try {
    const { folderId, userId, sharedWithId, permission } = await request.json();

    if (!folderId || !userId || !sharedWithId || !permission) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    console.log('📁 Folder Shares: Sharing folder', folderId, 'from', userId, 'with', sharedWithId);

    // Verify that the user owns this folder
    const { data: folder } = await supabaseAdmin
      .from('folders')
      .select('user_id')
      .eq('id', folderId)
      .single();

    if (!folder || folder.user_id !== userId) {
      return NextResponse.json({ error: 'You do not own this folder' }, { status: 403 });
    }

    // Check if share already exists
    const { data: existing } = await supabaseAdmin
      .from('folder_shares')
      .select('*')
      .eq('folder_id', folderId)
      .eq('shared_with_id', sharedWithId)
      .single();

    if (existing) {
      // Update existing share
      const { error: updateError } = await supabaseAdmin
        .from('folder_shares')
        .update({ permission })
        .eq('id', existing.id);

      if (updateError) {
        console.error('🚨 Folder Shares: Error updating share:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      console.log('✅ Folder Shares: Share updated successfully');
      return NextResponse.json({ success: true, shareId: existing.id });
    }

    // Create new share
    const { data, error } = await supabaseAdmin
      .from('folder_shares')
      .insert({
        folder_id: folderId,
        owner_id: userId,
        shared_with_id: sharedWithId,
        permission,
      });

    if (error) {
      console.error('🚨 Folder Shares: Error creating share:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Folder Shares: Share created successfully');
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('🚨 Folder Shares: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Unshare a folder
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shareId = searchParams.get('shareId');
    const userId = searchParams.get('userId');

    if (!shareId || !userId) {
      return NextResponse.json({ error: 'Share ID and User ID are required' }, { status: 400 });
    }

    console.log('📁 Folder Shares: Unsharing folder', shareId, 'for user', userId);

    // Verify user has permission to delete this share (must be owner)
    const { data: share } = await supabaseAdmin
      .from('folder_shares')
      .select('*')
      .eq('id', shareId)
      .single();

    if (!share) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    }

    if (share.owner_id !== userId && share.shared_with_id !== userId) {
      return NextResponse.json({ error: 'You do not have permission to delete this share' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('folder_shares')
      .delete()
      .eq('id', shareId);

    if (error) {
      console.error('🚨 Folder Shares: Error deleting share:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Folder Shares: Share deleted successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('🚨 Folder Shares: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

