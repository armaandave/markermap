import { NextResponse } from 'next/server';
import { supabaseAdmin, convertMarkerToSupabase, convertSupabaseToMarker } from '../../../../lib/supabase';
import { Marker } from '../../../../lib/db';

// Sync markers to Supabase
export async function POST(request: Request) {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn('🚨 Supabase not configured, skipping sync');
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    const { markers, userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('🔄 Supabase Sync: Syncing markers for user:', userId);

    // Filter to only markers owned by this user
    const userOwnedMarkers = markers.filter((marker: Marker) => marker.userId === userId);
    console.log(`🔄 Found ${markers.length} total markers, ${userOwnedMarkers.length} owned by user`);

    if (userOwnedMarkers.length > 0) {
      // Convert markers to Supabase format
      const supabaseAdminMarkers = userOwnedMarkers.map((marker: Marker) => ({
        ...convertMarkerToSupabase(marker),
        created_at: new Date(marker.createdAt).toISOString(),
        updated_at: new Date(marker.updatedAt).toISOString(),
      }));

      // Use upsert instead of delete + insert to avoid constraint violations
      console.log('🔄 Supabase Sync: Upserting', userOwnedMarkers.length, 'markers');
      const { error } = await supabaseAdmin
        .from('markers')
        .upsert(supabaseAdminMarkers, { onConflict: 'id' });

      if (error) {
        console.error('🚨 Supabase Sync: Error upserting markers:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Now delete markers that should be removed (markers for this user that aren't in the list)
      const markerIds = new Set(userOwnedMarkers.map((m: Marker) => m.id));
      const { data: existingMarkers } = await supabaseAdmin
        .from('markers')
        .select('id')
        .eq('user_id', userId);

      const markersToDelete = (existingMarkers || [])
        .filter((m: { id: string }) => !markerIds.has(m.id))
        .map((m: { id: string }) => m.id);

      if (markersToDelete.length > 0) {
        console.log('🔄 Supabase Sync: Deleting', markersToDelete.length, 'orphaned markers');
        const { error: deleteError } = await supabaseAdmin
          .from('markers')
          .delete()
          .in('id', markersToDelete);

        if (deleteError) {
          console.error('🚨 Supabase Sync: Error deleting orphaned markers:', deleteError);
        }
      }

      console.log('✅ Supabase Sync: Successfully synced markers');
    } else {
      // If no markers, delete all markers for this user
      console.log('🔄 Supabase Sync: No markers, deleting all for user');
      const { error } = await supabaseAdmin
        .from('markers')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('🚨 Supabase Sync: Error deleting all markers:', error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('🚨 Supabase Sync: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get markers from Supabase
export async function GET(request: Request) {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn('🚨 Supabase not configured, returning empty markers');
      return NextResponse.json({ markers: [] });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('🔄 Supabase Sync: Fetching markers for user:', userId);

    // Fetch user's own folders to get their folder IDs
    const { data: userFolders } = await supabaseAdmin
      .from('folders')
      .select('id')
      .eq('user_id', userId);

    const userFolderIds = userFolders?.map(f => f.id) || [];

    // Fetch shared folders for this user
    const { data: sharedFolders } = await supabaseAdmin
      .from('folder_shares')
      .select('folder_id')
      .eq('shared_with_id', userId);

    const sharedFolderIds = (sharedFolders || []).map(s => s.folder_id);
    const allFolderIds = [...userFolderIds, ...sharedFolderIds];

    console.log('📁 Found', userFolderIds.length, 'own folders and', sharedFolderIds.length, 'shared folders');

    // Fetch markers in all folders (own + shared)
    let ownMarkers: any[] = [];
    let sharedMarkers: any[] = [];

    if (userFolderIds.length > 0) {
      const { data: ownMarkersData } = await supabaseAdmin
        .from('markers')
        .select('*')
        .in('folder_id', userFolderIds)
        .order('created_at', { ascending: true });

      ownMarkers = ownMarkersData || [];
    }

    if (sharedFolderIds.length > 0) {
      const { data: sharedMarkersData } = await supabaseAdmin
        .from('markers')
        .select('*')
        .in('folder_id', sharedFolderIds)
        .order('created_at', { ascending: true });

      sharedMarkers = sharedMarkersData || [];
    }

    // Combine and convert to local format
    const allMarkers = [...ownMarkers, ...sharedMarkers];
    const markers = allMarkers.map(convertSupabaseToMarker);
    
    console.log('✅ Supabase Sync: Fetched', markers.length, 'markers (', ownMarkers.length, 'own,', sharedMarkers.length, 'shared)');

    return NextResponse.json({ markers });
  } catch (error) {
    console.error('🚨 Supabase Sync: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete all markers for a user
export async function DELETE(request: Request) {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn('🚨 Supabase not configured, skipping deletion');
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('🗑️ Supabase Delete: Deleting all markers for user:', userId);

    // Delete all markers for this user
    const { error } = await supabaseAdmin
      .from('markers')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('🚨 Supabase Delete: Error deleting markers:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Supabase Delete: Successfully deleted all markers');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('🚨 Supabase Delete: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
