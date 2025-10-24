import { create } from 'zustand';
import { Marker, Folder } from '../lib/db';

interface MapState {
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
  
  // Import state
  isImporting: boolean;
  setIsImporting: (importing: boolean) => void;
  importProgress: number;
  setImportProgress: (progress: number) => void;
}

export const useMapStore = create<MapState>((set, get) => ({
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
  addMarker: (marker) => set((state) => ({
    markers: [...state.markers, marker]
  })),
  updateMarker: (id, updates) => set((state) => ({
    markers: state.markers.map(marker => 
      marker.id === id ? { ...marker, ...updates } : marker
    )
  })),
  deleteMarker: (id) => set((state) => ({
    markers: state.markers.filter(marker => marker.id !== id)
  })),
  
  // Folder state
  folders: [],
  setFolders: (folders) => set({ folders }),
  addFolder: (folder) => set((state) => ({
    folders: [...state.folders, folder]
  })),
  updateFolder: (id, updates) => set((state) => ({
    folders: state.folders.map(folder => 
      folder.id === id ? { ...folder, ...updates } : folder
    )
  })),
  deleteFolder: (id) => set((state) => ({
    folders: state.folders.filter(folder => folder.id !== id),
    markers: state.markers.filter(marker => marker.folderId !== id)
  })),
  
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
  
  // Import state
  isImporting: false,
  setIsImporting: (isImporting) => set({ isImporting }),
  importProgress: 0,
  setImportProgress: (importProgress) => set({ importProgress }),
}));
