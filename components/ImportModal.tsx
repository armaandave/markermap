'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, Image, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Folder, Marker } from '../lib/db';
import { useAuthContext } from './AuthProvider';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (folders: Folder[], markers: Marker[]) => void;
}

interface ImportStats {
  total: number;
  uploaded: number;
  failed: number;
}

export default function ImportModal({ isOpen, onClose, onImportComplete }: ImportModalProps) {
  const { user } = useAuthContext();
  const [selectedFolder, setSelectedFolder] = useState<FileList | null>(null);
  const [kmlFile, setKmlFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [dragOver, setDragOver] = useState(false);
  
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFolderSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setSelectedFolder(files);

    // Process the folder structure
    const filesArray = Array.from(files);

    // Find KML file - just look for any .kml file
    const kmlFile = filesArray.find(file => 
      file.name.toLowerCase().endsWith('.kml')
    );
    
    // Find all image files - don't care about folder structure
    const imageFiles = filesArray.filter(file => 
      file.type.startsWith('image/')
    );

    if (kmlFile) {
      setKmlFile(kmlFile);
      console.log(`📄 Found KML file: ${kmlFile.name}`);
    } else {
      setKmlFile(null);
      console.warn('⚠️ No KML file found');
    }

    setImageFiles(imageFiles);
    console.log(`🖼️ Found ${imageFiles.length} images`);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);

    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;

    setSelectedFolder(files);
    
    // Process the folder structure
    const filesArray = Array.from(files);
    
    // Find KML file - just look for any .kml file
    const kmlFile = filesArray.find(file => 
      file.name.toLowerCase().endsWith('.kml')
    );
    
    // Find all image files - don't care about folder structure
    const imageFiles = filesArray.filter(file => 
      file.type.startsWith('image/')
    );
    
    if (kmlFile) {
      setKmlFile(kmlFile);
      console.log(`📄 Found KML file: ${kmlFile.name}`);
    } else {
      setKmlFile(null);
      console.warn('⚠️ No KML file found');
    }
    
    setImageFiles(imageFiles);
    console.log(`🖼️ Found ${imageFiles.length} images`);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleImport = async () => {
    if (!kmlFile) {
      alert('Please select a KML file');
      return;
    }

    setIsImporting(true);
    setImportProgress('Preparing files...');

    try {
      const formData = new FormData();
      formData.append('kmlFile', kmlFile);
      formData.append('userId', user?.uid || '');
      
      imageFiles.forEach(file => {
        formData.append('imageFiles', file);
      });

      setImportProgress('Uploading images to Cloudinary...');

      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      setImportProgress('Processing KML data...');

      const result = await response.json();
      
      setImportStats(result.imageUploadStats);
      setImportProgress('Import completed successfully!');

      // Don't add markers again - they're already in Supabase from the import
      // Just reload the page to fetch the fresh data
      console.log(`✅ Import successful: ${result.folders.length} folders, ${result.markers.length} markers`);

      // Reset form and reload after successful import
      setTimeout(() => {
        handleClose();
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Import error:', error);
      alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setSelectedFolder(null);
    setKmlFile(null);
    setImageFiles([]);
    setImportProgress('');
    setImportStats(null);
    setIsImporting(false);
    onClose();
  };

  const removeImageFile = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Import KML with Images</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            disabled={isImporting}
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <h3 className="text-blue-300 font-medium mb-2">How to import:</h3>
            <ol className="text-blue-200 text-sm space-y-1 list-decimal list-inside">
              <li>Select a folder that contains your KML file and an "images" subfolder</li>
              <li>The KML file should be in the root of the folder</li>
              <li>All images should be in the "images" subfolder</li>
              <li>Images will be uploaded to Cloudinary and linked to markers</li>
              <li>Folders and markers will be imported to your map</li>
            </ol>
            <div className="mt-3 p-2 bg-blue-800/30 rounded text-xs">
              <strong>Expected structure:</strong><br/>
              📁 Your Folder/<br/>
              &nbsp;&nbsp;📄 data.kml<br/>
              &nbsp;&nbsp;📁 images/<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;🖼️ image1.jpg<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;🖼️ image2.png
            </div>
          </div>

          {/* Folder Selection */}
          <div className="space-y-4">
            {/* Folder Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Folder
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                  disabled={isImporting}
                >
                  <Upload size={16} />
                  {selectedFolder ? 'Change Folder' : 'Select Folder'}
                </button>
                {selectedFolder && (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle size={16} />
                    <span className="text-sm">Folder Selected</span>
                  </div>
                )}
              </div>
              <input
                ref={folderInputRef}
                type="file"
                {...({ webkitdirectory: "true", directory: "true" } as any)}
                onChange={handleFolderSelect}
                className="hidden"
              />
            </div>

            {/* Status Display */}
            {selectedFolder && (
              <div className="bg-gray-700 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  {kmlFile ? (
                    <CheckCircle size={16} className="text-green-400" />
                  ) : (
                    <AlertCircle size={16} className="text-red-400" />
                  )}
                  <span className="text-sm text-gray-300">
                    KML File: {kmlFile ? kmlFile.name : 'Not found'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-400" />
                  <span className="text-sm text-gray-300">
                    Images: {imageFiles.length} files found
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Drag and Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver
                ? 'border-blue-500 bg-blue-50/10'
                : 'border-gray-600 hover:border-gray-500'
            } ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload size={32} className="mx-auto text-gray-400 mb-2" />
            <p className="text-gray-300 text-sm">
              Or drag and drop your folder here
            </p>
          </div>

          {/* Selected Images Preview */}
          {imageFiles.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">Selected Images:</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                {imageFiles.map((file, index) => (
                  <div key={index} className="relative group">
                    <div className="bg-gray-700 rounded p-2 text-xs text-gray-300 truncate">
                      {file.name}
                    </div>
                    <button
                      onClick={() => removeImageFile(index)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={isImporting}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import Progress */}
          {isImporting && (
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span className="text-white text-sm">{importProgress}</span>
              </div>
            </div>
          )}

          {/* Import Stats */}
          {importStats && (
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} className="text-green-400" />
                <span className="text-green-300 font-medium">Import Complete!</span>
              </div>
              <div className="text-green-200 text-sm">
                <p>Images uploaded: {importStats.uploaded} / {importStats.total}</p>
                {importStats.failed > 0 && (
                  <p className="text-yellow-300">Failed uploads: {importStats.failed}</p>
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
            disabled={isImporting}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            disabled={!selectedFolder || !kmlFile || isImporting}
          >
            <Upload size={16} />
            {isImporting ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
