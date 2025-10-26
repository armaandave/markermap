'use client';

import React, { useState, useRef, useEffect } from 'react';
import ImageGalleryModal from './ImageGalleryModal';

interface ImageUploadProps {
  onImageUploaded: (imageUrl: string) => void;
  onImageRemoved?: (imageUrl: string) => void;
  existingImages?: string[];
  maxImages?: number; // Optional, defaults to unlimited
}

export default function ImageUpload({ 
  onImageUploaded, 
  onImageRemoved, 
  existingImages = [], 
  maxImages = undefined // undefined means unlimited
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return false;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('Image size must be less than 10MB.');
      return false;
    }

    setUploadingCount(prev => prev + 1);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const { imageUrl } = await response.json();
      onImageUploaded(imageUrl);
      return true;
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Failed to upload ${file.name}. Please try again.`);
      return false;
    } finally {
      setUploadingCount(prev => prev - 1);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      // If there's a maxImages limit, enforce it
      let filesToUpload = Array.from(files);
      
      if (maxImages !== undefined) {
        const remainingSlots = maxImages - existingImages.length;
        filesToUpload = filesToUpload.slice(0, remainingSlots);
        
        if (files.length > remainingSlots) {
          alert(`You can only add ${remainingSlots} more image(s). The remaining files will be ignored.`);
        }
      }
      
      // Upload all files in parallel
      await Promise.all(filesToUpload.map(file => handleFileUpload(file)));
    }
    
    // Reset the input so the same files can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);

    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      // If there's a maxImages limit, enforce it
      let filesToUpload = Array.from(files);
      
      if (maxImages !== undefined) {
        const remainingSlots = maxImages - existingImages.length;
        filesToUpload = filesToUpload.slice(0, remainingSlots);
        
        if (files.length > remainingSlots) {
          alert(`You can only add ${remainingSlots} more image(s). The remaining files will be ignored.`);
        }
      }
      
      // Upload all files in parallel
      await Promise.all(filesToUpload.map(file => handleFileUpload(file)));
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleRemoveImage = (imageUrl: string) => {
    if (onImageRemoved) {
      onImageRemoved(imageUrl);
    }
  };

  const canAddMoreImages = maxImages === undefined || existingImages.length < maxImages;
  
  // Update uploading state based on count
  useEffect(() => {
    setUploading(uploadingCount > 0);
  }, [uploadingCount]);

  return (
    <>
      <div className="space-y-4">
        {/* Existing Images */}
        {existingImages.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {existingImages.map((imageUrl, index) => (
              <div key={index} className="relative group">
                <img
                  src={imageUrl}
                  alt={`Uploaded image ${index + 1}`}
                  className="w-full h-40 object-cover rounded-lg border border-gray-600 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => {
                    setGalleryIndex(index);
                    setIsGalleryOpen(true);
                  }}
                />
                {onImageRemoved && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage(imageUrl);
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

      {/* Upload Area */}
      {canAddMoreImages && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragOver
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="space-y-2">
            <div className="text-gray-500">
              {uploading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  <span>Uploading...</span>
                </div>
              ) : (
                <>
                  <p className="text-sm">
                    Drag and drop image(s) here, or{' '}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-500 hover:text-blue-700 underline"
                    >
                      click to select
                    </button>
                  </p>
                  <p className="text-xs text-gray-400">
                    {maxImages !== undefined ? `Max ${maxImages} images, ` : ''}10MB each. You can select multiple at once.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

        {/* Image Count */}
        <p className="text-xs text-gray-500 text-center">
          {existingImages.length}{maxImages !== undefined ? ` / ${maxImages}` : ''} images
        </p>
      </div>

      {/* Image Gallery Modal */}
      <ImageGalleryModal
        images={existingImages}
        initialIndex={galleryIndex}
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
      />
    </>
  );
}
