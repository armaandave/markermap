import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { KMLParser } from '../../../lib/kml-parser';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const kmlFile = formData.get('kmlFile') as File;
    const imageFiles = formData.getAll('imageFiles') as File[];
    const userId = formData.get('userId') as string;

    if (!kmlFile) {
      return NextResponse.json({ error: 'No KML file provided.' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    console.log(`📁 Processing KML file: ${kmlFile.name}`);
    console.log(`🖼️ Processing ${imageFiles.length} image files`);

    // Parse KML (without trying to convert images on server-side)
    const parsedKML = await KMLParser.parseKML(await kmlFile.text());

    console.log(`📊 Parsed KML: ${parsedKML.folders.length} folders, ${parsedKML.markers.length} markers`);

    // Upload images to Cloudinary using Node.js buffers
    const imageUrlMap: { [filename: string]: string } = {};
    
    console.log(`\n📊 UPLOAD START: ${imageFiles.length} images to upload`);
    
    let uploadSuccess = 0;
    let uploadFailed = 0;
    
    for (const file of imageFiles) {
      try {
        const publicId = `markermap-images/${file.name.split('.')[0]}`;
        
        // Check if image already exists in Cloudinary
        try {
          const existingImage = await cloudinary.api.resource(publicId);
          if (existingImage && existingImage.secure_url) {
            console.log(`⏭️ Skipping ${file.name} (already exists)`);
            imageUrlMap[file.name] = existingImage.secure_url;
            uploadSuccess++;
            continue;
          }
        } catch (checkError: unknown) {
          // Image doesn't exist (404), continue with upload
          const error = checkError as { error?: { http_code?: number }; message?: string };
          if (error.error?.http_code !== 404) {
            console.warn(`⚠️ Error checking ${file.name}:`, error.message || 'Unknown error');
          }
        }

        // Convert File to buffer using arrayBuffer (works in Node.js)
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            {
              upload_preset: 'markermap-uploads',
              folder: 'markermap-images',
              public_id: file.name.split('.')[0],
            },
            (error, result) => {
              if (error) {
                console.error(`❌ Cloudinary error for ${file.name}:`, error);
                return reject(error);
              }
              resolve(result);
            }
          ).end(buffer);
        });

        // @ts-expect-error - Cloudinary types don't include secure_url but it exists
        const imageUrl = uploadResult.secure_url;
        imageUrlMap[file.name] = imageUrl;
        uploadSuccess++;
      } catch (error) {
        uploadFailed++;
        console.error(`❌ Upload failed for ${file.name}:`, error);
      }
    }

    console.log(`\n📊 UPLOAD COMPLETE: ${uploadSuccess} succeeded, ${uploadFailed} failed\n`);

    // Update markers with Cloudinary URLs instead of filenames
    const updatedMarkers = parsedKML.markers.map(marker => {
      const cloudinaryImages: string[] = [];
      
      // Convert image filenames to Cloudinary URLs
      if (marker.images && Array.isArray(marker.images)) {
        marker.images.forEach(filename => {
          if (imageUrlMap[filename]) {
            cloudinaryImages.push(imageUrlMap[filename]);
          }
        });
      }

      return {
        ...marker,
        images: cloudinaryImages,
      };
    });

    console.log(`📊 Final result: ${parsedKML.folders.length} folders, ${updatedMarkers.length} markers`);

    // Generate truly unique IDs to avoid conflicts
    const generateUniqueId = () => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      const counter = Math.floor(Math.random() * 10000);
      return `${timestamp}-${random}-${counter}`;
    };
    
    // Create a map of old folder IDs to new folder IDs
    const folderIdMap: { [oldId: string]: string } = {};
    
    const foldersWithUserId = parsedKML.folders.map(folder => {
      const newId = generateUniqueId();
      folderIdMap[folder.id] = newId; // Map old ID to new ID
      
      return {
        ...folder,
        id: newId,
        parentId: folder.parentId ? folderIdMap[folder.parentId] : folder.parentId, // Update parent references
        userId: userId,
      };
    });

    const markersWithUserId = updatedMarkers.map(marker => ({
      ...marker,
      id: generateUniqueId(),
      folderId: folderIdMap[marker.folderId] || marker.folderId, // Update folder reference
      userId: userId,
    }));

    // Sync to Supabase
    console.log(`\n📤 Syncing to Supabase: ${foldersWithUserId.length} folders, ${markersWithUserId.length} markers`);
    
    try {
      // Sync folders
      const foldersResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sync/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folders: foldersWithUserId, userId }),
      });
      
      if (!foldersResponse.ok) {
        throw new Error('Failed to sync folders');
      }
      
      // Sync markers
      const markersResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sync/markers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markers: markersWithUserId, userId }),
      });
      
      if (!markersResponse.ok) {
        throw new Error('Failed to sync markers');
      }
      
      console.log(`✅ Successfully synced to Supabase`);
    } catch (syncError) {
      console.error(`❌ Supabase sync error:`, syncError);
      return NextResponse.json(
        { error: 'Images uploaded but failed to save markers to database' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      folders: foldersWithUserId,
      markers: markersWithUserId,
      imageUploadStats: {
        total: imageFiles.length,
        uploaded: Object.keys(imageUrlMap).length,
        failed: imageFiles.length - Object.keys(imageUrlMap).length,
      },
    });

  } catch (error) {
    console.error('❌ Import API error:', error);
    return NextResponse.json(
      { error: 'Failed to process import. Please check your files and try again.' },
      { status: 500 }
    );
  }
}
