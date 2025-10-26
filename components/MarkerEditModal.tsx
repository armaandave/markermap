'use client';

import React, { useState, useEffect } from 'react';
import { Marker, Folder } from '../lib/db';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import ImageUpload from './ImageUpload';
import { deleteCloudinaryImages } from '../lib/cloudinary-utils';

interface MarkerEditModalProps {
  marker: Marker | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (marker: Marker) => void;
  folders: Folder[];
}

const MarkerEditModal: React.FC<MarkerEditModalProps> = ({ marker, isOpen, onClose, onSave, folders }) => {
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
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const [newCustomField, setNewCustomField] = useState({ name: '', value: '' });

  // Sync form data when marker prop changes
  useEffect(() => {
    if (marker) {
      // Use a microtask to avoid synchronous setState
      Promise.resolve().then(() => {
        setFormData({
          ...marker,
          customFields: marker.customFields || {},
        });
      });
    }
  }, [marker]);

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
                Color
              </label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                className="w-full p-1 bg-gray-700 border border-gray-600 rounded-lg h-12"
              />
            </div>
          </div>

          {/* Folder Information */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Folder
            </label>
            <div className="p-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
              {folders.find(f => f.id === formData.folderId)?.name || 'Unknown Folder'}
            </div>
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
              maxImages={5}
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
