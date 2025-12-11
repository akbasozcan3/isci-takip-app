import { authFetch } from './auth';

export interface MapFeatures {
  realtimeTracking: boolean;
  advancedLayers: boolean;
  satelliteView: boolean;
  topographicView: boolean;
  exportMap: boolean;
  multipleGroups: boolean;
  geofencing: boolean;
  routeOptimization: boolean;
  heatmap: boolean;
  customMarkers: boolean;
  maxZoom: number;
  maxMarkers: number;
  maxRoutes: number;
}

export interface MapLayer {
  name: string;
  url: string;
  available: boolean;
}

let cachedFeatures: MapFeatures | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000;

export async function getMapFeatures(): Promise<MapFeatures> {
  const now = Date.now();
  if (cachedFeatures && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedFeatures;
  }

  try {
    const response = await authFetch('/map/features');
    if (response.ok) {
      const data = await response.json();
      cachedFeatures = data.data || data;
      cacheTimestamp = now;
      return cachedFeatures;
    }
  } catch (error) {
    console.error('getMapFeatures error:', error);
  }

  return {
    realtimeTracking: false,
    advancedLayers: false,
    satelliteView: false,
    topographicView: false,
    exportMap: false,
    multipleGroups: false,
    geofencing: false,
    routeOptimization: false,
    heatmap: false,
    customMarkers: false,
    maxZoom: 18,
    maxMarkers: 20,
    maxRoutes: 20
  };
}

export async function getMapLayers(): Promise<Record<string, MapLayer>> {
  try {
    const response = await authFetch('/map/layers');
    if (response.ok) {
      const data = await response.json();
      return data.data || data;
    }
  } catch (error) {
    console.error('getMapLayers error:', error);
  }

  return {
    standard: {
      name: 'OpenStreetMap',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      available: true
    },
    dark: {
      name: 'Koyu Tema',
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      available: false
    },
    satellite: {
      name: 'Uydu',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      available: false
    },
    topographic: {
      name: 'Topografik',
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      available: false
    }
  };
}

export async function exportMap(bounds: any, format: string = 'png', markers: any[] = [], routes: any[] = []): Promise<{ exportId: string; format: string; estimatedTime: string }> {
  try {
    const response = await authFetch('/map/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bounds, format, markers, routes })
    });

    if (response.ok) {
      const data = await response.json();
      return data.data || data;
    } else {
      const error = await response.json();
      throw new Error(error.error || 'Map export failed');
    }
  } catch (error) {
    console.error('exportMap error:', error);
    throw error;
  }
}

