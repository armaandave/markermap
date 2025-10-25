import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function DELETE(request: NextRequest) {
  try {
    const { imageUrls } = await request.json();

    if (!imageUrls || !Array.isArray(imageUrls)) {
      return NextResponse.json({ error: 'No image URLs provided.' }, { status: 400 });
    }

    console.log(`🗑️ Deleting ${imageUrls.length} images from Cloudinary`);

    const deletionResults = [];
    const errors = [];

    for (const imageUrl of imageUrls) {
      try {
        // Extract public ID from Cloudinary URL
        // URL format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/public_id.jpg
        const urlParts = imageUrl.split('/');
        const uploadIndex = urlParts.findIndex(part => part === 'upload');
        
        if (uploadIndex === -1 || uploadIndex + 1 >= urlParts.length) {
          console.warn(`⚠️ Invalid Cloudinary URL format: ${imageUrl}`);
          errors.push({ url: imageUrl, error: 'Invalid URL format' });
          continue;
        }

        // Get the public ID (everything after 'upload/v1234567890/')
        const publicIdWithExtension = urlParts.slice(uploadIndex + 2).join('/');
        const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, ""); // Remove file extension

        console.log(`🗑️ Deleting image with public ID: ${publicId}`);

        // Delete from Cloudinary
        const result = await cloudinary.uploader.destroy(publicId);
        
        if (result.result === 'ok') {
          deletionResults.push({ url: imageUrl, publicId, status: 'deleted' });
          console.log(`✅ Successfully deleted: ${publicId}`);
        } else {
          console.warn(`⚠️ Failed to delete: ${publicId}, result: ${result.result}`);
          errors.push({ url: imageUrl, publicId, error: result.result });
        }
      } catch (error) {
        console.error(`❌ Error deleting image ${imageUrl}:`, error);
        errors.push({ url: imageUrl, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    console.log(`📊 Deletion complete: ${deletionResults.length} deleted, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      deleted: deletionResults.length,
      errors: errors.length,
      results: deletionResults,
      errorDetails: errors,
    });

  } catch (error) {
    console.error('❌ Image deletion API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete images. Please try again.' },
      { status: 500 }
    );
  }
}
