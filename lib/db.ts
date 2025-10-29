import Dexie, { Table } from 'dexie';

console.log('🗄️ Database: Initializing Dexie...');

export interface Folder {
  id: string;
  name: string;
  color: string;
  icon: string;
  visible: boolean;
  parentId?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  userId?: string; // null for local data, user ID for cloud data
  isShared?: boolean; // true if this folder is shared with current user
  ownerId?: string; // user who owns this folder (for shared folders)
  ownerName?: string; // display name of the owner (for shared folders)
  sharePermission?: 'view' | 'edit'; // permission level for shared folders
}

export interface Tag {
  id: string;
  name: string;
  visible: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId?: string; // null for local data, user ID for cloud data
}

export interface Marker {
  id: string;
  folderId: string;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  color: string;
  address?: string;
  images?: string[]; // Cloudinary image URLs
  customFields?: Record<string, any>; // Store custom fields from KML
  tags?: string[]; // Tags for organizing markers
  createdAt: Date;
  updatedAt: Date;
  userId?: string; // null for local data, user ID for cloud data
}

export interface MarkerImage {
  id: string;
  markerId: string;
  url: string; // Cloudinary image URL
  order: number;
  createdAt: Date;
}

export interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'select' | 'multiselect' | 'date' | 'number';
  options?: string[]; // for select types
  createdAt: Date;
}

export interface MarkerCustomValue {
  id: string;
  markerId: string;
  fieldId: string;
  value: string | number | boolean | null; // JSON value
  createdAt: Date;
}

export interface Friendship {
  id: string;
  userId: string;
  friendId: string;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: Date;
  updatedAt: Date;
}

export interface FolderShare {
  id: string;
  folderId: string;
  ownerId: string;
  sharedWithId: string;
  permission: 'view' | 'edit';
  shareTags?: boolean; // Whether to share tags with markers
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  userId: string;
  username?: string;
  displayName?: string;
  email: string;
  profilePictureUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class MarkerMapDB extends Dexie {
  folders!: Table<Folder>;
  markers!: Table<Marker>;
  tags!: Table<Tag>;
  markerImages!: Table<MarkerImage>;
  customFields!: Table<CustomField>;
  markerCustomValues!: Table<MarkerCustomValue>;

  constructor() {
    super('MarkerMapDB');
    console.log('🗄️ Database: Creating database schema...');
    this.version(3).stores({
      folders: 'id, name, visible, order, createdAt, userId',
      markers: 'id, folderId, title, latitude, longitude, createdAt, userId',
      tags: 'id, name, visible, createdAt, userId',
      markerImages: 'id, markerId, order, createdAt',
      customFields: 'id, name, type, createdAt',
      markerCustomValues: 'id, markerId, fieldId, createdAt'
    });
    console.log('🗄️ Database: Schema created');
  }
}

console.log('🗄️ Database: Creating database instance...');
export const db = new MarkerMapDB();
console.log('🗄️ Database: Database instance created');

// Test database connection with timeout
const openDb = async () => {
  try {
    console.log('🗄️ Database: Opening database...');
    
    const openPromise = db.open();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database open timeout')), 3000)
    );
    
    await Promise.race([openPromise, timeoutPromise]);
    console.log('🗄️ Database: Ready');
  } catch (error) {
    console.log('🗄️ Database: Using fallback mode (database unavailable)');
  }
};

openDb();

// Helper functions for user-specific data
export const getUserFolders = async (userId: string | null): Promise<Folder[]> => {
  console.log('🗄️ getUserFolders: Querying for userId:', userId);
  console.log('🗄️ getUserFolders: Database ready state:', db.isOpen());
  
  try {
    let result;
    if (userId) {
      console.log('🗄️ getUserFolders: Querying user-specific folders...');
      result = await db.folders.where('userId').equals(userId).toArray();
    } else {
      console.log('🗄️ getUserFolders: Querying local folders (userId=null)...');
      // For null userId, we need to filter manually since Dexie doesn't support .equals(null)
      const allFolders = await db.folders.toArray();
      console.log('🗄️ getUserFolders: All folders in DB:', allFolders.map(f => ({ id: f.id, name: f.name, userId: f.userId })));
      result = allFolders.filter(folder => folder.userId === null || folder.userId === undefined);
    }
    console.log('🗄️ getUserFolders: Found', result.length, 'folders for userId:', userId);
    console.log('🗄️ getUserFolders: Folders:', result.map(f => ({ id: f.id, name: f.name, userId: f.userId })));
    
    // Clean up duplicate default folders for local data
    if (!userId) {
      const defaultFolders = result.filter(f => f.name === 'Default');
      if (defaultFolders.length > 1) {
        console.log('🗄️ getUserFolders: Found', defaultFolders.length, 'duplicate default folders, cleaning up...');
        // Keep the first one, delete the rest
        const keepFolder = defaultFolders[0];
        const deleteFolders = defaultFolders.slice(1);
        
        for (const folder of deleteFolders) {
          await db.folders.delete(folder.id);
          console.log('🗄️ getUserFolders: Deleted duplicate folder:', folder.id);
        }
        
        // Update result to only include the kept folder
        result = result.filter(f => f.id === keepFolder.id || f.name !== 'Default');
        console.log('🗄️ getUserFolders: After cleanup:', result.length, 'folders');
      }
    }
    
    return result;
  } catch (error) {
    console.error('🗄️ getUserFolders: Error:', error);
    return [];
  }
};

export const getUserMarkers = async (userId: string | null): Promise<Marker[]> => {
  console.log('🗄️ getUserMarkers: Querying for userId:', userId);
  console.log('🗄️ getUserMarkers: Database ready state:', db.isOpen());
  
  try {
    let result;
    if (userId) {
      console.log('🗄️ getUserMarkers: Querying user-specific markers...');
      result = await db.markers.where('userId').equals(userId).toArray();
    } else {
      console.log('🗄️ getUserMarkers: Querying local markers (userId=null)...');
      // For null userId, we need to filter manually since Dexie doesn't support .equals(null)
      const allMarkers = await db.markers.toArray();
      console.log('🗄️ getUserMarkers: All markers in DB:', allMarkers.map(m => ({ id: m.id, title: m.title, userId: m.userId })));
      result = allMarkers.filter(marker => marker.userId === null || marker.userId === undefined);
    }
    console.log('🗄️ getUserMarkers: Found', result.length, 'markers for userId:', userId);
    console.log('🗄️ getUserMarkers: Markers:', result.map(m => ({ id: m.id, title: m.title, userId: m.userId })));
    return result;
  } catch (error) {
    console.error('🗄️ getUserMarkers: Error:', error);
    return [];
  }
};

export const addUserFolder = async (folder: Folder, userId: string | null): Promise<void> => {
  const folderWithUser = { ...folder, userId: userId || undefined };
  await db.folders.add(folderWithUser);
};

export const addUserMarker = async (marker: Marker, userId: string | null): Promise<void> => {
  console.log('🗄️ addUserMarker: Adding marker with userId:', userId);
  console.log('🗄️ addUserMarker: Marker:', { id: marker.id, title: marker.title, userId: marker.userId });
  const markerWithUser = { ...marker, userId: userId || undefined };
  console.log('🗄️ addUserMarker: Final marker to save:', { id: markerWithUser.id, title: markerWithUser.title, userId: markerWithUser.userId });
  await db.markers.add(markerWithUser);
  console.log('🗄️ addUserMarker: Marker saved successfully');
};

export const updateUserFolder = async (folder: Folder, userId: string | null): Promise<void> => {
  const folderWithUser = { ...folder, userId: userId || undefined };
  await db.folders.put(folderWithUser);
};

export const updateUserMarker = async (marker: Marker, userId: string | null): Promise<void> => {
  const markerWithUser = { ...marker, userId: userId || undefined };
  await db.markers.put(markerWithUser);
};

export const deleteUserFolder = async (folderId: string, userId: string | null): Promise<void> => {
  if (userId) {
    // Filter by userId first, then by id
    const folders = await db.folders.where('userId').equals(userId).toArray();
    const folderToDelete = folders.find(f => f.id === folderId);
    if (folderToDelete) {
      await db.folders.delete(folderId);
    }
  } else {
    // For null userId, we need to filter manually
    const folders = await db.folders.where('id').equals(folderId).toArray();
    const folderToDelete = folders.find(f => f.userId === null || f.userId === undefined);
    if (folderToDelete) {
      await db.folders.delete(folderId);
    }
  }
};

export const deleteUserMarker = async (markerId: string, userId: string | null): Promise<void> => {
  if (userId) {
    // Filter by userId first, then by id
    const markers = await db.markers.where('userId').equals(userId).toArray();
    const markerToDelete = markers.find(m => m.id === markerId);
    if (markerToDelete) {
      await db.markers.delete(markerId);
    }
  } else {
    // For null userId, we need to filter manually
    const markers = await db.markers.where('id').equals(markerId).toArray();
    const markerToDelete = markers.find(m => m.userId === null || m.userId === undefined);
    if (markerToDelete) {
      await db.markers.delete(markerId);
    }
  }
};

// Supabase sync functions
export const syncFoldersToSupabase = async (userId: string, folders?: Folder[]): Promise<void> => {
  try {
    console.log('🔄 Supabase Sync: Syncing folders to cloud for user:', userId);
    
    // Use provided folders or get from IndexedDB
    const foldersToSync = folders || await getUserFolders(userId);
    console.log('🔄 Supabase Sync: Syncing', foldersToSync.length, 'folders to cloud');
    
    const response = await fetch('/api/sync/folders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ folders: foldersToSync, userId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to sync folders');
    }

    console.log('✅ Supabase Sync: Folders synced successfully');
  } catch (error) {
    console.error('🚨 Supabase Sync: Error syncing folders:', error);
    throw error;
  }
};

export const syncMarkersToSupabase = async (userId: string, markers?: Marker[]): Promise<void> => {
  try {
    console.log('🔄 Supabase Sync: Syncing markers to cloud for user:', userId);
    
    // Use provided markers or get from IndexedDB
    const markersToSync = markers || await getUserMarkers(userId);
    console.log('🔄 Supabase Sync: Syncing', markersToSync.length, 'markers to cloud');
    
    const response = await fetch('/api/sync/markers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ markers: markersToSync, userId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to sync markers');
    }

    console.log('✅ Supabase Sync: Markers synced successfully');
  } catch (error) {
    console.error('🚨 Supabase Sync: Error syncing markers:', error);
    throw error;
  }
};

export const deleteFolderFromSupabase = async (folderId: string, userId: string): Promise<void> => {
  try {
    console.log('🗑️ Supabase Delete: Deleting folder from cloud:', folderId);
    
    const response = await fetch(`/api/sync/folders?userId=${userId}&folderId=${folderId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete folder from Supabase');
    }

    console.log('✅ Supabase Delete: Folder deleted from cloud successfully');
  } catch (error) {
    console.error('🚨 Supabase Delete: Error deleting folder from cloud:', error);
    throw error;
  }
};

export const loadFoldersFromSupabase = async (userId: string): Promise<Folder[]> => {
  try {
    console.log('🔄 Supabase Sync: Loading folders from cloud for user:', userId);
    
    const response = await fetch(`/api/sync/folders?userId=${userId}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load folders');
    }

    const { folders } = await response.json();
    console.log('✅ Supabase Sync: Loaded', folders.length, 'folders from cloud');
    
    return folders;
  } catch (error) {
    console.error('🚨 Supabase Sync: Error loading folders:', error);
    throw error;
  }
};

export const loadMarkersFromSupabase = async (userId: string): Promise<Marker[]> => {
  try {
    console.log('🔄 Supabase Sync: Loading markers from cloud for user:', userId);
    
    const response = await fetch(`/api/sync/markers?userId=${userId}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load markers');
    }

    const { markers } = await response.json();
    console.log('✅ Supabase Sync: Loaded', markers.length, 'markers from cloud');
    console.log('🔄 Supabase Sync: First marker sample:', markers[0]);
    
    return markers;
  } catch (error) {
    console.error('🚨 Supabase Sync: Error loading markers:', error);
    throw error;
  }
};
