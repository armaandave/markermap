import { NextResponse } from 'next/server';
import { supabaseAdmin, convertFolderToSupabase, convertSupabaseToFolder } from '../../../../lib/supabase';
import { Folder } from '../../../../lib/db';

// Sync folders to Supabase
export async function POST(request: Request) {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn('🚨 Supabase not configured, skipping sync');
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    const { folders, userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('🔄 Supabase Sync: Syncing folders for user:', userId);

    // Filter to only folders owned by this user (not shared folders)
    const userOwnedFolders = folders.filter((folder: Folder) => 
      folder.userId === userId && !folder.isShared
    );
    console.log(`🔄 Found ${folders.length} total folders, ${userOwnedFolders.length} owned by user`);

    // Convert folders to Supabase format
    const supabaseAdminFolders = userOwnedFolders.map((folder: Folder) => ({
      ...convertFolderToSupabase(folder),
      created_at: new Date(folder.createdAt).toISOString(),
      updated_at: new Date(folder.updatedAt).toISOString(),
    }));

    // Upsert folders (insert or update)
    const { data, error } = await supabaseAdmin
      .from('folders')
      .upsert(supabaseAdminFolders, { onConflict: 'id' });

    if (error) {
      console.error('🚨 Supabase Sync: Error syncing folders:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Supabase Sync: Successfully synced folders');
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('🚨 Supabase Sync: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get folders from Supabase
export async function GET(request: Request) {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn('🚨 Supabase not configured, returning empty folders');
      return NextResponse.json({ folders: [] });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('🔄 Supabase Sync: Fetching folders for user:', userId);

    // Fetch user's own folders
    const { data: ownFolders, error: ownFoldersError } = await supabaseAdmin
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .order('order', { ascending: true });

    if (ownFoldersError) {
      console.error('🚨 Supabase Sync: Error fetching own folders:', ownFoldersError);
      return NextResponse.json({ error: ownFoldersError.message }, { status: 500 });
    }

    // Fetch folders shared with this user
    const { data: folderShares } = await supabaseAdmin
      .from('folder_shares')
      .select('*')
      .eq('shared_with_id', userId);

    const sharedFolderIds = folderShares?.map(s => s.folder_id) || [];
    let sharedFolders: any[] = [];

    if (sharedFolderIds.length > 0) {
      const { data: sharedFoldersData } = await supabaseAdmin
        .from('folders')
        .select('*')
        .in('id', sharedFolderIds)
        .order('order', { ascending: true });

      sharedFolders = sharedFoldersData || [];
    }

    // Fetch owner details for shared folders
    const ownerIds = [...new Set(folderShares?.map(s => s.owner_id) || [])];
    let ownerDetails: any[] = [];
    
    if (ownerIds.length > 0) {
      const { data: owners } = await supabaseAdmin
        .from('users')
        .select('*')
        .in('user_id', ownerIds);
      
      ownerDetails = owners || [];
    }

    // Convert owned folders to local format
    const convertedOwnFolders = ownFolders?.map(convertSupabaseToFolder) || [];
    
    // Convert shared folders to local format and add metadata
    const convertedSharedFolders = sharedFolders.map(folder => {
      const share = folderShares?.find(s => s.folder_id === folder.id);
      const owner = ownerDetails.find(o => o.user_id === share?.owner_id);
      
      return {
        ...convertSupabaseToFolder(folder),
        isShared: true,
        ownerId: share?.owner_id,
        ownerName: owner?.display_name || owner?.email || share?.owner_id.substring(0, 8),
        sharePermission: share?.permission || 'view',
      };
    });

    // Combine owned and shared folders
    const allFolders = [...convertedOwnFolders, ...convertedSharedFolders];
    
    console.log('✅ Supabase Sync: Fetched', allFolders.length, 'folders (', convertedOwnFolders.length, 'owned,', convertedSharedFolders.length, 'shared)');

    return NextResponse.json({ folders: allFolders });
  } catch (error) {
    console.error('🚨 Supabase Sync: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete folders - can delete all or individual folder
export async function DELETE(request: Request) {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn('🚨 Supabase not configured, skipping deletion');
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const folderId = searchParams.get('folderId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (folderId) {
      // Delete individual folder
      console.log('🗑️ Supabase Delete: Deleting individual folder:', folderId, 'for user:', userId);
      
      const { error } = await supabaseAdmin
        .from('folders')
        .delete()
        .eq('id', folderId)
        .eq('user_id', userId);

      if (error) {
        console.error('🚨 Supabase Delete: Error deleting folder:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('✅ Supabase Delete: Successfully deleted folder:', folderId);
      return NextResponse.json({ success: true });
    } else {
      // Delete all folders for user (except default)
      console.log('🗑️ Supabase Delete: Deleting all folders for user:', userId);

      const { error } = await supabaseAdmin
        .from('folders')
        .delete()
        .eq('user_id', userId)
        .neq('name', 'Default');

      if (error) {
        console.error('🚨 Supabase Delete: Error deleting folders:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('✅ Supabase Delete: Successfully deleted all folders');
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('🚨 Supabase Delete: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
