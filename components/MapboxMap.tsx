'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import Map, { ViewState } from 'react-map-gl';
import { useMapStore } from '../store/mapStore';
import { Marker } from '../lib/db';
import { MapPin, Plus, Navigation, ChevronDown } from 'lucide-react';
import mapboxgl from 'mapbox-gl';

interface MapboxMapProps {
  onAddMarker?: (lngLat: { lng: number; lat: number }) => void;
}

const MapboxMap: React.FC<MapboxMapProps> = ({ onAddMarker }) => {
  const mapRef = useRef<any>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const {
    viewState,
    setViewState,
    markers,
    folders,
    mapStyle,
    setMapStyle,
    selectedMarker,
    setSelectedMarker,
    selectedFolderId,
    setSelectedFolderId,
    addMarker,
    deleteMarker,
  } = useMapStore();

  const [isAddingMarker, setIsAddingMarker] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentLocationMarker, setCurrentLocationMarker] = useState<mapboxgl.Marker | null>(null);

  const handleMapClick = useCallback((event: any) => {
    if (isAddingMarker && onAddMarker) {
      const { lng, lat } = event.lngLat;
      onAddMarker({ lng, lat });
      setIsAddingMarker(false);
    }
  }, [isAddingMarker, onAddMarker]);

  const handleViewStateChange = useCallback((evt: { viewState: ViewState }) => {
    setViewState(evt.viewState);
  }, [setViewState]);

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

  // Get user's location immediately on component mount
  useEffect(() => {
    if (navigator.geolocation) {
      console.log('Requesting user location...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lng = position.coords.longitude;
          const lat = position.coords.latitude;
          
          console.log('Got user location:', { lng, lat });
          setViewState({
            longitude: lng,
            latitude: lat,
            zoom: 12
          });
        },
        (error) => {
          console.log('Geolocation failed:', error.message);
          console.log('Keeping default center of US location');
          // Keep the default center of US location that's already set in the store
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000 // 1 minute
        }
      );
    } else {
      console.log('Geolocation not supported');
    }
  }, [setViewState]);

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

  // Update markers on the map
  const updateMarkers = useCallback(() => {
    if (!mapRef.current || !mapLoaded) {
      return;
    }

    const map = mapRef.current.getMap();
    
    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Filter visible markers
    const visibleMarkers = markers.filter(marker => {
      const folder = folders.find(f => f.id === marker.folderId);
      if (!folder) return true;
      return folder.visible !== false;
    });

    // Add new markers with stable positioning
    visibleMarkers.forEach(marker => {
      const el = createMarkerElement(marker);
      
      // Create marker with stable positioning
      const mapboxMarker = new mapboxgl.Marker({
        element: el,
        anchor: 'bottom'
      })
        .setLngLat([marker.longitude, marker.latitude])
        .addTo(map);
      
      // Store marker reference
      markersRef.current.push(mapboxMarker);
    });

  }, [markers, folders, mapLoaded, createMarkerElement]);

  // Update markers when marker data or folder visibility changes
  useEffect(() => {
    if (mapLoaded) {
      updateMarkers();
    }
  }, [markers, folders, mapLoaded, updateMarkers]);

  // Initial marker load when map becomes ready
  useEffect(() => {
    if (mapLoaded && markers.length > 0) {
      updateMarkers();
    }
  }, [mapLoaded, updateMarkers]);


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
        
        // Remove existing current location marker
        if (currentLocationMarker) {
          currentLocationMarker.remove();
          setCurrentLocationMarker(null);
        }
        
        // Create temporary current location marker
        const map = mapRef.current?.getMap();
        if (map) {
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
          
          // Fly to location
          console.log('Flying to location');
          map.flyTo({
            center: [lng, lat],
            zoom: 15,
            duration: 2000
          });
        }
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
  ];

  return (
    <div className="relative w-full h-full min-h-0">
      <Map
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
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

      {/* Map Controls */}
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

      {/* Action Buttons */}
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

      {/* Zoom Controls */}
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

      {/* Adding Marker Indicator */}
      {isAddingMarker && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg">
          Click on map to add marker
        </div>
      )}
    </div>
  );
};

export default MapboxMap;
