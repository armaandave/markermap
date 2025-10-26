import { parseString } from 'xml2js';
import { Marker, Folder, MarkerImage } from './db';

export interface KMLPlacemark {
  name?: string[];
  description?: string[];
  Point?: {
    coordinates?: string[];
  }[];
  ExtendedData?: {
    Data?: Array<{
      $: { name: string };
      value?: string[];
    }>;
  }[];
  styleUrl?: string[];
  Style?: KMLStyle[]; // Add this for inline styles
  TimeStamp?: {
    when?: string[];
  }[];
}

export interface KMLFolder {
  name?: string[];
  Placemark?: KMLPlacemark[];
  Folder?: KMLFolder[];
  styleUrl?: string[];
  Style?: KMLStyle[];
}

export interface KMLDocument {
  name?: string[];
  Folder?: KMLFolder[];
  Placemark?: KMLPlacemark[];
  Style?: KMLStyle[];
}

export interface KMLStyle {
  $: { id: string };
  IconStyle?: {
    color?: string[];
  }[];
}

export interface ParsedKML {
  folders: Folder[];
  markers: Marker[];
  images: MarkerImage[];
  imageFiles: { [filename: string]: string }; // filename -> Cloudinary URL
}

export class KMLParser {
  private static parseKMLColor(kmlColor: string): string {
    if (!kmlColor || kmlColor.length !== 8) return '#ffffff';
    
    // KML colors are in AABBGGRR format, we need RRGGBB
    const alpha = kmlColor.substring(0, 2);
    const blue = kmlColor.substring(2, 4);
    const green = kmlColor.substring(4, 6);
    const red = kmlColor.substring(6, 8);
    
    return `#${red}${green}${blue}`;
  }

  private static getColorFromStyleUrl(styleUrl: string | undefined, styles: Map<string, string>): string {
    if (!styleUrl || !styleUrl.startsWith('#')) return '#ffffff';
    
    const styleId = styleUrl.substring(1); // Remove the #
    return styles.get(styleId) || '#ffffff';
  }

  private static parseCoordinates(coords: string): { lat: number; lng: number } | null {
    if (!coords) return null;
    
    const parts = coords.trim().split(',');
    if (parts.length < 2) return null;
    
    const lng = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    
    if (isNaN(lat) || isNaN(lng)) return null;
    
    return { lat, lng };
  }

  private static parseCustomFields(extendedData: any[] | undefined): Record<string, any> {
    const customFields: Record<string, any> = {};
    
    if (!extendedData || !extendedData[0]?.Data) return customFields;
    
    extendedData[0].Data.forEach((data: any) => {
      if (data.$?.name && data.value?.[0]) {
        const fieldName = data.$.name;
        const fieldValue = data.value[0];
        
        // Handle MapMarker custom fields format
        if (fieldName === 'com_exlyo_mapmarker_customfields') {
          try {
            const customFieldsData = JSON.parse(fieldValue);
            customFieldsData.forEach((field: any) => {
              if (field.base_params?.name && field.value?.selected_value) {
                customFields[field.base_params.name] = field.value.selected_value;
              }
            });
          } catch (e) {
            console.warn('Failed to parse custom fields JSON:', e);
          }
        } else {
          customFields[fieldName] = fieldValue;
        }
      }
    });
    
    return customFields;
  }

  private static parseImageMetadata(extendedData: any[] | undefined): string[] {
    const imageFiles: string[] = [];
    
    if (!extendedData || !extendedData[0]?.Data) return imageFiles;
    
    extendedData[0].Data.forEach((data: any) => {
      if (data.$?.name === 'com_exlyo_mapmarker_images_with_ext' && data.value?.[0]) {
        try {
          const imageData = JSON.parse(data.value[0]);
          imageData.forEach((img: any) => {
            if (img.file_rel_path) {
              // Extract just the filename from the path
              const filename = img.file_rel_path.split('/').pop();
              if (filename) {
                imageFiles.push(filename);
              }
            }
          });
        } catch (e) {
          console.warn('Failed to parse image metadata JSON:', e);
        }
      }
    });
    
    return imageFiles;
  }

  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private static parsePlacemark(placemark: KMLPlacemark, folderId: string, styles: Map<string, string>): Marker | null {
    if (!placemark.Point?.[0]?.coordinates?.[0]) return null;
    
    const coords = this.parseCoordinates(placemark.Point[0].coordinates[0]);
    if (!coords) return null;
    
    const customFields = this.parseCustomFields(placemark.ExtendedData);
    
    // Extract image metadata from ExtendedData (more reliable than parsing HTML)
    const imageFiles = this.parseImageMetadata(placemark.ExtendedData);
    
    // Extract timestamp if available
    let createdAt = new Date();
    if (placemark.TimeStamp?.[0]?.when?.[0]) {
      try {
        createdAt = new Date(placemark.TimeStamp[0].when[0]);
      } catch (e) {
        console.warn('Failed to parse timestamp:', placemark.TimeStamp[0].when[0]);
      }
    }
    
    // Extract description and clean up HTML
    let description = placemark.description?.[0] || '';
    if (description.includes('<![CDATA[')) {
      description = description.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
    }
    
    // Clean up description by removing image tags and tables
    description = description
      .replace(/<img[^>]*>/g, '')
      .replace(/<table[^>]*>[\s\S]*?<\/table>/g, '')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/g, '$1')
      .trim();
    
    // COMPREHENSIVE COLOR DEBUGGING
    const markerName = placemark.name?.[0] || 'Untitled';
    const styleUrl = placemark.styleUrl?.[0];
    
    console.group(`🔍 DEBUGGING MARKER: "${markerName}"`);
    console.log(`📍 StyleUrl: ${styleUrl}`);
    console.log(`🎨 Available styles:`, Array.from(styles.keys()));
    console.log(`🔍 Raw placemark structure:`, placemark);
    
    // Get color from styleUrl first
    let color = this.getColorFromStyleUrl(styleUrl, styles);
    console.log(`🎯 Color from styleUrl: ${color}`);
    
    // Check for inline styles - let's examine the structure more carefully
    if (color === '#ffffff' && placemark.Style) {
      console.log(`🔍 Checking inline styles...`);
      console.log(`📋 Inline styles found:`, placemark.Style.length);
      
      placemark.Style.forEach((style, index) => {
        const styleId = style.$?.id;
        const iconStyle = style.IconStyle?.[0];
        const iconColor = iconStyle?.color?.[0];
        
        console.log(`  Style ${index + 1}:`, {
          id: styleId,
          hasIconStyle: !!iconStyle,
          hasColor: !!iconColor,
          colorValue: iconColor
        });
        
        if (styleId && iconColor) {
          const inlineColor = this.parseKMLColor(iconColor);
          console.log(`  ✅ Parsed inline color: ${iconColor} -> ${inlineColor}`);
          color = inlineColor;
        }
      });
    } else if (color === '#ffffff') {
      console.log(`❌ No inline styles found, falling back to default`);
      console.log(`🔍 placemark.Style exists:`, !!placemark.Style);
      console.log(`🔍 placemark.Style value:`, placemark.Style);
    }
    
    console.log(`🎨 FINAL COLOR: ${color}`);
    console.groupEnd();
    
        return {
          id: this.generateId(),
          folderId,
          title: markerName,
          description: description,
          latitude: coords.lat,
          longitude: coords.lng,
          color: color,
          address: '', // Will be filled by reverse geocoding later
          customFields: customFields, // Store custom fields from KML
          images: imageFiles, // Store image filenames from KML
          createdAt: createdAt,
          updatedAt: new Date(),
        };
  }

  private static parseFolder(folder: KMLFolder, parentId: string | undefined, styles: Map<string, string>): { folders: Folder[]; markers: Marker[] } {
    const folders: Folder[] = [];
    const markers: Marker[] = [];
    
    // Create a copy of styles for this folder and add any styles defined within this folder
    const folderStyles = new Map(styles);
    
    // Parse styles defined within this folder
    if (folder.Style) {
      console.log(`🔍 Parsing ${folder.Style.length} styles within folder "${folder.name?.[0] || 'Untitled'}"`);
      folder.Style.forEach(style => {
        const styleId = style.$?.id;
        const iconStyle = style.IconStyle?.[0];
        const iconColor = iconStyle?.color?.[0];
        
        if (styleId && iconColor) {
          const color = this.parseKMLColor(iconColor);
          folderStyles.set(styleId, color);
          console.log(`  ✅ Added folder style: ${styleId} -> ${color}`);
        }
      });
    }
    
    const folderId = this.generateId();
    const folderColor = this.getColorFromStyleUrl(folder.styleUrl?.[0], folderStyles);
    const folderObj: Folder = {
      id: folderId,
      name: folder.name?.[0] || 'Untitled Folder',
      color: folderColor,
      icon: 'folder',
      visible: true,
      parentId,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    folders.push(folderObj);
    
    // Parse placemarks in this folder using the folder-specific styles
    if (folder.Placemark) {
      folder.Placemark.forEach(placemark => {
        const marker = this.parsePlacemark(placemark, folderId, folderStyles);
        if (marker) {
          markers.push(marker);
        }
      });
    }
    
    // Parse nested folders
    if (folder.Folder) {
      folder.Folder.forEach(nestedFolder => {
        const result = this.parseFolder(nestedFolder, folderId, folderStyles);
        folders.push(...result.folders);
        markers.push(...result.markers);
      });
    }
    
    return { folders, markers };
  }

  static async parseKML(kmlContent: string): Promise<ParsedKML> {
    return new Promise((resolve, reject) => {
      parseString(kmlContent, (err, result) => {
        if (err) {
          reject(new Error(`Failed to parse KML: ${err.message}`));
          return;
        }
        
        try {
          console.group(`🔍 KML STRUCTURE ANALYSIS`);
          console.log(`📄 Raw KML structure:`, result);
          
          const kml = result.kml;
          if (!kml || !kml.Document) {
            reject(new Error('Invalid KML structure'));
            return;
          }
          
          const document = kml.Document[0] as KMLDocument;
          console.log(`📋 Document structure:`, document);
          
          // Let's examine the actual KML content to see the style definitions
          console.log(`🔍 Looking for all Style elements in document...`);
          if (document.Style) {
            console.log(`📋 Found ${document.Style.length} Style elements`);
            document.Style.forEach((style, index) => {
              console.log(`  Style ${index + 1}:`, {
                id: style.$?.id,
                hasIconStyle: !!style.IconStyle,
                iconStyle: style.IconStyle
              });
            });
          }
          
          console.groupEnd();
          
          const folders: Folder[] = [];
          const markers: Marker[] = [];
          
                // Parse styles first
                const styles = new Map<string, string>();
                if (document.Style) {
                  console.group(`🎨 PARSING DOCUMENT STYLES`);
                  console.log(`📋 Found ${document.Style.length} document-level styles`);
                  
                  document.Style.forEach((style, index) => {
                    const styleId = style.$?.id;
                    if (styleId && style.IconStyle?.[0]?.color?.[0]) {
                      const color = this.parseKMLColor(style.IconStyle[0].color[0]);
                      styles.set(styleId, color);
                      console.log(`  Style ${index + 1}: ${styleId} -> ${color}`);
                    } else {
                      console.log(`  Style ${index + 1}: ${styleId} - NO COLOR FOUND`);
                    }
                  });
                  
                  console.log(`✅ Total document styles parsed: ${styles.size}`);
                  console.groupEnd();
                } else {
                  console.log(`❌ No document-level styles found`);
                }
                
                console.log(`Total styles parsed: ${styles.size}`);
          
          // Create root folder if document has a name
          const rootFolderId = this.generateId();
          const rootFolder: Folder = {
            id: rootFolderId,
            name: document.name?.[0] || 'Imported Markers',
            color: '#ffffff', // Default color for root folder
            icon: 'folder',
            visible: true,
            order: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          folders.push(rootFolder);
          
          // Parse top-level placemarks
          if (document.Placemark) {
            console.group(`📍 PARSING TOP-LEVEL PLACEMARKS`);
            console.log(`📋 Found ${document.Placemark.length} top-level placemarks`);
            console.groupEnd();
            
            document.Placemark.forEach(placemark => {
              const marker = this.parsePlacemark(placemark, rootFolderId, styles);
              if (marker) {
                markers.push(marker);
              }
            });
          }
          
          // Parse folders
          if (document.Folder) {
            console.group(`📁 PARSING FOLDERS`);
            console.log(`📋 Found ${document.Folder.length} folders`);
            console.groupEnd();
            
            document.Folder.forEach(folder => {
              const result = this.parseFolder(folder, undefined, styles);
              folders.push(...result.folders);
              markers.push(...result.markers);
            });
          }
          
          resolve({
            folders,
            markers,
            images: [], // Images will be handled separately
            imageFiles: {}, // Will be populated by parseKMLWithImages
          });
          
          // FINAL SUMMARY
          console.group(`📊 PARSING SUMMARY`);
          console.log(`📁 Folders created: ${folders.length}`);
          console.log(`📍 Markers created: ${markers.length}`);
          console.log(`🎨 Unique colors found:`, [...new Set(markers.map(m => m.color))]);
          console.log(`🔍 Color distribution:`, markers.reduce((acc, m) => {
            acc[m.color] = (acc[m.color] || 0) + 1;
            return acc;
          }, {} as Record<string, number>));
          console.groupEnd();
        } catch (error) {
          reject(new Error(`Failed to process KML data: ${error}`));
        }
      });
    });
  }

  static async parseKMZFile(file: File): Promise<ParsedKML> {
    // For now, we'll handle KML files only
    // KMZ support would require JSZip to extract the KML from the ZIP
    const text = await file.text();
    return this.parseKML(text);
  }

  static async parseKMLWithImages(kmlFile: File, imageFiles: File[]): Promise<ParsedKML> {
    const kmlResult = await this.parseKML(await kmlFile.text());
    
    // Convert image files to base64
    const imageBase64Map: { [filename: string]: string } = {};
    
    console.log(`🖼️ Converting ${imageFiles.length} images to base64...`);
    
    for (const file of imageFiles) {
      if (file.type.startsWith('image/')) {
        try {
          const base64 = await this.fileToBase64(file);
          imageBase64Map[file.name] = base64;
          console.log(`  ✅ Converted: ${file.name}`);
        } catch (error) {
          console.error(`  ❌ Failed to convert ${file.name}:`, error);
        }
      }
    }
    
    console.log(`✅ Converted ${Object.keys(imageBase64Map).length} images to base64`);
    
    return {
      ...kmlResult,
      markers: kmlResult.markers,
      imageFiles: imageBase64Map
    };
  }

  private static fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }
}
