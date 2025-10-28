import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Set configuration for this route
export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    // Check file size based on environment
    // In development (localhost), allow up to 100MB. In production, limit to 4.5MB (Vercel restriction)
    const isDevelopment = process.env.NODE_ENV === 'development';
    const maxSize = isDevelopment ? 100 * 1024 * 1024 : 4.5 * 1024 * 1024;
    const maxSizeMB = maxSize / 1024 / 1024;
    
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: `File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is ${maxSizeMB}MB.` 
      }, { status: 413 });
    }

    // Convert file to a buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          upload_preset: 'markermap-uploads', // Use the preset name you created
          folder: 'markermap-images', // The folder in Cloudinary
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            return reject(error);
          }
          resolve(result);
        }
      ).end(buffer);
    });

    // @ts-expect-error - Cloudinary types don't include secure_url but it exists
    return NextResponse.json({ imageUrl: uploadResult.secure_url }, { status: 200 });

  } catch (error) {
    console.error('API route error:', error);
    
    // Return more specific error messages
    if (error && typeof error === 'object' && 'message' in error) {
      return NextResponse.json({ 
        error: error.message || 'Failed to upload image.' 
      }, { status: 500 });
    }
    
    return NextResponse.json({ error: 'Failed to upload image.' }, { status: 500 });
  }
}
