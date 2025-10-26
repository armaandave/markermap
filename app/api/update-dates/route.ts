import { NextRequest, NextResponse } from 'next/server';
import { KMLParser } from '../../../lib/kml-parser';
import { Marker } from '../../../lib/db';

export async function POST(request: NextRequest) {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn('🚨 Supabase not configured');
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    const formData = await request.formData();
    const kmlFile = formData.get('kmlFile') as File;
    const userId = formData.get('userId') as string;

    if (!kmlFile) {
      return NextResponse.json({ error: 'No KML file provided.' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    console.log(`📁 Processing KML file for date update: ${kmlFile.name}`);

    // Parse KML to extract markers with timestamps
    const parsedKML = await KMLParser.parseKML(await kmlFile.text());
    console.log(`📊 Parsed KML: ${parsedKML.markers.length} markers with timestamps`);

    // Fetch current markers from Supabase using the sync endpoint
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const markersResponse = await fetch(`${baseUrl}/api/sync/markers?userId=${userId}`);
    
    if (!markersResponse.ok) {
      const error = await markersResponse.json();
      throw new Error(error.error || 'Failed to fetch markers');
    }

    const { markers: existingMarkers } = await markersResponse.json();
    console.log(`📊 Found ${existingMarkers.length} existing markers in database`);

    // Match markers by coordinates (lat/lng) with tolerance
    const COORDINATE_TOLERANCE = 0.000001; // Very small tolerance for floating point comparison
    let updatedCount = 0;
    let notFoundCount = 0;

    // Create a map of updated markers
    const updatedMarkers: Marker[] = existingMarkers.map((existingMarker: Marker) => {
      // Find matching KML marker by coordinates
      const matchingKmlMarker = parsedKML.markers.find(kmlMarker => {
        const latMatch = Math.abs(existingMarker.latitude - kmlMarker.latitude) < COORDINATE_TOLERANCE;
        const lngMatch = Math.abs(existingMarker.longitude - kmlMarker.longitude) < COORDINATE_TOLERANCE;
        return latMatch && lngMatch;
      });

      if (matchingKmlMarker) {
        // Update the createdAt date
        const createdAtDate = matchingKmlMarker.createdAt instanceof Date 
          ? matchingKmlMarker.createdAt 
          : new Date(matchingKmlMarker.createdAt);
        
        // Validate the date
        if (isNaN(createdAtDate.getTime())) {
          console.error(`❌ Invalid date for marker "${matchingKmlMarker.title}":`, matchingKmlMarker.createdAt);
          return existingMarker; // Return unchanged
        }
        
        updatedCount++;
        console.log(`✅ Will update marker "${existingMarker.title}" - Date: ${createdAtDate.toISOString()}`);
        
        return {
          ...existingMarker,
          createdAt: createdAtDate,
          updatedAt: new Date(),
        };
      } else {
        // No match found in KML, keep the existing marker unchanged
        return existingMarker;
      }
    });

    notFoundCount = parsedKML.markers.length - updatedCount;
    console.log(`📊 Matched ${updatedCount} markers, ${notFoundCount} not found in existing markers`);

    // Sync updated markers back to Supabase using the sync endpoint
    const syncResponse = await fetch(`${baseUrl}/api/sync/markers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markers: updatedMarkers, userId }),
    });

    if (!syncResponse.ok) {
      const error = await syncResponse.json();
      throw new Error(error.error || 'Failed to sync updated markers');
    }

    console.log(`📊 Update complete: ${updatedCount} updated, ${notFoundCount} not found`);

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      notFound: notFoundCount,
      total: parsedKML.markers.length,
    });

  } catch (error) {
    console.error('❌ Update dates API error:', error);
    return NextResponse.json(
      { error: 'Failed to update dates. Please check your file and try again.' },
      { status: 500 }
    );
  }
}

