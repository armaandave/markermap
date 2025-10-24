import Dexie, { Table } from 'dexie';

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
  images?: string[]; // Base64 image URLs
  customFields?: Record<string, any>; // Store custom fields from KML
  createdAt: Date;
  updatedAt: Date;
}

export interface MarkerImage {
  id: string;
  markerId: string;
  url: string; // base64 blob URL
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
  value: any; // JSON value
  createdAt: Date;
}

export class MarkerMapDB extends Dexie {
  folders!: Table<Folder>;
  markers!: Table<Marker>;
  markerImages!: Table<MarkerImage>;
  customFields!: Table<CustomField>;
  markerCustomValues!: Table<MarkerCustomValue>;

  constructor() {
    super('MarkerMapDB');
    this.version(1).stores({
      folders: 'id, name, visible, order, createdAt',
      markers: 'id, folderId, title, latitude, longitude, createdAt',
      markerImages: 'id, markerId, order, createdAt',
      customFields: 'id, name, type, createdAt',
      markerCustomValues: 'id, markerId, fieldId, createdAt'
    });
  }
}

export const db = new MarkerMapDB();
