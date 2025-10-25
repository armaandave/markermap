// Utility function to delete Cloudinary images
export const deleteCloudinaryImages = async (imageUrls: string[]): Promise<{
  success: boolean;
  deleted: number;
  errors: number;
  errorDetails: any[];
}> => {
  if (!imageUrls || imageUrls.length === 0) {
    return { success: true, deleted: 0, errors: 0, errorDetails: [] };
  }

  try {
    console.log(`🗑️ Deleting ${imageUrls.length} images from Cloudinary`);

    const response = await fetch('/api/images/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUrls }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete images');
    }

    const result = await response.json();
    console.log(`✅ Image deletion result:`, result);
    
    return result;
  } catch (error) {
    console.error('❌ Error deleting Cloudinary images:', error);
    return {
      success: false,
      deleted: 0,
      errors: imageUrls.length,
      errorDetails: [{ error: error instanceof Error ? error.message : 'Unknown error' }],
    };
  }
};
