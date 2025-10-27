'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useMapStore } from '../store/mapStore';
import { Folder, Marker, Tag } from '../lib/db';
import { KMLParser } from '../lib/kml-parser';
import { db } from '../lib/db';
import { useAuthContext } from './AuthProvider';
import ImportModal from './ImportModal';
import UpdateDatesModal from './UpdateDatesModal';
import { 
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
  Settings,
  ChevronsLeft,
  Clock,
  Tag as TagIcon
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
    selectedFolderId,
    setSelectedFolderId,
    tagVisibility,
    setTagVisibility: setStoreTagVisibility,
    filterMode,
    setFilterMode: setStoreFilterMode,
  } = useMapStore();

  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editFolderColor, setEditFolderColor] = useState('#ffffff');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isUpdateDatesModalOpen, setIsUpdateDatesModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('preferences');
  const [favoriteColors, setFavoriteColors] = useState<string[]>([]);
  const [newColorInput, setNewColorInput] = useState('');
  const [selectedColorPicker, setSelectedColorPicker] = useState('#000000');
  const [defaultMapStyle, setDefaultMapStyle] = useState('mapbox://styles/mapbox/dark-v11');
  const [isMapStyleDropdownOpen, setIsMapStyleDropdownOpen] = useState(false);
  const [isFilterModeDropdownOpen, setIsFilterModeDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import map styles for the dropdown
  const mapStyles = [
    { id: 'mapbox://styles/mapbox/dark-v11', name: 'Dark' },
    { id: 'mapbox://styles/mapbox/light-v11', name: 'Light' },
    { id: 'mapbox://styles/mapbox/streets-v12', name: 'Streets' },
    { id: 'mapbox://styles/mapbox/satellite-v9', name: 'Satellite' },
    { id: 'mapbox://styles/mapbox/outdoors-v12', name: 'Outdoors' },
    { id: 'mapbox://styles/armaandave/cmh7cxmfj001a01qn3blc9mf8', name: 'Custom' },
    { id: 'mapbox://styles/armaandave/cmh7czqwf001b01qn1pat38p6', name: 'Custom 2' },
    { id: 'mapbox://styles/armaandave/cmh7d458f001c01qnd4q5b1e2', name: 'Custom 3' },
  ];

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
    console.log('🔐 Sidebar: handleSignIn called');
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

  const handleImportComplete = (importedFolders: Folder[], importedMarkers: Marker[]) => {
    // Add imported folders
    importedFolders.forEach(folder => {
      // Check if folder already exists (by name)
      const existingFolder = folders.find(f => f.name === folder.name);
      if (!existingFolder) {
        addFolder(folder);
      }
    });

    // Add imported markers
    importedMarkers.forEach(marker => {
      useMapStore.getState().addMarker(marker);
    });

    console.log(`✅ Import complete: ${importedFolders.length} folders, ${importedMarkers.length} markers`);
  };

  const handleCleanupOrphanedImages = async () => {
    if (!confirm('This will delete all images from Cloudinary that are not currently used by any markers. This action cannot be undone. Continue?')) {
      return;
    }

    try {
      // Get all image URLs currently used by markers
      const usedImageUrls = new Set<string>();
      markers.forEach(marker => {
        if (marker.images) {
          marker.images.forEach(url => usedImageUrls.add(url));
        }
      });

      console.log(`📊 Found ${usedImageUrls.size} images currently in use by markers`);

      // Note: This is a simplified cleanup. In a real scenario, you'd need to:
      // 1. List all images from Cloudinary API
      // 2. Compare with used images
      // 3. Delete orphaned ones
      
      alert(`Cleanup completed. Currently ${usedImageUrls.size} images are in use by your markers. For a complete cleanup, you would need to compare with all images in your Cloudinary account.`);
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      alert('Cleanup failed. Please try again.');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {

      // Handle folder upload - look for KML and images recursively
      const allFiles = Array.from(files);
      const kmlFile = allFiles.find(file => file.name.toLowerCase().endsWith('.kml'));
      const imageFiles = allFiles.filter(file => 
        file.type.startsWith('image/') && 
        (file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg'))
      );

      if (!kmlFile) {
        alert('No KML file found in the selected folder. Please make sure your export folder contains a .kml file.');
        return;
      }

      console.log(`Found KML file: ${kmlFile.name}`);
      console.log(`Found ${imageFiles.length} image files`);
      console.log('Image files:', imageFiles.map(f => f.name));

      const parsedData = await KMLParser.parseKMLWithImages(kmlFile, imageFiles);
      
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

      alert(`Import successful! Added ${parsedData.folders.length} folders and ${parsedData.markers.length} markers. Images were skipped to prevent memory issues.`);

    } catch (error) {
      console.error('Import failed:', error);
      
      // Check if it's a memory error
      if (error instanceof Error && error.message.includes('memory')) {
        alert('Import failed due to insufficient memory. Try importing with fewer images or restart your browser.');
      } else {
        alert('Failed to import KML file. Please check the file format and try again.');
      }
    }
  };

  const getMarkerCount = (folderId: string): number => {
    return markers.filter(marker => marker.folderId === folderId).length;
  };

  const getChildFolders = (parentId?: string): Folder[] => {
    return folders.filter(folder => folder.parentId === parentId);
  };

  // Get all unique tags from markers, sorted by marker count (descending)
  const getAllTags = (): string[] => {
    const tagCounts = new Map<string, number>();
    
    // Count markers per tag
    markers.forEach(marker => {
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

  // Initialize all tags as visible when markers change
  useEffect(() => {
    const allTags = getAllTags();
    const newVisibility: Record<string, boolean> = {};
    allTags.forEach(tag => {
      // Preserve existing visibility or default to true
      if (tagVisibility[tag] !== undefined) {
        newVisibility[tag] = tagVisibility[tag];
      } else {
        newVisibility[tag] = true;
      }
    });
    setStoreTagVisibility(newVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]); // Only re-run when markers change

  // Toggle folder visibility (all at once)
  const handleToggleAllFolders = () => {
    const allVisible = folders.every(folder => folder.visible !== false);
    const newVisibility = !allVisible;
    
    folders.forEach(folder => {
      updateFolder(folder.id, { visible: newVisibility });
    });
  };

  // Toggle tag visibility
  const handleTagToggle = (tagName: string) => {
    const newVisibility = {
      ...tagVisibility,
      [tagName]: !tagVisibility[tagName],
    };
    setStoreTagVisibility(newVisibility);
  };

  // Toggle all tags visibility
  const handleToggleAllTags = () => {
    const allTags = getAllTags();
    const allCurrentlyVisible = allTags.every(tag => tagVisibility[tag] !== false);
    const newState = !allCurrentlyVisible;
    
    const newVisibility: Record<string, boolean> = {};
    allTags.forEach(tag => {
      newVisibility[tag] = newState;
    });
    setStoreTagVisibility(newVisibility);
  };

  // Check if a tag is visible
  const isTagVisible = (tagName: string): boolean => {
    return tagVisibility[tagName] !== false;
  };

  // Get marker count for a tag
  const getTagMarkerCount = (tagName: string): number => {
    return markers.filter(marker => marker.tags?.includes(tagName)).length;
  };

  // Load favorite colors from Supabase or localStorage
  useEffect(() => {
    const loadFavoriteColors = async () => {
      if (user) {
        // User is signed in - load from Supabase
        try {
          const response = await fetch(`/api/preferences?userId=${user.uid}`);
          if (response.ok) {
            const { favoriteColors, defaultMapStyle } = await response.json();
            setFavoriteColors(favoriteColors || []);
            if (defaultMapStyle) {
              setDefaultMapStyle(defaultMapStyle);
            }
            console.log('✅ Loaded preferences from Supabase:', { favoriteColors, defaultMapStyle });
          } else {
            const errorText = await response.text();
            console.error('Failed to load favorite colors from Supabase:', response.status, errorText);
            // Fall back to localStorage
            const saved = localStorage.getItem('favoriteColors');
            if (saved) {
              try {
                setFavoriteColors(JSON.parse(saved));
              } catch {
                setFavoriteColors([]);
              }
            }
          }
        } catch (error) {
          console.error('Error loading favorite colors:', error);
          // Fall back to localStorage
          const saved = localStorage.getItem('favoriteColors');
          if (saved) {
            try {
              setFavoriteColors(JSON.parse(saved));
            } catch {
              setFavoriteColors([]);
            }
          }
        }
      } else {
        // User is signed out - load from localStorage
        const saved = localStorage.getItem('favoriteColors');
        if (saved) {
          try {
            setFavoriteColors(JSON.parse(saved));
          } catch {
            setFavoriteColors([]);
          }
        }
      }
    };

    loadFavoriteColors();
  }, [user]);

  // Close map style dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isMapStyleDropdownOpen && !target.closest('.map-style-dropdown')) {
        setIsMapStyleDropdownOpen(false);
      }
      if (isFilterModeDropdownOpen && !target.closest('.filter-mode-dropdown')) {
        setIsFilterModeDropdownOpen(false);
      }
    };

    if (isMapStyleDropdownOpen || isFilterModeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMapStyleDropdownOpen, isFilterModeDropdownOpen]);

  // Save favorite colors to Supabase or localStorage
  const saveFavoriteColors = async (colors: string[]) => {
    console.log('💾 Saving favorite colors:', colors.length, 'colors');
    console.log('👤 User signed in:', !!user, user?.uid);
    
    // Always save to localStorage as a fallback
    localStorage.setItem('favoriteColors', JSON.stringify(colors));
    setFavoriteColors(colors);
    console.log('✅ Saved to localStorage');
    
    // If signed in, also save to Supabase
    if (user) {
      try {
        console.log('🔄 Attempting to save to Supabase...');
        const response = await fetch('/api/preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ favoriteColors: colors, defaultMapStyle, userId: user.uid }),
        });
        
        if (response.ok) {
          console.log('✅ Saved preferences to Supabase');
        } else {
          const errorText = await response.text();
          console.error('❌ Failed to save to Supabase:', response.status, errorText);
        }
      } catch (error) {
        console.error('❌ Error saving to Supabase:', error);
      }
    } else {
      console.log('ℹ️ User not signed in, only saved to localStorage');
    }
  };

  // Save default map style
  const handleSaveDefaultMapStyle = async (style: string) => {
    setDefaultMapStyle(style);
    
    // Always save to localStorage as a fallback
    localStorage.setItem('defaultMapStyle', style);
    
    // If signed in, also save to Supabase
    if (user) {
      try {
        const response = await fetch('/api/preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ favoriteColors, defaultMapStyle: style, userId: user.uid }),
        });
        
        if (response.ok) {
          console.log('✅ Saved default map style to Supabase');
        } else {
          console.error('❌ Failed to save default map style to Supabase');
        }
      } catch (error) {
        console.error('❌ Error saving default map style to Supabase:', error);
      }
    }
  };

  // Add a favorite color
  const handleAddFavoriteColor = async () => {
    const color = newColorInput.trim();
    if (!color) return;

    // Normalize the color to hex format
    let normalizedColor = color;
    
    // Try to convert to hex if it's not already
    if (color.startsWith('#')) {
      normalizedColor = color;
    } else if (color.startsWith('rgb')) {
      // Extract RGB values and convert to hex
      const rgbMatch = color.match(/\d+/g);
      if (rgbMatch && rgbMatch.length >= 3) {
        const r = parseInt(rgbMatch[0]);
        const g = parseInt(rgbMatch[1]);
        const b = parseInt(rgbMatch[2]);
        normalizedColor = `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
      }
    }

    // Validate hex color
    if (!/^#[0-9A-F]{6}$/i.test(normalizedColor)) {
      alert('Please enter a valid color code (hex or rgb format)');
      return;
    }

    // Add to favorites if not already there
    if (!favoriteColors.includes(normalizedColor)) {
      await saveFavoriteColors([...favoriteColors, normalizedColor]);
      setNewColorInput('');
    }
  };

  // Add color from color picker
  const handleAddColorFromPicker = async () => {
    if (!favoriteColors.includes(selectedColorPicker)) {
      await saveFavoriteColors([...favoriteColors, selectedColorPicker]);
    }
  };

  // Remove a favorite color
  const handleRemoveFavoriteColor = async (color: string) => {
    await saveFavoriteColors(favoriteColors.filter(c => c !== color));
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
        className={`fixed top-0 left-0 h-full w-80 bg-gray-900 text-white transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 z-50 lg:static' : '-translate-x-full z-50'
        }`}
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
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                title="Collapse sidebar"
              >
                <ChevronsLeft size={18} />
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


            {/* Filter Mode Selector */}
            <div className="p-4 border-b border-gray-700">
              <div className="relative filter-mode-dropdown">
                <label className="block text-xs font-medium text-gray-400 mb-2">Filter Mode</label>
                <button
                  type="button"
                  onClick={() => setIsFilterModeDropdownOpen(!isFilterModeDropdownOpen)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500 hover:bg-gray-600 transition-colors flex items-center justify-between"
                >
                  <span className="capitalize">{filterMode}</span>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${isFilterModeDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isFilterModeDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                    <button
                      onClick={() => {
                        setStoreFilterMode('folders');
                        setIsFilterModeDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                        filterMode === 'folders'
                          ? 'bg-blue-600/20 text-blue-300'
                          : 'text-white hover:bg-gray-600'
                      }`}
                    >
                      Folders Only
                    </button>
                    <button
                      onClick={() => {
                        setStoreFilterMode('tags');
                        setIsFilterModeDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                        filterMode === 'tags'
                          ? 'bg-blue-600/20 text-blue-300'
                          : 'text-white hover:bg-gray-600'
                      }`}
                    >
                      Tags Only
                    </button>
                    <button
                      onClick={() => {
                        setStoreFilterMode('both');
                        setIsFilterModeDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                        filterMode === 'both'
                          ? 'bg-blue-600/20 text-blue-300'
                          : 'text-white hover:bg-gray-600'
                      }`}
                    >
                      Both
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Folders and Tags Section */}
          <div className="flex-1 overflow-y-auto">
            {/* Folders Section */}
            <div className={`p-4 ${filterMode === 'tags' ? 'opacity-40' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-300">Folders</h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleToggleAllFolders}
                    className="p-1 hover:bg-gray-600 rounded"
                    title="Toggle all folders visibility"
                  >
                    {folders.length > 0 && folders.every(f => f.visible !== false) ? (
                      <Eye size={16} className="text-green-400" />
                    ) : (
                      <EyeOff size={16} className="text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={() => setShowAddFolder(true)}
                    className="p-1 hover:bg-gray-700 rounded"
                  >
                    <Plus size={16} />
                  </button>
                </div>
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

            {/* Tags Section */}
            <div className={`p-4 border-t border-gray-700 ${filterMode === 'folders' ? 'opacity-40' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-300">Tags</h3>
                <button
                  onClick={handleToggleAllTags}
                  className="p-1 hover:bg-gray-600 rounded"
                  title="Toggle all tags visibility"
                >
                  {getAllTags().length > 0 && getAllTags().every(tag => isTagVisible(tag)) ? (
                    <Eye size={16} className="text-green-400" />
                  ) : (
                    <EyeOff size={16} className="text-gray-400" />
                  )}
                </button>
              </div>

              {/* Tags List */}
              <div className="space-y-1">
                {getAllTags().map(tagName => (
                  <div
                    key={tagName}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <TagIcon size={14} className="text-gray-400" />
                      <span className="text-sm text-white">{tagName}</span>
                      <span className="text-xs text-gray-400">({getTagMarkerCount(tagName)})</span>
                    </div>
                    <button
                      onClick={() => handleTagToggle(tagName)}
                      className="p-1 hover:bg-gray-600 rounded"
                      title={isTagVisible(tagName) ? 'Show markers with this tag' : 'Hide markers with this tag'}
                    >
                      {isTagVisible(tagName) ? (
                        <Eye size={14} className="text-green-400" />
                      ) : (
                        <EyeOff size={14} className="text-gray-400" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-[95vw] h-[90vh] max-w-7xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700 flex-shrink-0">
              <h2 className="text-2xl font-semibold text-white">Settings</h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-6 pt-4 border-b border-gray-700 flex-shrink-0">
              <button
                onClick={() => setActiveSettingsTab('preferences')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeSettingsTab === 'preferences'
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Preferences
              </button>
              <button
                onClick={() => setActiveSettingsTab('imports')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeSettingsTab === 'imports'
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Imports
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeSettingsTab === 'imports' && (
                <div className="space-y-6 max-w-4xl">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">Import Data</h3>
                    <p className="text-sm text-gray-400 mb-6">
                      Import markers, folders, and images from KML files. Your data can be imported from Google Maps exports or custom KML files.
                    </p>

                    {/* Import KML with Images Section */}
                    <div className="bg-gray-700/50 rounded-lg p-6 mb-4">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-medium text-white mb-2">Import KML with Images</h4>
                          <p className="text-sm text-gray-400">
                            Select a folder containing your KML file and images. Images will be uploaded to Cloudinary and linked to markers.
                          </p>
                          <div className="mt-3 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                            <p className="text-blue-200 text-xs font-medium mb-2">Expected folder structure:</p>
                            <div className="text-blue-100 text-xs font-mono space-y-1">
                              <div>📁 Your Folder/</div>
                              <div className="ml-4">📄 data.kml</div>
                              <div className="ml-4">🖼️ image1.jpg</div>
                              <div className="ml-4">🖼️ image2.jpg</div>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setIsImportModalOpen(true)}
                          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Upload size={18} />
                          Import KML with Images
                        </button>
                      </div>
                    </div>

                    {/* Update Dates Section */}
                    <div className="bg-gray-700/50 rounded-lg p-6 mb-4">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-medium text-white mb-2">Update Dates from KML</h4>
                          <p className="text-sm text-gray-400">
                            Update creation dates for existing markers based on your original KML file.
                          </p>
                          <div className="mt-3 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                            <p className="text-purple-200 text-xs">
                              This tool will match markers by coordinates and update their creation dates from your original KML file.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setIsUpdateDatesModalOpen(true)}
                          className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Clock size={18} />
                          Update Dates
                        </button>
                      </div>
                    </div>

                    {/* Cleanup Orphaned Images Section */}
                    <div className="bg-gray-700/50 rounded-lg p-6 mb-4">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-medium text-white mb-2">Cleanup Orphaned Images</h4>
                          <p className="text-sm text-gray-400">
                            Remove unused images from Cloudinary that are no longer referenced by any markers.
                          </p>
                          <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                            <p className="text-yellow-200 text-xs">
                              This will scan your Cloudinary account and delete images that aren&apos;t being used by any markers.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleCleanupOrphanedImages}
                          className="flex items-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Trash2 size={18} />
                          Cleanup Images
                        </button>
                      </div>
                    </div>

                    {/* Clear All Data Section */}
                    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-medium text-red-400 mb-2">Clear All Data</h4>
                          <p className="text-sm text-gray-400">
                            Permanently delete all markers, folders, and associated images from your account.
                          </p>
                          <div className="mt-3 p-3 bg-red-800/30 border border-red-500/30 rounded-lg">
                            <p className="text-red-200 text-xs font-medium">
                              ⚠️ Warning: This action cannot be undone. All your data will be permanently deleted.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleClearAllData}
                          className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Trash2 size={18} />
                          Clear All Data
                        </button>
                      </div>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      {...({ webkitdirectory: 'true', directory: 'true' } as React.InputHTMLAttributes<HTMLInputElement>)}
                      accept=".kml,.jpg,.jpeg"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              )}

              {activeSettingsTab === 'preferences' && (
                <div className="space-y-6 max-w-4xl">
                  {/* Default Map Type - Only show if user is logged in */}
                  {user && (
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-2">Default Map Type</h3>
                      <p className="text-sm text-gray-400 mb-4">
                        Choose your preferred map style that will be used when you open the app.
                      </p>
                      <div className="bg-gray-700/50 rounded-lg p-4">
                        <div className="relative map-style-dropdown">
                          <button
                            onClick={() => setIsMapStyleDropdownOpen(!isMapStyleDropdownOpen)}
                            className="bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-sm border border-gray-600 hover:border-gray-500 transition-colors flex items-center gap-2 w-full"
                          >
                            <span>{mapStyles.find(s => s.id === defaultMapStyle)?.name || 'Dark'}</span>
                            <ChevronDown size={14} className={`transition-transform ml-auto ${isMapStyleDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {isMapStyleDropdownOpen && (
                            <div className="absolute top-full left-0 mt-1 bg-black/90 backdrop-blur-sm rounded-lg border border-gray-600 shadow-lg z-50 w-full min-w-full max-w-[200px]">
                              {mapStyles.map((style) => (
                                <button
                                  key={style.id}
                                  onClick={() => {
                                    handleSaveDefaultMapStyle(style.id);
                                    setIsMapStyleDropdownOpen(false);
                                  }}
                                  className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-700/50 transition-colors first:rounded-t-lg last:rounded-b-lg whitespace-nowrap ${
                                    defaultMapStyle === style.id ? 'bg-blue-600/20 text-blue-300' : 'text-white'
                                  }`}
                                >
                                  {style.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">Favorite Colors</h3>
                    <p className="text-sm text-gray-400 mb-6">
                      Manage your favorite colors for quick access when creating markers or folders.
                    </p>

                    {/* Add Color Section */}
                    <div className="bg-gray-700/50 rounded-lg p-6 mb-6">
                      <h4 className="text-lg font-medium text-white mb-4">Add Color</h4>
                      
                      <div className="space-y-4">
                        {/* Color Picker */}
                        <div className="flex items-center gap-4">
                          <label className="text-sm font-medium text-gray-300">Color Picker:</label>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={selectedColorPicker}
                              onChange={(e) => setSelectedColorPicker(e.target.value)}
                              className="w-16 h-12 rounded-lg cursor-pointer border border-gray-600"
                            />
                            <button
                              onClick={handleAddColorFromPicker}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                              Add Color
                            </button>
                          </div>
                        </div>

                        {/* Text Input */}
                        <div className="flex items-center gap-4">
                          <label className="text-sm font-medium text-gray-300 whitespace-nowrap">Or enter code:</label>
                          <div className="flex items-center gap-3 flex-1">
                            <input
                              type="text"
                              value={newColorInput}
                              onChange={(e) => setNewColorInput(e.target.value)}
                              placeholder="#FF5733 or rgb(255, 87, 51)"
                              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                              onKeyPress={(e) => e.key === 'Enter' && handleAddFavoriteColor()}
                            />
                            <button
                              onClick={handleAddFavoriteColor}
                              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Favorite Colors List */}
                    <div className="bg-gray-700/50 rounded-lg p-6">
                      <h4 className="text-lg font-medium text-white mb-4">
                        Your Favorite Colors ({favoriteColors.length})
                      </h4>
                      
                      {favoriteColors.length === 0 ? (
                        <p className="text-gray-400 text-sm">No favorite colors yet. Add some above!</p>
                      ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                          {favoriteColors.map((color, index) => (
                            <div key={index} className="relative group">
                              <div
                                className="w-full aspect-square rounded-lg border-2 border-gray-600 hover:border-gray-400 transition-colors"
                                style={{ backgroundColor: color }}
                              />
                              <button
                                onClick={() => handleRemoveFavoriteColor(color)}
                                className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                title={`Remove ${color}`}
                              >
                                ×
                              </button>
                              <div className="mt-1 text-xs text-gray-400 truncate text-center">
                                {color}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={handleImportComplete}
      />

      {/* Update Dates Modal */}
      <UpdateDatesModal
        isOpen={isUpdateDatesModalOpen}
        onClose={() => setIsUpdateDatesModalOpen(false)}
        onUpdateComplete={() => {
          // Reload data after update
          console.log('Dates updated successfully');
        }}
      />
    </>
  );
};

export default Sidebar;
