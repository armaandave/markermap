import { create } from 'zustand';
import { Marker, Folder, addUserMarker, updateUserMarker, deleteUserMarker, addUserFolder, updateUserFolder, deleteUserFolder, syncFoldersToSupabase, syncMarkersToSupabase, loadFoldersFromSupabase, loadMarkersFromSupabase, getUserFolders, getUserMarkers, deleteFolderFromSupabase } from '../lib/db';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface MapState {
  // Authentication state
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  
  // Map state
  viewState: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  setViewState: (viewState: Partial<MapState['viewState']>) => void;
  
  // Marker state
  markers: Marker[];
  setMarkers: (markers: Marker[]) => void;
  addMarker: (marker: Marker) => void;
  updateMarker: (id: string, updates: Partial<Marker>) => void;
  deleteMarker: (id: string) => void;
  
  // Folder state
  folders: Folder[];
  setFolders: (folders: Folder[]) => void;
  addFolder: (folder: Folder) => void;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  deleteFolder: (id: string) => void;
  
  // UI state
  selectedMarker: Marker | null;
  setSelectedMarker: (marker: Marker | null) => void;
  
  selectedFolderId: string | null;
  setSelectedFolderId: (folderId: string | null) => void;
  
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  
  // Map controls
  mapStyle: string;
  setMapStyle: (style: string) => void;
  defaultMapStyle: string;
  setDefaultMapStyle: (style: string) => void;
  loadDefaultMapStyle: () => Promise<void>;
  
  // Import state
  isImporting: boolean;
  setIsImporting: (importing: boolean) => void;
  importProgress: number;
  setImportProgress: (progress: number) => void;
  
  // Supabase sync functions
  syncToCloud: () => Promise<void>;
  loadFromCloud: () => Promise<void>;
}

export const useMapStore = create<MapState>((set, get) => ({
  // Authentication state
  user: null,
  setUser: (user) => set({ user }),
  
  // Initial map state (will be updated to user's location on load)
  viewState: {
    longitude: -98.5795,
    latitude: 39.8283,
    zoom: 4,
  },
  setViewState: (viewState) => set((state) => ({
    viewState: { ...state.viewState, ...viewState }
  })),
  
  // Marker state
  markers: [],
  setMarkers: (markers) => set({ markers }),
  addMarker: async (marker) => {
    const state = get();
    const userId = state.user?.uid || null;
    
    // Add to store first
    set((state) => ({
      markers: [...state.markers, marker]
    }));
    
    if (userId) {
      // Signed in: Only sync to Supabase
      try {
        const currentState = get();
        await syncMarkersToSupabase(userId, currentState.markers);
      } catch (error) {
        console.error('Failed to sync marker to cloud:', error);
        throw error; // Re-throw to handle in UI
      }
    } else {
      // Signed out: Only save to IndexedDB
      await addUserMarker(marker, null);
    }
  },
  updateMarker: async (id, updates) => {
    const state = get();
    const userId = state.user?.uid || null;
    
    set((state) => ({
      markers: state.markers.map(marker => 
        marker.id === id ? { ...marker, ...updates } : marker
      )
    }));
    
    if (userId) {
      // Signed in: Only sync to Supabase
      try {
        const currentState = get();
        await syncMarkersToSupabase(userId, currentState.markers);
      } catch (error) {
        console.error('Failed to sync updated marker to cloud:', error);
        throw error; // Re-throw to handle in UI
      }
    } else {
      // Signed out: Only update IndexedDB
      const updatedMarker = state.markers.find(marker => marker.id === id);
      if (updatedMarker) {
        const newMarker = { ...updatedMarker, ...updates };
        await updateUserMarker(newMarker, null);
      }
    }
  },
  deleteMarker: async (id) => {
    const state = get();
    const userId = state.user?.uid || null;
    
    console.log(`🗑️ DELETE MARKER - Starting deletion of marker ${id} for user:`, userId);
    
    set((state) => ({
      markers: state.markers.filter(marker => marker.id !== id)
    }));
    
    console.log(`🗑️ DELETE MARKER - Removed from store, remaining markers:`, get().markers.length);
    
    if (userId) {
      // Signed in: Only sync to Supabase
      try {
        const currentState = get();
        console.log(`🗑️ DELETE MARKER - Syncing ${currentState.markers.length} markers to Supabase`);
        await syncMarkersToSupabase(userId, currentState.markers);
        console.log(`🗑️ DELETE MARKER - Supabase sync successful`);
      } catch (error) {
        console.error('🗑️ DELETE MARKER - Failed to sync marker deletion to cloud:', error);
        throw error; // Re-throw to handle in UI
      }
    } else {
      // Signed out: Only delete from IndexedDB
      await deleteUserMarker(id, null);
      console.log(`🗑️ DELETE MARKER - Deleted from IndexedDB`);
    }
    
    console.log(`🗑️ DELETE MARKER - Deletion complete`);
  },
  
  // Folder state
  folders: [],
  setFolders: (folders) => {
    set({ folders });
    // Auto-select first folder if none selected
    const state = get();
    if (!state.selectedFolderId && folders.length > 0) {
      set({ selectedFolderId: folders[0].id });
    }
  },
  addFolder: async (folder) => {
    const state = get();
    const userId = state.user?.uid || null;
    
    // Add to store first
    set((state) => ({
      folders: [...state.folders, folder]
    }));
    
    if (userId) {
      // Signed in: Only sync to Supabase
      try {
        const currentState = get();
        await syncFoldersToSupabase(userId, currentState.folders);
      } catch (error) {
        console.error('Failed to sync folder to cloud:', error);
        throw error; // Re-throw to handle in UI
      }
    } else {
      // Signed out: Only save to IndexedDB
      await addUserFolder(folder, null);
    }
  },
  updateFolder: async (id, updates) => {
    const state = get();
    const userId = state.user?.uid || null;
    
    set((state) => ({
      folders: state.folders.map(folder => 
        folder.id === id ? { ...folder, ...updates } : folder
      )
    }));
    
    if (userId) {
      // Signed in: Only sync to Supabase
      try {
        const currentState = get();
        await syncFoldersToSupabase(userId, currentState.folders);
      } catch (error) {
        console.error('Failed to sync folder update to cloud:', error);
        throw error; // Re-throw to handle in UI
      }
    } else {
      // Signed out: Only update IndexedDB
      const updatedFolder = state.folders.find(folder => folder.id === id);
      if (updatedFolder) {
        const newFolder = { ...updatedFolder, ...updates };
        await updateUserFolder(newFolder, null);
      }
    }
  },
  deleteFolder: async (id) => {
    const state = get();
    const userId = state.user?.uid || null;
    
    // Update store state first
    set((state) => ({
      folders: state.folders.filter(folder => folder.id !== id),
      markers: state.markers.filter(marker => marker.folderId !== id)
    }));
    
    if (userId) {
      // Signed in: Only sync to Supabase
      try {
        // Delete individual folder from Supabase
        await deleteFolderFromSupabase(id, userId);
        
        // Also sync remaining markers to Supabase (to remove deleted markers)
        const currentState = get();
        await syncMarkersToSupabase(userId, currentState.markers);
      } catch (error) {
        console.error('Failed to delete folder from cloud:', error);
        throw error; // Re-throw to handle in UI
      }
    } else {
      // Signed out: Only delete from IndexedDB
      await deleteUserFolder(id, null);
      
      // Also delete markers in this folder from IndexedDB
      const markersToDelete = state.markers.filter(marker => marker.folderId === id);
      for (const marker of markersToDelete) {
        await deleteUserMarker(marker.id, null);
      }
    }
  },
  
  // UI state
  selectedMarker: null,
  setSelectedMarker: (selectedMarker) => set({ selectedMarker }),
  
  selectedFolderId: null,
  setSelectedFolderId: (selectedFolderId) => set({ selectedFolderId }),
  
  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  
  // Map controls
  mapStyle: 'mapbox://styles/mapbox/dark-v11',
  setMapStyle: (mapStyle) => set({ mapStyle }),
  defaultMapStyle: 'mapbox://styles/mapbox/dark-v11',
  setDefaultMapStyle: (defaultMapStyle) => set({ defaultMapStyle }),
  loadDefaultMapStyle: async () => {
    const state = get();
    if (!state.user?.uid) {
      // User not signed in - check localStorage
      const saved = localStorage.getItem('defaultMapStyle');
      if (saved) {
        set({ mapStyle: saved, defaultMapStyle: saved });
      }
      return;
    }
    
    try {
      const response = await fetch(`/api/preferences?userId=${state.user.uid}`);
      if (response.ok) {
        const { defaultMapStyle } = await response.json();
        if (defaultMapStyle) {
          set({ mapStyle: defaultMapStyle, defaultMapStyle });
          console.log('✅ Loaded default map style:', defaultMapStyle);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load default map style from Supabase:', error);
      // Fall back to localStorage
      const saved = localStorage.getItem('defaultMapStyle');
      if (saved) {
        set({ mapStyle: saved, defaultMapStyle: saved });
      }
    }
  },
  
  // Import state
  isImporting: false,
  setIsImporting: (isImporting) => set({ isImporting }),
  importProgress: 0,
  setImportProgress: (importProgress) => set({ importProgress }),
  
  // Supabase sync functions
  syncToCloud: async () => {
    const state = get();
    if (!state.user?.uid) {
      return;
    }
    
    try {
      await Promise.all([
        syncFoldersToSupabase(state.user.uid, state.folders),
        syncMarkersToSupabase(state.user.uid, state.markers),
      ]);
    } catch (error) {
      console.error('Cloud sync failed:', error);
      throw error;
    }
  },
  
  loadFromCloud: async () => {
    const state = get();
    if (!state.user?.uid) {
      return;
    }
    
    try {
      console.log('🔍 CLOUD LOAD - Starting for user:', state.user.uid);
      const [cloudFolders, cloudMarkers] = await Promise.all([
        loadFoldersFromSupabase(state.user.uid),
        loadMarkersFromSupabase(state.user.uid),
      ]);
      
      console.log('🔍 CLOUD LOAD - Received:', cloudFolders.length, 'folders,', cloudMarkers.length, 'markers');
      console.log('🔍 CLOUD LOAD - Marker IDs:', cloudMarkers.map(m => m.id));
      
      // SIMPLE LOGIC: Just use cloud data directly
      set({ folders: cloudFolders, markers: cloudMarkers });
      console.log('🔍 CLOUD LOAD - Cloud data set in store');
      
      // Auto-select first folder if none selected
      const newState = get();
      if (!newState.selectedFolderId && cloudFolders.length > 0) {
        set({ selectedFolderId: cloudFolders[0].id });
        console.log('🔍 CLOUD LOAD - Auto-selected first folder:', cloudFolders[0].id);
      }
      
      console.log('🔍 CLOUD LOAD - Store after set:', newState.folders.length, 'folders,', newState.markers.length, 'markers');
    } catch (error) {
      console.error('🔍 CLOUD LOAD - Failed:', error);
      throw error;
    }
  },
}));
