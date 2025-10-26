'use client';

import React, { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, X, Clock } from 'lucide-react';
import { useAuthContext } from './AuthProvider';

interface UpdateDatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateComplete?: () => void;
}

interface UpdateStats {
  updated: number;
  notFound: number;
  total: number;
}

export default function UpdateDatesModal({ isOpen, onClose, onUpdateComplete }: UpdateDatesModalProps) {
  const { user } = useAuthContext();
  const [kmlFile, setKmlFile] = useState<File | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<string>('');
  const [updateStats, setUpdateStats] = useState<UpdateStats | null>(null);
  const [dragOver, setDragOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.kml')) {
      setKmlFile(file);
    } else {
      alert('Please select a valid KML file');
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);

    const file = event.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.kml')) {
      setKmlFile(file);
    } else {
      alert('Please drop a valid KML file');
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleUpdate = async () => {
    if (!kmlFile) {
      alert('Please select a KML file');
      return;
    }

    setIsUpdating(true);
    setUpdateProgress('Reading KML file...');

    try {
      const formData = new FormData();
      formData.append('kmlFile', kmlFile);
      formData.append('userId', user?.uid || '');

      setUpdateProgress('Matching markers and updating dates...');

      const response = await fetch('/api/update-dates', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Update failed');
      }

      const result = await response.json();
      
      setUpdateStats(result);
      setUpdateProgress('Update completed successfully!');

      console.log(`✅ Date update successful: ${result.updated} markers updated`);

      // Reload the page after successful update
      setTimeout(() => {
        handleClose();
        if (onUpdateComplete) {
          onUpdateComplete();
        }
        window.location.reload();
      }, 3000);

    } catch (error) {
      console.error('Update error:', error);
      alert(`Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    setKmlFile(null);
    setUpdateProgress('');
    setUpdateStats(null);
    setIsUpdating(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Clock size={24} className="text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Update Dates from KML</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            disabled={isUpdating}
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <h3 className="text-blue-300 font-medium mb-2">How this works:</h3>
            <ol className="text-blue-200 text-sm space-y-1 list-decimal list-inside">
              <li>Select your KML file (the same one you imported before)</li>
              <li>The tool will extract original creation dates from the KML</li>
              <li>It will match markers by their coordinates (latitude/longitude)</li>
              <li>Only the creation dates will be updated - everything else stays the same</li>
              <li>New markers you&apos;ve added won&apos;t be affected (they won&apos;t match anything)</li>
            </ol>
            <div className="mt-3 p-2 bg-blue-800/30 rounded text-xs">
              <strong>Note:</strong> This is safe - it only updates dates for markers that match coordinates in your KML file. Your manually created markers will be untouched.
            </div>
          </div>

          {/* File Selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select KML File
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                  disabled={isUpdating}
                >
                  <Upload size={16} />
                  {kmlFile ? 'Change File' : 'Select KML'}
                </button>
                {kmlFile && (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle size={16} />
                    <span className="text-sm">{kmlFile.name}</span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".kml"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Drag and Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver
                ? 'border-blue-500 bg-blue-50/10'
                : 'border-gray-600 hover:border-gray-500'
            } ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload size={32} className="mx-auto text-gray-400 mb-2" />
            <p className="text-gray-300 text-sm">
              Or drag and drop your KML file here
            </p>
          </div>

          {/* Update Progress */}
          {isUpdating && (
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span className="text-white text-sm">{updateProgress}</span>
              </div>
            </div>
          )}

          {/* Update Stats */}
          {updateStats && (
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} className="text-green-400" />
                <span className="text-green-300 font-medium">Update Complete!</span>
              </div>
              <div className="text-green-200 text-sm space-y-1">
                <p>✅ Updated: {updateStats.updated} marker(s)</p>
                <p>📊 Total in KML: {updateStats.total} marker(s)</p>
                {updateStats.notFound > 0 && (
                  <p className="text-yellow-300">
                    ⚠️ Not found: {updateStats.notFound} marker(s) 
                    <span className="text-xs block ml-4">(These might be new markers you added manually)</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            disabled={isUpdating}
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            disabled={!kmlFile || isUpdating}
          >
            <Clock size={16} />
            {isUpdating ? 'Updating...' : 'Update Dates'}
          </button>
        </div>
      </div>
    </div>
  );
}

