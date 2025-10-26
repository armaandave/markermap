import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

// Get preferences from Supabase
export async function GET(request: Request) {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn('🚨 Supabase not configured, returning empty preferences');
      return NextResponse.json({ favoriteColors: [] });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('🔄 Preferences: Fetching for user:', userId);

    const { data, error } = await supabase
      .from('preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('🚨 Preferences: Error fetching:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const favoriteColors = data?.favorite_colors || [];
    console.log('✅ Preferences: Fetched', favoriteColors.length, 'favorite colors');

    return NextResponse.json({ favoriteColors });
  } catch (error) {
    console.error('🚨 Preferences: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Save preferences to Supabase
export async function POST(request: Request) {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn('🚨 Supabase not configured, skipping save');
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    const { favoriteColors, userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('🔄 Preferences: Saving', favoriteColors.length, 'favorite colors for user:', userId);
    console.log('🔄 Preferences: Data:', JSON.stringify({ favoriteColors, userId }));

    // Try to update first
    const { data: updateData, error: updateError } = await supabase
      .from('preferences')
      .update({ 
        favorite_colors: favoriteColors,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select();

    console.log('🔄 Update result - data:', updateData, 'error:', updateError);

    // If update affected 0 rows, insert instead
    if (updateError || !updateData || updateData.length === 0) {
      console.log('⚠️ Preferences: No existing preferences found, inserting...');
      const { data: insertData, error: insertError } = await supabase
        .from('preferences')
        .insert({
          user_id: userId,
          favorite_colors: favoriteColors,
        })
        .select();

      console.log('🔄 Insert result - data:', insertData, 'error:', insertError);

      if (insertError) {
        console.error('🚨 Preferences: Error inserting:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      console.log('✅ Preferences: Successfully inserted preferences');
    } else {
      console.log('✅ Preferences: Successfully updated preferences');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('🚨 Preferences: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

