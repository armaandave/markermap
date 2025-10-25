import { NextResponse } from 'next/server';
import { supabase, convertMarkerToSupabase, convertSupabaseToMarker } from '../../../../lib/supabase';

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

    // Convert markers to Supabase format
    const supabaseMarkers = markers.map((marker: any) => ({
      ...convertMarkerToSupabase(marker),
      created_at: new Date(marker.createdAt).toISOString(),
      updated_at: new Date(marker.updatedAt).toISOString(),
    }));

    // Upsert markers (insert or update)
    const { data, error } = await supabase
      .from('markers')
      .upsert(supabaseMarkers, { onConflict: 'id' });

    if (error) {
      console.error('🚨 Supabase Sync: Error syncing markers:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Supabase Sync: Successfully synced markers');
    return NextResponse.json({ success: true, data });
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

    const { data, error } = await supabase
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
    const { error } = await supabase
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
