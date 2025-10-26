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

    console.log('🔄 Supabase Sync: Syncing', markers.length, 'markers for user:', userId);

    // First, delete all existing markers for this user
    console.log('🔄 Supabase Sync: Deleting existing markers for user:', userId);
    const { error: deleteError } = await supabaseAdmin
      .from('markers')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('🚨 Supabase Sync: Error deleting existing markers:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Then insert the new markers (if any)
    if (markers.length > 0) {
      console.log('🔄 Supabase Sync: Inserting', markers.length, 'new markers');
      
      // Convert markers to Supabase format
      const supabaseAdminMarkers = markers.map((marker: Marker) => ({
        ...convertMarkerToSupabase(marker),
        created_at: new Date(marker.createdAt).toISOString(),
        updated_at: new Date(marker.updatedAt).toISOString(),
      }));

      // Insert new markers
      const { error } = await supabaseAdmin
        .from('markers')
        .insert(supabaseAdminMarkers);

      if (error) {
        console.error('🚨 Supabase Sync: Error inserting markers:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('✅ Supabase Sync: Successfully inserted markers');
    } else {
      console.log('✅ Supabase Sync: No markers to insert (all deleted)');
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

    const { data, error } = await supabaseAdmin
      .from('markers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('🚨 Supabase Sync: Error fetching markers:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Convert back to local format
    const markers = data?.map(convertSupabaseToMarker) || [];
    console.log('✅ Supabase Sync: Fetched', markers.length, 'markers');

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
