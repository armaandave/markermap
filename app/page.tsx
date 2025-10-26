'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMapStore } from '../store/mapStore';
import { db, Marker, Folder, getUserFolders, getUserMarkers } from '../lib/db';
import { useAuthContext } from '../components/AuthProvider';
import Sidebar from '../components/Sidebar';
import MarkerEditModal from '../components/MarkerEditModal';
import ImportModal from '../components/ImportModal';
import { deleteCloudinaryImages } from '../lib/cloudinary-utils';
import { Menu, MapPin, Edit, Trash2, Upload, X, ChevronsRight } from 'lucide-react';

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
  const { user, loading: authLoading } = useAuthContext();
  // We're in a 'use client' component, so we're always on the client side
  const [isClient] = useState(true);
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
    user: storeUser,
    setUser,
    loadFromCloud,
  } = useMapStore();

  const [isLoaded, setIsLoaded] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const previewRef = React.useRef<HTMLDivElement>(null);

  // Sync preview height to images
  useEffect(() => {
    if (previewRef.current && selectedMarker) {
      const updateHeight = () => {
        const height = previewRef.current?.offsetHeight;
        if (height) {
          document.documentElement.style.setProperty('--preview-height', `${height}px`);
        }
      };
      
      // Update immediately and on resize
      updateHeight();
      const observer = new ResizeObserver(updateHeight);
      observer.observe(previewRef.current);
      
      return () => observer.disconnect();
    }
  }, [selectedMarker]);

  // Sync user state from auth context to store
  useEffect(() => {
    setUser(user);
  }, [user, setUser]);

  // Load data based on authentication state
  useEffect(() => {
    console.log('🔍 DATA LOAD - Starting... User:', user ? user.uid : 'null', 'AuthLoading:', authLoading);
    
    // Don't load data until authentication is finished
    if (authLoading) {
      return;
    }
    
    // Don't load data until user state is synced to store
    if (user && !storeUser) {
      return;
    }
    
    const loadData = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        const currentUser = storeUser || user;
        console.log('🔍 DATA LOAD - User:', currentUser ? currentUser.uid : 'null');
        
        if (currentUser) {
          // User signed in - load from Supabase
          try {
            await loadFromCloud();
            console.log('🔍 DATA LOAD - Cloud load successful');
          } catch {
            console.log('🔍 DATA LOAD - Cloud failed, using local fallback');
            const [loadedFolders, loadedMarkers] = await Promise.all([
              getUserFolders(currentUser.uid),
              getUserMarkers(currentUser.uid),
            ]);
            setFolders(loadedFolders);
            setMarkers(loadedMarkers);
          }
        } else {
          // User signed out - load local data
          const [loadedFolders, loadedMarkers] = await Promise.all([
            getUserFolders(null),
            getUserMarkers(null),
          ]);
          
          if (loadedFolders.length === 0) {
            const defaultFolder: Folder = {
              id: 'default-folder-local',
              name: 'Default',
              color: '#ffffff',
              icon: 'folder',
              visible: true,
              order: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
              userId: undefined,
            };
            
            const existingDefault = await db.folders.where('id').equals('default-folder-local').first();
            if (!existingDefault) {
              await db.folders.add(defaultFolder);
            }
            loadedFolders.push(defaultFolder);
          }
          
          setFolders(loadedFolders);
          setMarkers(loadedMarkers);
        }
        
        // Folder selection will be handled by the store's useEffect
        
        console.log('🔍 DATA LOAD - Complete, setting isLoaded');
        setIsLoaded(true);
      } catch {
        console.log('🔍 DATA LOAD - Error, using fallback');
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
        
        setFolders([defaultFolder]);
        setMarkers([]);
        setSelectedFolderId(defaultFolder.id);
        setIsLoaded(true);
      }
      
      // GUARANTEED: Always set isLoaded to true
      setIsLoaded(true);
    };

    // Add a maximum timeout to ensure the app loads no matter what
    const maxTimeout = setTimeout(() => {
      if (!isLoaded) {
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
        
        setFolders([defaultFolder]);
        setMarkers([]);
        setSelectedFolderId(defaultFolder.id);
        setIsLoaded(true);
        console.log('🔍 DATA LOAD - TIMEOUT FORCE: App loaded with fallback');
      }
    }, 3000);

        loadData().finally(() => {
          clearTimeout(maxTimeout);
        });
      }, [user, authLoading, storeUser, isLoaded, loadFromCloud, setFolders, setMarkers, setSelectedFolderId]);

  // Note: Data saving is now handled by individual store functions (addMarker, updateMarker, etc.)
  // which save with the correct userId context. No bulk save needed.

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
      userId: user?.uid || undefined,
    };

    addMarker(newMarker);
    setSelectedMarker(newMarker);
  };

  const handleSaveMarker = (updatedMarker: Marker) => {
    updateMarker(updatedMarker.id, updatedMarker);
    setSelectedMarker(updatedMarker);
  };


  const handleDeleteMarker = async () => {
    if (selectedMarker) {
      // Delete associated Cloudinary images first
      if (selectedMarker.images && selectedMarker.images.length > 0) {
        console.log(`🗑️ Deleting ${selectedMarker.images.length} images for marker: ${selectedMarker.title}`);
        
        const deletionResult = await deleteCloudinaryImages(selectedMarker.images);
        
        if (deletionResult.success) {
          console.log(`✅ Successfully deleted ${deletionResult.deleted} images from Cloudinary`);
          if (deletionResult.errors > 0) {
            console.warn(`⚠️ Failed to delete ${deletionResult.errors} images:`, deletionResult.errorDetails);
          }
        } else {
          console.error(`❌ Failed to delete images:`, deletionResult.errorDetails);
          // Still proceed with marker deletion even if image deletion fails
        }
      }

      // Delete the marker from the database
      deleteMarker(selectedMarker.id);
      setSelectedMarker(null);
    }
  };

  const handleImportComplete = (importedFolders: Folder[], importedMarkers: Marker[]) => {
    // Add imported folders that don't already exist
    const newFolders = importedFolders.filter(folder => 
      !folders.find(f => f.name === folder.name)
    );
    
    if (newFolders.length > 0) {
      setFolders([...folders, ...newFolders]);
    }

    // Add imported markers
    importedMarkers.forEach(marker => {
      addMarker(marker);
    });

    console.log(`✅ Import complete: ${importedFolders.length} folders, ${importedMarkers.length} markers`);
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

  // Don't render until we're on the client side to prevent hydration mismatch
  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex bg-gray-900 overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Collapsed Sidebar Button - Desktop only */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="hidden lg:block fixed top-4 left-4 z-50 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg shadow-lg transition-colors"
          title="Open sidebar"
        >
          <ChevronsRight className="w-5 h-5 text-white" />
        </button>
      )}

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
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              title="Import KML with Images"
            >
              <Upload size={14} />
              Import
            </button>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <MapPin size={16} />
              <span>{markers.length} markers</span>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative min-h-0">
          <MapboxMap onAddMarker={handleAddMarker} />
          
        {/* Selected Marker Info */}
        {selectedMarker && (
          <>
            {/* Preview Box - Natural height */}
            <div ref={previewRef} className="absolute bottom-4 left-4 lg:w-80 bg-gray-800 rounded-lg p-4 shadow-lg z-10 max-h-[calc(100vh-8rem)] overflow-y-auto">
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
                <p className="text-sm text-gray-300 mb-2 whitespace-pre-wrap">{selectedMarker.description}</p>
              )}
              <div className="text-xs text-gray-400">
                <p>Folder: {folders.find(f => f.id === selectedMarker.folderId)?.name || 'Unknown'}</p>
                <p>Lat: {selectedMarker.latitude.toFixed(6)}</p>
                <p>Lng: {selectedMarker.longitude.toFixed(6)}</p>
                <p>Created: {new Date(selectedMarker.createdAt).toLocaleDateString()}</p>
                {selectedMarker.customFields && Object.keys(selectedMarker.customFields).length > 0 && (
                  <p className="mt-2 text-blue-300">+ {Object.keys(selectedMarker.customFields).length} custom fields</p>
                )}
              </div>
            </div>

            {/* Images - Separate, positioned to match preview height with JS */}
            {selectedMarker.images && selectedMarker.images.length > 0 && (
              <div 
                className="absolute bottom-4 left-[calc(1rem+20rem+0.5rem)] hidden lg:flex gap-2 z-10"
                style={{ height: 'var(--preview-height, auto)' }}
              >
                {selectedMarker.images.slice(0, 5).map((imageUrl, index) => (
                  <img
                    key={index}
                    src={imageUrl}
                    alt={`${selectedMarker.title} - Image ${index + 1}`}
                    className="h-full w-auto object-cover rounded cursor-pointer hover:opacity-80 transition-opacity border border-gray-600 shadow-lg bg-gray-800"
                    onClick={() => setFullscreenImage(imageUrl)}
                  />
                ))}
                {selectedMarker.images.length > 5 && (
                  <div className="h-full flex items-center justify-center bg-gray-800 rounded px-4 border border-gray-600 shadow-lg">
                    <span className="text-sm text-gray-400">+{selectedMarker.images.length - 5}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

          {/* Marker Edit Modal */}
          <MarkerEditModal
            marker={selectedMarker}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSave={handleSaveMarker}
            folders={folders}
          />

          {/* Import Modal */}
          <ImportModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onImportComplete={handleImportComplete}
          />

          {/* Fullscreen Image Modal */}
          {fullscreenImage && (
            <div 
              className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4"
              onClick={() => setFullscreenImage(null)}
            >
              <button
                onClick={() => setFullscreenImage(null)}
                className="absolute top-4 right-4 bg-gray-800 hover:bg-gray-700 text-white rounded-full w-12 h-12 flex items-center justify-center transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={fullscreenImage}
                alt="Fullscreen view"
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
