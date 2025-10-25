'use client';

import React, { useState, useRef } from 'react';
import { useMapStore } from '../store/mapStore';
import { Folder, Marker } from '../lib/db';
import { KMLParser } from '../lib/kml-parser';
import { db } from '../lib/db';
import { useAuthContext } from './AuthProvider';
import { 
  Menu, 
  X, 
  Folder as FolderIcon, 
  Plus, 
  Upload, 
  Eye, 
  EyeOff,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Save,
  Trash2,
  LogIn,
  LogOut,
  User,
  Settings
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, loading, signInWithGoogle, logout } = useAuthContext();
  const {
    folders,
    markers,
    addFolder,
    updateFolder,
    deleteFolder,
    deleteMarker,
    setMarkers,
    setFolders,
    setSelectedMarker,
    isImporting,
    setIsImporting,
    importProgress,
    setImportProgress,
    selectedFolderId,
    setSelectedFolderId,
  } = useMapStore();

  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editFolderColor, setEditFolderColor] = useState('#ffffff');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFolderEdit = (folder: Folder) => {
    setEditingFolder(folder);
    setEditFolderName(folder.name);
    setEditFolderColor(folder.color);
  };

  const handleFolderSave = () => {
    if (editingFolder && editFolderName.trim()) {
      const updates = {
        name: editFolderName.trim(),
        color: editFolderColor,
        updatedAt: new Date(),
      };
      
      updateFolder(editingFolder.id, updates);
      setEditingFolder(null);
      setEditFolderName('');
      setEditFolderColor('#ffffff');
    }
  };

  const handleFolderEditCancel = () => {
    setEditingFolder(null);
    setEditFolderName('');
    setEditFolderColor('#ffffff');
  };

  const handleClearAllData = async () => {
    const totalMarkers = markers.length;
    const totalFolders = folders.filter(f => f.name !== 'Default').length;
    
    if (totalMarkers === 0 && totalFolders === 0) {
      alert('No data to clear.');
      return;
    }
    
    const message = `Are you sure you want to delete ALL data?\n\nThis will remove:\n- ${totalMarkers} marker(s)\n- ${totalFolders} folder(s)\n\nThis action cannot be undone.`;
    
    if (confirm(message)) {
      try {
        if (user) {
          // User is logged in - clear from Supabase
          console.log('🧹 CLEAR ALL - User logged in, clearing from Supabase');
          
          // Delete all markers from Supabase
          const markersResponse = await fetch(`/api/sync/markers?userId=${user.uid}`, {
            method: 'DELETE',
          });
          
          if (!markersResponse.ok) {
            throw new Error('Failed to delete markers from Supabase');
          }
          
          // Delete all folders from Supabase (except default)
          const foldersResponse = await fetch(`/api/sync/folders?userId=${user.uid}`, {
            method: 'DELETE',
          });
          
          if (!foldersResponse.ok) {
            throw new Error('Failed to delete folders from Supabase');
          }
          
          console.log('✅ CLEAR ALL - Supabase cleared successfully');
        } else {
          // User is logged out - clear from IndexedDB
          console.log('🧹 CLEAR ALL - User logged out, clearing from IndexedDB');
          
          // Clear all markers from IndexedDB
          await db.markers.clear();
          
          // Clear all folders except default from IndexedDB
          const defaultFolder = folders.find(f => f.name === 'Default');
          if (defaultFolder) {
            await db.folders.clear();
            await db.folders.add(defaultFolder);
          } else {
            await db.folders.clear();
            // Create default folder if it doesn't exist
            const newDefaultFolder: Folder = {
              id: Date.now().toString(36) + Math.random().toString(36).substr(2),
              name: 'Default',
              color: '#ffffff',
              icon: 'folder',
              visible: true,
              order: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            await db.folders.add(newDefaultFolder);
          }
        }
        
        // Clear store state
        setMarkers([]);
        
        // Keep only the default folder
        const defaultFolder = folders.find(f => f.name === 'Default');
        if (defaultFolder) {
          setFolders([defaultFolder]);
        } else {
          // Create default folder if it doesn't exist
          const newDefaultFolder: Folder = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            name: 'Default',
            color: '#ffffff',
            icon: 'folder',
            visible: true,
            order: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          setFolders([newDefaultFolder]);
        }
        
        // Clear selected states
        setSelectedMarker(null);
        setSelectedFolderId(null);
        
        alert('All data has been cleared!');
        
      } catch (error) {
        console.error('Failed to clear all data:', error);
        alert('Failed to clear all data. Please try again.');
      }
    }
  };

  const handleFolderDelete = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    const isDefaultFolder = folder?.name === 'Default';
    
    if (isDefaultFolder) {
      // For default folder, only delete markers
      const markersInFolder = markers.filter(m => m.folderId === folderId);
      if (markersInFolder.length === 0) {
        alert('No markers to delete in this folder.');
        return;
      }
      
      if (confirm(`Are you sure you want to delete all ${markersInFolder.length} marker(s) in the Default folder?`)) {
        markersInFolder.forEach(marker => deleteMarker(marker.id));
      }
    } else {
      // For other folders, delete the folder and all markers
      if (confirm('Are you sure you want to delete this folder? This will also delete all markers in this folder.')) {
        deleteFolder(folderId);
      }
    }
  };

  const handleAddFolder = () => {
    if (newFolderName.trim()) {
      const newFolder: Folder = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        name: newFolderName.trim(),
        color: '#ffffff',
        icon: 'folder',
        visible: true,
        order: folders.length,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addFolder(newFolder);
      setNewFolderName('');
      setShowAddFolder(false);
    }
  };

  const handleFolderToggle = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (folder) {
      updateFolder(folderId, { visible: !folder.visible });
    }
  };

  const handleFolderSelect = (folderId: string) => {
    setSelectedFolderId(folderId);
  };

  const handleSignIn = () => {
    console.log('🔐 SIDEBAR SIGN-IN DEBUG:');
    console.log('- User context:', user);
    console.log('- Loading state:', loading);
    console.log('- SessionStorage before:', sessionStorage.getItem('authUser'));
    console.log('- Calling signInWithGoogle...');
    signInWithGoogle();
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Sign out failed:', error);
      alert('Failed to sign out. Please try again.');
    }
  };

  const handleFolderExpand = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);

    try {
      // Simulate progress
      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        currentProgress += 10;
        if (currentProgress >= 90) {
          clearInterval(progressInterval);
          setImportProgress(90);
        } else {
          setImportProgress(currentProgress);
        }
      }, 200);

      // Handle folder upload - look for KML and images recursively
      const allFiles = Array.from(files);
      const kmlFile = allFiles.find(file => file.name.toLowerCase().endsWith('.kml'));
      const imageFiles = allFiles.filter(file => 
        file.type.startsWith('image/') && 
        (file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg'))
      );

      if (!kmlFile) {
        alert('No KML file found in the selected folder. Please make sure your export folder contains a .kml file.');
        setIsImporting(false);
        setImportProgress(0);
        return;
      }

      console.log(`Found KML file: ${kmlFile.name}`);
      console.log(`Found ${imageFiles.length} image files`);
      console.log('Image files:', imageFiles.map(f => f.name));

      const parsedData = await KMLParser.parseKMLWithImages(kmlFile, imageFiles.length > 0 ? imageFiles as any : undefined);
      
      console.log('Parsed data:', {
        folders: parsedData.folders.length,
        markers: parsedData.markers.length,
        markersWithImages: parsedData.markers.filter(m => m.images && m.images.length > 0).length
      });
      
      // Log first few markers to check colors and images
      parsedData.markers.slice(0, 3).forEach((marker, i) => {
        console.log(`Marker ${i + 1}:`, {
          title: marker.title,
          color: marker.color,
          images: marker.images?.length || 0
        });
      });
      
      // Add folders to database
      for (const folder of parsedData.folders) {
        // Add userId to imported folders
        const folderWithUser = { ...folder, userId: user?.uid || undefined };
        addFolder(folderWithUser);
      }
      
      // Add markers to database
      for (const marker of parsedData.markers) {
        // Add userId to imported markers
        const markerWithUser = { ...marker, userId: user?.uid || undefined };
        // Add marker to store
        useMapStore.getState().addMarker(markerWithUser);
      }

      setImportProgress(100);
      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(0);
        alert(`Import successful! Added ${parsedData.folders.length} folders and ${parsedData.markers.length} markers. Images were skipped to prevent memory issues.`);
      }, 500);

    } catch (error) {
      console.error('Import failed:', error);
      
      // Check if it's a memory error
      if (error instanceof Error && error.message.includes('memory')) {
        alert('Import failed due to insufficient memory. Try importing with fewer images or restart your browser.');
      } else {
        alert('Failed to import KML file. Please check the file format and try again.');
      }
      
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const getMarkerCount = (folderId: string): number => {
    return markers.filter(marker => marker.folderId === folderId).length;
  };

  const getChildFolders = (parentId?: string): Folder[] => {
    return folders.filter(folder => folder.parentId === parentId);
  };

  const renderFolder = (folder: Folder, level: number = 0) => {
    const hasChildren = getChildFolders(folder.id).length > 0;
    const isExpanded = expandedFolders.has(folder.id);
    const markerCount = getMarkerCount(folder.id);
    const isSelected = selectedFolderId === folder.id;

    return (
      <div key={folder.id} className="select-none">
        <div
          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
            isSelected 
              ? 'bg-blue-600/20 border border-blue-500/30' 
              : 'hover:bg-gray-700/50'
          } ${level > 0 ? 'ml-4' : ''}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => handleFolderSelect(folder.id)}
        >
          <div className="flex items-center gap-2 flex-1">
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFolderExpand(folder.id);
                }}
                className="p-1 hover:bg-gray-600 rounded"
              >
                {isExpanded ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
              </button>
            )}
            <FolderIcon size={16} style={{ color: folder.color }} />
            <span className={`text-sm font-medium ${isSelected ? 'text-blue-300' : ''}`}>
              {folder.name}
            </span>
            <span className="text-xs text-gray-400">({markerCount})</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleFolderEdit(folder);
              }}
              className="p-1 hover:bg-gray-600 rounded"
              title="Edit folder"
            >
              <MoreHorizontal size={14} className="text-gray-400" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleFolderDelete(folder.id);
              }}
              className="p-1 hover:bg-gray-600 rounded"
              title={folder.name === 'Default' ? 'Delete all markers in folder' : 'Delete folder'}
            >
              <Trash2 size={14} className="text-gray-400 hover:text-red-400" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleFolderToggle(folder.id);
              }}
              className="p-1 hover:bg-gray-600 rounded"
            >
              {folder.visible ? (
                <Eye size={14} className="text-green-400" />
              ) : (
                <EyeOff size={14} className="text-gray-400" />
              )}
            </button>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {getChildFolders(folder.id).map(childFolder => 
              renderFolder(childFolder, level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-gray-900 text-white z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:z-auto`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold">MarkerMap</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings size={18} />
              </button>
              <button
                onClick={onClose}
                className="lg:hidden p-2 hover:bg-gray-700 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Authentication Section */}
          <div className="p-4 border-b border-gray-700">
            {loading ? (
              <div className="flex items-center gap-2 text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span className="text-sm">Loading...</span>
              </div>
            ) : user ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-white">
                    {user.displayName || 'User'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {user.email}
                  </p>
                  <p className="text-xs text-green-400">✓ Signed in</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 bg-gray-800 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                >
                  <LogOut size={12} />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">
                  Sign in to sync your data across devices
                </p>
                <button
                  onClick={handleSignIn}
                  className="w-full flex items-center gap-2 p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm"
                >
                  <LogIn size={16} />
                  Sign in with Google
                </button>
                <p className="text-xs text-gray-500">
                  You will be redirected to Google for sign-in
                </p>
              </div>
            )}
          </div>


          {/* Folders Section */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-300">Folders</h3>
              <button
                onClick={() => setShowAddFolder(true)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Add Folder Form */}
            {showAddFolder && (
              <div className="mb-4 p-3 bg-gray-800 rounded-lg">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleAddFolder}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddFolder(false);
                      setNewFolderName('');
                    }}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Folders List */}
            <div className="space-y-1">
              {getChildFolders().map(folder => renderFolder(folder))}
            </div>
          </div>
        </div>
      </div>

      {/* Folder Edit Modal */}
      {editingFolder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">Edit Folder</h2>
              <button onClick={handleFolderEditCancel} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={editFolderName}
                  onChange={(e) => setEditFolderName(e.target.value)}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Enter folder name..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Default Marker Color
                </label>
                <input
                  type="color"
                  value={editFolderColor}
                  onChange={(e) => setEditFolderColor(e.target.value)}
                  className="w-full p-1 bg-gray-700 border border-gray-600 rounded-lg h-12"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 p-4 border-t border-gray-700">
              <button
                onClick={handleFolderEditCancel}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFolderSave}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Save size={16} />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96 max-w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Settings</h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Import Section */}
              <div>
                <h4 className="text-md font-medium text-white mb-2">Import Data</h4>
                <p className="text-sm text-gray-400 mb-4">
                  Select your entire export folder (e.g., export_2025_10_22-17_20_50). 
                  The app will automatically find the KML file and all images inside.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="w-full flex items-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg transition-colors"
                >
                  <Upload size={16} />
                  {isImporting ? 'Importing...' : 'Import Export Folder'}
                </button>
                
                {isImporting && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${importProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{importProgress}%</p>
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  {...({ webkitdirectory: "true", directory: "true" } as any)}
                  accept=".kml,.jpg,.jpeg"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Clear All Data Section */}
              <div>
                <h4 className="text-md font-medium text-white mb-2">Danger Zone</h4>
                <button
                  onClick={handleClearAllData}
                  className="w-full flex items-center gap-2 p-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                  Clear All Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
