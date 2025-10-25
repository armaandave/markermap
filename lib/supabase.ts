import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('🚨 Supabase environment variables are not set! Using placeholder values for build.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types based on your schema
export interface SupabaseFolder {
  id: string;
  name: string;
  color: string;
  icon: string;
  visible: boolean;
  order: number;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface SupabaseMarker {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  folder_id: string;
  color: string;
  custom_fields?: Record<string, any>;
  images?: string[];
  created_at: string;
  updated_at: string;
  user_id: string;
}

// Helper functions to convert between local and Supabase formats
export const convertFolderToSupabase = (folder: any): Omit<SupabaseFolder, 'created_at' | 'updated_at'> => ({
  id: folder.id,
  name: folder.name,
  color: folder.color,
  icon: folder.icon,
  visible: folder.visible,
  order: folder.order,
  user_id: folder.userId,
});

export const convertSupabaseToFolder = (supabaseFolder: SupabaseFolder): any => ({
  id: supabaseFolder.id,
  name: supabaseFolder.name,
  color: supabaseFolder.color,
  icon: supabaseFolder.icon,
  visible: supabaseFolder.visible,
  order: supabaseFolder.order,
  createdAt: new Date(supabaseFolder.created_at),
  updatedAt: new Date(supabaseFolder.updated_at),
  userId: supabaseFolder.user_id,
});

export const convertMarkerToSupabase = (marker: any): Omit<SupabaseMarker, 'created_at' | 'updated_at'> => ({
  id: marker.id,
  title: marker.title,
  description: marker.description || '',
  latitude: marker.latitude,
  longitude: marker.longitude,
  folder_id: marker.folderId,
  color: marker.color,
  custom_fields: marker.customFields,
  images: marker.images || [],
  user_id: marker.userId,
});

export const convertSupabaseToMarker = (supabaseMarker: SupabaseMarker): any => ({
  id: supabaseMarker.id,
  title: supabaseMarker.title,
  description: supabaseMarker.description,
  latitude: supabaseMarker.latitude,
  longitude: supabaseMarker.longitude,
  folderId: supabaseMarker.folder_id,
  color: supabaseMarker.color,
  customFields: supabaseMarker.custom_fields,
  images: supabaseMarker.images || [],
  createdAt: new Date(supabaseMarker.created_at),
  updatedAt: new Date(supabaseMarker.updated_at),
  userId: supabaseMarker.user_id,
});