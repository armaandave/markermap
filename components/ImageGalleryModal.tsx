'use client';

import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageGalleryModalProps {
  images: string[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

const ImageGalleryModal: React.FC<ImageGalleryModalProps> = ({ 
  images, 
  initialIndex, 
  isOpen, 
  onClose 
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Update current index when modal opens or initialIndex changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && canGoNext()) {
      goNext();
    } else if (isRightSwipe && canGoPrev()) {
      goPrev();
    }
  };

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && canGoNext()) {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' && canGoPrev()) {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex]);

  const canGoPrev = () => currentIndex > 0;
  const canGoNext = () => currentIndex < images.length - 1;

  const goPrev = () => {
    if (canGoPrev()) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goNext = () => {
    if (canGoNext()) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const hasMultipleImages = images.length > 1;

  if (!isOpen || images.length === 0) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4"
      onClick={() => onClose()}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 bg-gray-800 hover:bg-gray-700 text-white rounded-full w-12 h-12 flex items-center justify-center transition-colors z-10"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Left Arrow - Only show if multiple images */}
      {hasMultipleImages && canGoPrev() && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="absolute left-4 bg-gray-800/80 hover:bg-gray-700/80 text-white rounded-full w-12 h-12 flex items-center justify-center transition-colors z-10 backdrop-blur-sm"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {/* Right Arrow - Only show if multiple images */}
      {hasMultipleImages && canGoNext() && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="absolute right-4 bg-gray-800/80 hover:bg-gray-700/80 text-white rounded-full w-12 h-12 flex items-center justify-center transition-colors z-10 backdrop-blur-sm"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* Image Counter */}
      {hasMultipleImages && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800/80 text-white px-4 py-2 rounded-full backdrop-blur-sm">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Image */}
      <img
        src={images[currentIndex]}
        alt={`Image ${currentIndex + 1}`}
        className="max-w-full max-h-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={hasMultipleImages ? onTouchStart : undefined}
        onTouchMove={hasMultipleImages ? onTouchMove : undefined}
        onTouchEnd={hasMultipleImages ? onTouchEnd : undefined}
      />
    </div>
  );
};

export default ImageGalleryModal;

