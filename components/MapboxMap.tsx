'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import Map, { ViewState, MapRef } from 'react-map-gl';
import { useMapStore } from '../store/mapStore';
import { Marker } from '../lib/db';
import { Plus, Navigation, ChevronDown } from 'lucide-react';
import mapboxgl from 'mapbox-gl';

interface MapboxMapProps {
  onAddMarker?: (lngLat: { lng: number; lat: number }) => void;
}

const MapboxMap: React.FC<MapboxMapProps> = ({ onAddMarker }) => {
  const mapRef = useRef<MapRef | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const viewStateRef = useRef<any>(null); // Track viewState to avoid recreating callbacks
  const isProgrammaticMoveRef = useRef(false); // Track if move is programmatic
  const {
    viewState,
    setViewState,
    markers,
    folders,
    mapStyle,
    setMapStyle,
    setSelectedMarker,
    tagVisibility,
    filterMode,
  } = useMapStore();

  // Update ref when viewState changes
  useEffect(() => {
    viewStateRef.current = viewState;
  }, [viewState]);

  const [isAddingMarker, setIsAddingMarker] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentLocationMarker, setCurrentLocationMarker] = useState<mapboxgl.Marker | null>(null);
  const [shouldRenderMap, setShouldRenderMap] = useState(false);

  const handleMapClick = useCallback((event: { lngLat: { lng: number; lat: number } }) => {
    if (isAddingMarker && onAddMarker) {
      const { lng, lat } = event.lngLat;
      onAddMarker({ lng, lat });
      setIsAddingMarker(false);
    }
  }, [isAddingMarker, onAddMarker]);

  const handleViewStateChange = useCallback((evt: { viewState: ViewState }) => {
    // Skip updates during programmatic moves to prevent infinite loops
    if (isProgrammaticMoveRef.current) {
      return;
    }
    
    // Only update if the viewState has actually changed significantly
    const newViewState = evt.viewState;
    const current = viewStateRef.current; // Use ref to avoid dependency
    
    // Use larger thresholds to prevent unnecessary updates during smooth animations
    if (!current || 
      Math.abs(newViewState.longitude - current.longitude) > 0.001 ||
      Math.abs(newViewState.latitude - current.latitude) > 0.001 ||
      Math.abs(newViewState.zoom - current.zoom) > 0.1
    ) {
      setViewState(newViewState);
    }
  }, [setViewState]); // No longer depends on viewState, preventing infinite loop

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isDropdownOpen && !target.closest('.dropdown-container')) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Set user's location as initial view if they have granted permission
  useEffect(() => {
    if (shouldRenderMap) return;

    const checkLocationPermission = async () => {
      try {
        // Check if geolocation is supported
        if (!('geolocation' in navigator)) {
          console.log('Geolocation not supported, using default USA view');
          setShouldRenderMap(true);
          return;
        }

        let shouldTryLocation = false;

        // Check permission status if available
        if ('permissions' in navigator) {
          try {
            const permissionResult = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
            console.log('Geolocation permission status:', permissionResult.state);
            // Try to get location if granted or prompt (user hasn't seen prompt yet)
            shouldTryLocation = permissionResult.state === 'granted' || permissionResult.state === 'prompt';
          } catch (e) {
            // If permission API fails, try anyway
            console.log('Permission API query failed, will attempt geolocation anyway');
            shouldTryLocation = true;
          }
        } else {
          // No permissions API, try anyway
          shouldTryLocation = true;
        }

        if (shouldTryLocation) {
          console.log('Attempting to get user location for initial view...');
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const lng = position.coords.longitude;
              const lat = position.coords.latitude;
              
              console.log('Got user location for initial view:', { lng, lat });
              
              // Set the view state to user's location
              setViewState({
                longitude: lng,
                latitude: lat,
                zoom: 15,
                bearing: 0,
                pitch: 0
              });
              
              setShouldRenderMap(true);
            },
            (error) => {
              console.log('Geolocation failed:', error.message);
              console.log('Using default center of US location');
              setShouldRenderMap(true);
            },
            {
              enableHighAccuracy: false, // Use false for faster response on mobile
              timeout: 8000, // Give more time on mobile
              maximumAge: 300000 // Allow 5 minute old cached locations for faster response
            }
          );
        } else {
          console.log('Location permission denied, using default USA view');
          setShouldRenderMap(true);
        }
      } catch (error) {
        console.log('Error checking location permission:', error);
        setShouldRenderMap(true);
      }
    };

    checkLocationPermission();
  }, [setViewState]); // Removed shouldRenderMap from dependencies to prevent infinite loop

  // Create marker element
  const createMarkerElement = useCallback((marker: Marker) => {
    const el = document.createElement('div');
    el.className = 'marker';
    el.style.cssText = `
      width: 20px;
      height: 20px;
      position: absolute;
      transform-origin: center bottom;
      will-change: transform;
    `;
    
    // Check if this is a current location marker
    const isCurrentLocation = marker.id.startsWith('current-location-');
    
    if (isCurrentLocation) {
      // iPhone-style current location marker
      el.style.cssText = `
        width: 20px;
        height: 20px;
        position: absolute;
        transform-origin: center;
        will-change: transform;
      `;
      
      // Create the blue circle
      const circle = document.createElement('div');
      circle.style.cssText = `
        width: 20px;
        height: 20px;
        background-color: #007AFF;
        border: 3px solid white;
        border-radius: 50%;
        position: absolute;
        top: 0;
        left: 0;
        z-index: 2;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      `;
      
      el.appendChild(circle);
      
      el.title = marker.title;
      
      // Don't add click handlers for current location marker
      return el;
    } else {
      // Regular teardrop marker
      // Create circle (top part)
      const circle = document.createElement('div');
      circle.style.cssText = `
        width: 16px;
        height: 16px;
        background-color: ${marker.color};
        border-radius: 50%;
        position: absolute;
        top: 0;
        left: 2px;
        z-index: 2;
      `;
      
      // Create triangle (bottom part)
      const triangle = document.createElement('div');
      triangle.style.cssText = `
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 8px solid ${marker.color};
        position: absolute;
        top: 12px;
        left: 4px;
        z-index: 1;
      `;
      
      el.appendChild(circle);
      el.appendChild(triangle);
      el.title = marker.title;
      
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedMarker(marker);
      });
      
      // Use opacity instead of transform to avoid positioning issues
      el.addEventListener('mouseenter', () => {
        el.style.opacity = '0.8';
        el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
      });
      
      el.addEventListener('mouseleave', () => {
        el.style.opacity = '1';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
      });
      
      return el;
    }
  }, [setSelectedMarker]);

  // Add user's current location marker on page load if permission granted
  useEffect(() => {
    const addInitialLocationMarker = async () => {
      if (!mapLoaded || currentLocationMarker) return;

      try {
        // Check if geolocation is supported
        if (!('geolocation' in navigator)) {
          console.log('Geolocation not supported');
          return;
        }

        const map = mapRef.current?.getMap();
        if (!map) return;

        let shouldTryLocation = false;

        // Check permission status if available
        if ('permissions' in navigator) {
          try {
            const permissionResult = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
            console.log('Geolocation permission status for marker:', permissionResult.state);
            // Try to get location if granted or prompt (user hasn't seen prompt yet)
            shouldTryLocation = permissionResult.state === 'granted' || permissionResult.state === 'prompt';
          } catch (e) {
            // If permission API fails, try anyway
            console.log('Permission API query failed, will attempt geolocation anyway');
            shouldTryLocation = true;
          }
        } else {
          // No permissions API, try anyway
          shouldTryLocation = true;
        }

        if (shouldTryLocation) {
          console.log('Attempting to get location for current location marker...');
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const lng = position.coords.longitude;
              const lat = position.coords.latitude;
              
              console.log('Adding current location marker:', { lng, lat });
              
              // Create temporary current location marker
              const locationEl = document.createElement('div');
              locationEl.style.cssText = `
                width: 20px;
                height: 20px;
                background-color: #007AFF;
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              `;
              
              const marker = new mapboxgl.Marker({
                element: locationEl,
                anchor: 'center'
              })
                .setLngLat([lng, lat])
                .addTo(map);
              
              setCurrentLocationMarker(marker);
            },
            (error) => {
              // Silently handle - user can still use the location button
              console.log('Could not get location for marker (non-critical):', error.code, error.message || 'Permission or timeout');
            },
            {
              enableHighAccuracy: false, // Use false for faster response on mobile
              timeout: 8000, // Give more time on mobile
              maximumAge: 300000 // Allow 5 minute old cached locations for faster response
            }
          );
        } else {
          console.log('Location permission denied, not showing location marker');
        }
      } catch (error) {
        console.log('Error checking location permission for marker:', error);
      }
    };

    addInitialLocationMarker();
  }, [mapLoaded, currentLocationMarker]);

  // Update markers on the map
  const updateMarkers = useCallback(() => {
    console.log('🗺️ MAP - updateMarkers called, markers:', markers.length, 'mapLoaded:', mapLoaded);
    
    if (!mapRef.current || !mapLoaded) {
      console.log('🗺️ MAP - Map not ready, skipping');
      return;
    }

    const map = mapRef.current.getMap();
    
    // Clear existing markers (but keep current location marker)
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Filter visible markers based on filter mode
    const visibleMarkers = markers.filter(marker => {
      const folder = folders.find(f => f.id === marker.folderId);
      const folderVisible = folder ? folder.visible !== false : true;
      
      const hasTags = marker.tags && marker.tags.length > 0;
      const hasVisibleTag = hasTags && marker.tags!.some(tag => tagVisibility[tag] !== false);
      
      if (filterMode === 'folders') {
        // Folders Only: ignore tags, respect folder visibility
        return folderVisible;
      } else if (filterMode === 'tags') {
        // Tags Only: ignore folders, respect tag visibility
        if (!hasTags) {
          return false; // Hide markers without tags in Tags Only mode
        }
        return hasVisibleTag; // Show if at least one tag is visible
      } else {
        // Both: must satisfy BOTH conditions
        return folderVisible && (hasVisibleTag || !hasTags);
      }
    });

    console.log('🗺️ MAP - Adding', visibleMarkers.length, 'visible markers');
    console.log('🗺️ MAP - First marker coords:', visibleMarkers[0] ? `${visibleMarkers[0].longitude}, ${visibleMarkers[0].latitude}` : 'none');

    // Add new markers
    visibleMarkers.forEach((marker) => {
      const el = createMarkerElement(marker);
      console.log('🗺️ MAP - Creating marker element for:', marker.id, 'Element:', el);
      
      const mapboxMarker = new mapboxgl.Marker({
        element: el,
        anchor: 'bottom'
      })
        .setLngLat([marker.longitude, marker.latitude])
        .addTo(map);
      
      console.log('🗺️ MAP - Mapbox marker created:', mapboxMarker);
      markersRef.current.push(mapboxMarker);
    });

    console.log('🗺️ MAP - Total markers on map:', markersRef.current.length);

  }, [markers, folders, tagVisibility, filterMode, mapLoaded, createMarkerElement]);

  // Update markers when marker data, folder visibility, tag visibility, or filter mode changes
  useEffect(() => {
    if (mapLoaded) {
      updateMarkers();
    }
  }, [markers, folders, tagVisibility, filterMode, mapLoaded, updateMarkers]);


  const handleZoomIn = useCallback(() => {
    if (mapRef.current) {
      const map = mapRef.current.getMap();
      map.zoomIn();
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (mapRef.current) {
      const map = mapRef.current.getMap();
      map.zoomOut();
    }
  }, []);

  const getCurrentLocation = useCallback(() => {
    console.log('Location button clicked');
    
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }
    
    if (!mapRef.current) {
      alert('Map not ready yet. Please try again.');
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lng = position.coords.longitude;
        const lat = position.coords.latitude;
        
        console.log('Got location:', { lng, lat });
        
        const map = mapRef.current?.getMap();
        if (!map) return;
        
        // Update existing marker if it exists, otherwise create new one
        if (currentLocationMarker) {
          // Update existing marker position
          currentLocationMarker.setLngLat([lng, lat]);
        } else {
          // Create new current location marker
          const locationEl = document.createElement('div');
          locationEl.style.cssText = `
            width: 20px;
            height: 20px;
            background-color: #007AFF;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          `;
          
          const marker = new mapboxgl.Marker({
            element: locationEl,
            anchor: 'center'
          })
            .setLngLat([lng, lat])
            .addTo(map);
          
          setCurrentLocationMarker(marker);
        }
        
        // Fly to location (set flag to prevent state updates during animation)
        console.log('Flying to location');
        isProgrammaticMoveRef.current = true;
        
        map.flyTo({
          center: [lng, lat],
          zoom: 15,
          duration: 2000
        });
        
        // Clear flag after animation completes
        setTimeout(() => {
          isProgrammaticMoveRef.current = false;
        }, 2100); // Slightly longer than animation duration
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please check your browser permissions.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, [currentLocationMarker]);

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

  return (
    <div className="relative w-full h-full min-h-0">
      {!shouldRenderMap ? (
        <div className="flex items-center justify-center h-full bg-gray-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading map...</p>
          </div>
        </div>
      ) : (
        <Map
          ref={mapRef}
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          // @ts-ignore - viewState type mismatch
          initialViewState={viewState}
          onMove={handleViewStateChange}
          onClick={handleMapClick}
          onLoad={handleMapLoad}
          style={{ width: '100%', height: '100%', minHeight: '100%' }}
          mapStyle={mapStyle}
          cursor={isAddingMarker ? 'crosshair' : 'default'}
        >
          {/* Markers are now handled by native Mapbox GL JS */}
        </Map>
      )}

      {/* Map Controls */}
      {shouldRenderMap && (
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          {/* Layer Switcher */}
          <div className="relative dropdown-container">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-sm border border-gray-600 hover:border-gray-500 transition-colors flex items-center gap-2 transition-all duration-200 ${
              isDropdownOpen ? 'w-max' : 'w-fit'
            }`}
          >
            <span>{mapStyles.find(s => s.id === mapStyle)?.name || 'Dark'}</span>
            <ChevronDown size={14} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 bg-black/90 backdrop-blur-sm rounded-lg border border-gray-600 shadow-lg z-50 w-max min-w-full max-w-[200px]">
              {mapStyles.map((style) => (
                <button
                  key={style.id}
                  onClick={() => {
                    setMapStyle(style.id);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-700/50 transition-colors first:rounded-t-lg last:rounded-b-lg whitespace-nowrap ${
                    mapStyle === style.id ? 'bg-blue-600/20 text-blue-300' : 'text-white'
                  }`}
                >
                  {style.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Action Buttons */}
      {shouldRenderMap && (
        <div className="absolute top-4 right-4 flex flex-col gap-2 mt-16">
        {/* Add Marker Button */}
        <button
          onClick={() => setIsAddingMarker(!isAddingMarker)}
          className={`w-10 h-10 flex items-center justify-center rounded-full backdrop-blur-sm transition-colors ${
            isAddingMarker
              ? 'bg-blue-600 text-white'
              : 'bg-black/80 text-white hover:bg-black/90'
          }`}
          title="Add Marker"
        >
          <Plus size={20} />
        </button>

        {/* Current Location Button */}
        <button
          onClick={getCurrentLocation}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-black/80 backdrop-blur-sm text-white hover:bg-black/90 transition-colors"
          title="Current Location"
        >
          <Navigation size={20} />
        </button>
      </div>
      )}

      {/* Zoom Controls */}
      {shouldRenderMap && (
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="p-3 rounded-full bg-black/80 backdrop-blur-sm text-white hover:bg-black/90 transition-colors"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="p-3 rounded-full bg-black/80 backdrop-blur-sm text-white hover:bg-black/90 transition-colors"
        >
          −
        </button>
      </div>
      )}

      {/* Adding Marker Indicator */}
      {shouldRenderMap && isAddingMarker && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg">
          Click on map to add marker
        </div>
      )}
    </div>
  );
};

export default MapboxMap;
