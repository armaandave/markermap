import { NextResponse } from 'next/server';
import { supabase, convertFolderToSupabase, convertSupabaseToFolder, convertMarkerToSupabase, convertSupabaseToMarker } from '../../../../lib/supabase';

// Sync folders to Supabase
export async function POST(request: Request) {
  try {
    const { folders, userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('🔄 Supabase Sync: Syncing', folders.length, 'folders for user:', userId);

    // Convert folders to Supabase format
    const supabaseFolders = folders.map((folder: any) => ({
      ...convertFolderToSupabase(folder),
      created_at: new Date(folder.createdAt).toISOString(),
      updated_at: new Date(folder.updatedAt).toISOString(),
    }));

    // Upsert folders (insert or update)
    const { data, error } = await supabase
      .from('folders')
      .upsert(supabaseFolders, { onConflict: 'id' });

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
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('🔄 Supabase Sync: Fetching folders for user:', userId);

    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .order('order', { ascending: true });

    if (error) {
      console.error('🚨 Supabase Sync: Error fetching folders:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Convert back to local format
    const folders = data?.map(convertSupabaseToFolder) || [];
    console.log('✅ Supabase Sync: Fetched', folders.length, 'folders');

    return NextResponse.json({ folders });
  } catch (error) {
    console.error('🚨 Supabase Sync: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete folders - can delete all or individual folder
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const folderId = searchParams.get('folderId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (folderId) {
      // Delete individual folder
      console.log('🗑️ Supabase Delete: Deleting individual folder:', folderId, 'for user:', userId);
      
      const { error } = await supabase
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

      const { error } = await supabase
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
