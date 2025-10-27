'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Marker, Folder } from '../lib/db';
import { X, Save, Plus, Trash2, ChevronDown } from 'lucide-react';
import ImageUpload from './ImageUpload';
import { deleteCloudinaryImages } from '../lib/cloudinary-utils';

interface MarkerEditModalProps {
  marker: Marker | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (marker: Marker) => void;
  folders: Folder[];
  allMarkers?: Marker[];
}

const MarkerEditModal: React.FC<MarkerEditModalProps> = ({ marker, isOpen, onClose, onSave, folders, allMarkers = [] }) => {
  const [formData, setFormData] = useState<Marker>({
    id: '',
    folderId: '',
    title: '',
    description: '',
    latitude: 0,
    longitude: 0,
    color: '#ffffff',
    address: '',
    images: [],
    customFields: {},
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const [newCustomField, setNewCustomField] = useState({ name: '', value: '' });
  const [newTag, setNewTag] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [favoriteColors, setFavoriteColors] = useState<string[]>([]);
  const [isFolderDropdownOpen, setIsFolderDropdownOpen] = useState(false);
  const folderDropdownRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Load favorite colors on mount
  useEffect(() => {
    const loadFavoriteColors = () => {
      const saved = localStorage.getItem('favoriteColors');
      if (saved) {
        try {
          setFavoriteColors(JSON.parse(saved));
        } catch {
          setFavoriteColors([]);
        }
      }
    };
    loadFavoriteColors();
  }, []);

  // Sync form data when marker prop changes
  useEffect(() => {
    if (marker) {
      // Use a microtask to avoid synchronous setState
      Promise.resolve().then(() => {
        setFormData({
          ...marker,
          customFields: marker.customFields || {},
          tags: marker.tags || [],
        });
      });
    }
  }, [marker]);

  // Close folder dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (folderDropdownRef.current && !folderDropdownRef.current.contains(event.target as Node)) {
        setIsFolderDropdownOpen(false);
      }
    };

    if (isFolderDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFolderDropdownOpen]);

  const handleColorSelect = (color: string) => {
    setFormData(prev => ({ ...prev, color }));
  };

  const handleSave = () => {
    const updatedMarker = {
      ...formData,
      updatedAt: new Date(),
    };
    onSave(updatedMarker);
    onClose();
  };

  const handleCustomFieldAdd = () => {
    if (newCustomField.name.trim() && newCustomField.value.trim()) {
      setFormData(prev => ({
        ...prev,
        customFields: {
          ...prev.customFields,
          [newCustomField.name]: newCustomField.value,
        },
      }));
      setNewCustomField({ name: '', value: '' });
    }
  };

  const handleCustomFieldRemove = (fieldName: string) => {
    setFormData(prev => {
      const newCustomFields = { ...prev.customFields };
      delete newCustomFields[fieldName];
      return {
        ...prev,
        customFields: newCustomFields,
      };
    });
  };

  const handleCustomFieldUpdate = (fieldName: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        [fieldName]: value,
      },
    }));
  };

  const handleTagAdd = (tag: string) => {
    if (tag.trim() && !formData.tags?.includes(tag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tag.trim()],
      }));
    }
  };

  const handleTagRemove = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || [],
    }));
  };

  // Get all unique existing tags from all markers, sorted by marker count
  const getAllExistingTags = () => {
    const tagCounts = new Map<string, number>();
    
    // Count markers per tag
    allMarkers.forEach(marker => {
      marker.tags?.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    
    // Sort by count (descending), then alphabetically for ties
    return Array.from(tagCounts.keys()).sort((a, b) => {
      const countDiff = tagCounts.get(b)! - tagCounts.get(a)!;
      return countDiff !== 0 ? countDiff : a.localeCompare(b);
    });
  };

  // Update suggestions when typing
  useEffect(() => {
    if (newTag.trim()) {
      // Count markers per tag
      const tagCounts = new Map<string, number>();
      allMarkers.forEach(marker => {
        marker.tags?.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      });
      
      // Get all tags sorted by usage count
      const existingTags = Array.from(tagCounts.keys()).sort((a, b) => {
        const countDiff = tagCounts.get(b)! - tagCounts.get(a)!;
        return countDiff !== 0 ? countDiff : a.localeCompare(b);
      });
      
      // Filter based on input and sort by count (already sorted)
      const filtered = existingTags
        .filter(tag => 
          tag.toLowerCase().includes(newTag.toLowerCase()) && 
          !formData.tags?.includes(tag)
        )
        .slice(0, 10); // Limit to 10 suggestions
      setTagSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setTagSuggestions([]);
      setShowSuggestions(false);
    }
    setSelectedSuggestionIndex(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newTag, formData.tags, allMarkers]);

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTag(e.target.value);
  };

  const handleTagInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && tagSuggestions[selectedSuggestionIndex]) {
        // Select from suggestions
        handleTagAdd(tagSuggestions[selectedSuggestionIndex]);
        setNewTag('');
        setShowSuggestions(false);
      } else if (newTag.trim()) {
        // Add new tag
        handleTagAdd(newTag);
        setNewTag('');
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
      tagInputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < tagSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleTagAdd(suggestion);
    setNewTag('');
    setShowSuggestions(false);
  };

  const handleTagInputFocus = () => {
    if (newTag.trim()) {
      const existingTags = getAllExistingTags();
      const filtered = existingTags
        .filter(tag => 
          tag.toLowerCase().includes(newTag.toLowerCase()) && 
          !formData.tags?.includes(tag)
        )
        .slice(0, 10);
      setTagSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    }
  };

  const handleTagInputBlur = () => {
    // Delay hiding suggestions to allow clicks on suggestions
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }, 200);
  };

  const handleImageUploaded = (imageUrl: string) => {
    setFormData(prev => ({
      ...prev,
      images: [...(prev.images || []), imageUrl],
    }));
  };

  const handleImageRemoved = async (imageUrl: string) => {
    // Delete from Cloudinary first
    console.log(`🗑️ Deleting image from Cloudinary: ${imageUrl}`);
    
    const deletionResult = await deleteCloudinaryImages([imageUrl]);
    
    if (deletionResult.success) {
      console.log(`✅ Successfully deleted image from Cloudinary`);
    } else {
      console.error(`❌ Failed to delete image from Cloudinary:`, deletionResult.errorDetails);
      // Still proceed with removing from UI even if Cloudinary deletion fails
    }

    // Remove from local state
    setFormData(prev => ({
      ...prev,
      images: prev.images?.filter(url => url !== imageUrl) || [],
    }));
  };

  if (!isOpen || !marker) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl min-h-[100vh] sm:min-h-0 sm:max-h-[95vh] overflow-y-auto my-2 sm:my-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Edit Marker</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Basic Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Color: <span className="text-blue-400">{formData.color}</span>
              </label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                className="w-full p-1 bg-gray-700 border border-gray-600 rounded-lg h-12"
              />
              {favoriteColors.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-400 mb-2">Favorite colors:</p>
                  <div className="flex flex-wrap gap-2">
                    {favoriteColors.map((color, index) => (
                      <button
                        key={index}
                        onClick={() => handleColorSelect(color)}
                        className="w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 cursor-pointer"
                        style={{ 
                          backgroundColor: color,
                          borderColor: formData.color === color ? '#3b82f6' : '#4b5563'
                        }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Folder Selection */}
          <div ref={folderDropdownRef} className="relative">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Folder
            </label>
            <button
              type="button"
              onClick={() => setIsFolderDropdownOpen(!isFolderDropdownOpen)}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 hover:bg-gray-600 transition-colors flex items-center justify-between"
            >
              <span>{folders.find(f => f.id === formData.folderId)?.name || 'Select a folder'}</span>
              <ChevronDown size={18} className={`text-gray-400 transition-transform ${isFolderDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isFolderDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                {folders.map(folder => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, folderId: folder.id }));
                      setIsFolderDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                      formData.folderId === folder.id
                        ? 'bg-blue-600/20 text-blue-300'
                        : 'text-white hover:bg-gray-600'
                    }`}
                  >
                    {folder.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Images
            </label>
            <ImageUpload
              onImageUploaded={handleImageUploaded}
              onImageRemoved={handleImageRemoved}
              existingImages={formData.images || []}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="Enter marker description..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Address
            </label>
            <input
              type="text"
              value={formData.address || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="Enter address..."
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tags
            </label>
            <div className="mb-2">
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags?.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600/20 border border-blue-500/30 text-blue-300 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      onClick={() => handleTagRemove(tag)}
                      className="text-blue-300 hover:text-blue-200"
                      type="button"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="relative">
                <input
                  ref={tagInputRef}
                  type="text"
                  value={newTag}
                  onChange={handleTagInputChange}
                  onKeyDown={handleTagInputKeyPress}
                  onFocus={handleTagInputFocus}
                  onBlur={handleTagInputBlur}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Press Enter to add a tag"
                />
                
                {/* Suggestions Dropdown */}
                {showSuggestions && tagSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {tagSuggestions.map((suggestion, index) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className={`w-full px-4 py-2 text-left text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                          index === selectedSuggestionIndex
                            ? 'bg-blue-600/20 text-blue-300'
                            : 'text-white hover:bg-gray-600'
                        }`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Custom Fields */}
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-medium text-white mb-3">Custom Fields</h3>
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Field name"
                    value={newCustomField.name}
                    onChange={(e) => setNewCustomField(prev => ({ ...prev, name: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={newCustomField.value}
                    onChange={(e) => setNewCustomField(prev => ({ ...prev, value: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleCustomFieldAdd}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm flex items-center justify-center gap-1 whitespace-nowrap"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {Object.entries(formData.customFields || {}).map(([fieldName, value]) => (
                <div key={fieldName} className="flex items-center gap-2 p-3 bg-gray-700 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">{fieldName}</label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleCustomFieldUpdate(fieldName, e.target.value)}
                      className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => handleCustomFieldRemove(fieldName)}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-600 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 p-4 sm:p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-3 text-gray-400 hover:text-white transition-colors order-2 sm:order-1"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors order-1 sm:order-2"
          >
            <Save size={16} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarkerEditModal;
