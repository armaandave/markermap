'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMapStore } from '../store/mapStore';
import { db, Marker, Folder } from '../lib/db';
import Sidebar from '../components/Sidebar';
import MarkerEditModal from '../components/MarkerEditModal';
import { Menu, MapPin, Edit, Trash2 } from 'lucide-react';

// Dynamically import MapboxMap to avoid SSR issues
const MapboxMap = dynamic(() => import('../components/MapboxMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading map...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const {
    sidebarOpen,
    setSidebarOpen,
    markers,
    folders,
    setMarkers,
    setFolders,
    addMarker,
    updateMarker,
    deleteMarker,
    selectedMarker,
    setSelectedMarker,
    selectedFolderId,
    setSelectedFolderId,
  } = useMapStore();

  const [isLoaded, setIsLoaded] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Load data from IndexedDB on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedFolders, loadedMarkers] = await Promise.all([
          db.folders.toArray(),
          db.markers.toArray(),
        ]);
        
        // Create default folder if none exist
        if (loadedFolders.length === 0) {
          const defaultFolder: Folder = {
            id: 'default-folder',
            name: 'Default',
            color: '#ffffff',
            icon: 'folder',
            visible: true,
            order: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await db.folders.add(defaultFolder);
          loadedFolders.push(defaultFolder);
        }
        
        setFolders(loadedFolders);
        setMarkers(loadedMarkers);
        
        // Set default folder as selected if none is selected
        if (!selectedFolderId && loadedFolders.length > 0) {
          setSelectedFolderId(loadedFolders[0].id);
        }
        
        setIsLoaded(true);
      } catch (error) {
        console.error('Failed to load data:', error);
        setIsLoaded(true);
      }
    };

    loadData();
  }, [setFolders, setMarkers]);

  // Save data to IndexedDB when state changes
  useEffect(() => {
    if (!isLoaded) return;

    const saveData = async () => {
      try {
        await db.transaction('rw', [db.folders, db.markers], async () => {
          // Clear existing data
          await db.folders.clear();
          await db.markers.clear();
          
          // Save new data
          await db.folders.bulkAdd(folders);
          await db.markers.bulkAdd(markers);
        });
      } catch (error) {
        console.error('Failed to save data:', error);
      }
    };

    saveData();
  }, [folders, markers, isLoaded]);

  const handleAddMarker = async (lngLat: { lng: number; lat: number }) => {
    const targetFolderId = selectedFolderId || folders[0]?.id || '';
    const targetFolder = folders.find(f => f.id === targetFolderId);
    
    const newMarker: Marker = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      folderId: targetFolderId,
      title: 'New Marker',
      description: '',
      latitude: lngLat.lat,
      longitude: lngLat.lng,
      color: targetFolder?.color || '#ffffff',
      customFields: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    addMarker(newMarker);
    setSelectedMarker(newMarker);
  };

  const handleSaveMarker = (updatedMarker: Marker) => {
    updateMarker(updatedMarker.id, updatedMarker);
    setSelectedMarker(updatedMarker);
  };

  const handleDeleteMarker = () => {
    if (selectedMarker) {
      deleteMarker(selectedMarker.id);
      setSelectedMarker(null);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading MarkerMap...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex bg-gray-900 overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 lg:hidden flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-gray-700 rounded-lg"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-lg font-semibold">MarkerMap</h1>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <MapPin size={16} />
            <span>{markers.length} markers</span>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative min-h-0">
          <MapboxMap onAddMarker={handleAddMarker} />
          
        {/* Selected Marker Info */}
        {selectedMarker && (
          <div className="absolute bottom-4 left-4 right-4 lg:right-auto lg:w-80 bg-gray-800 rounded-lg p-4 shadow-lg z-10">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-white">{selectedMarker.title}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                  title="Edit marker"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={handleDeleteMarker}
                  className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                  title="Delete marker"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  onClick={() => setSelectedMarker(null)}
                  className="text-gray-400 hover:text-white"
                >
                  ×
                </button>
              </div>
            </div>
            {selectedMarker.description && (
              <p className="text-sm text-gray-300 mb-2">{selectedMarker.description}</p>
            )}
            <div className="text-xs text-gray-400">
              <p>Folder: {folders.find(f => f.id === selectedMarker.folderId)?.name || 'Unknown'}</p>
              <p>Lat: {selectedMarker.latitude.toFixed(6)}</p>
              <p>Lng: {selectedMarker.longitude.toFixed(6)}</p>
              <p>Created: {selectedMarker.createdAt.toLocaleDateString()}</p>
              {selectedMarker.customFields && Object.keys(selectedMarker.customFields).length > 0 && (
                <p className="mt-2 text-blue-300">+ {Object.keys(selectedMarker.customFields).length} custom fields</p>
              )}
            </div>
          </div>
        )}

          {/* Marker Edit Modal */}
          <MarkerEditModal
            marker={selectedMarker}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSave={handleSaveMarker}
            folders={folders}
          />
        </div>
      </div>
    </div>
  );
}
