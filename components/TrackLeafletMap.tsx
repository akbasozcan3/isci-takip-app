import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface TrackLeafletMapProps {
  center: { lat: number; lng: number };
  path: Array<{ latitude: number; longitude: number }>;
  markers: Array<{
    id: string;
    lat: number;
    lng: number;
    title?: string;
    color?: string;
    heading?: number | null;
    speed?: number | null;
    isOnline?: boolean;
    activity?: string;
    activityIcon?: string;
    isVehicle?: boolean;
  }>;
  groupCenter?: { lat: number; lng: number } | null;
  accuracy?: number | null;
  height?: number;
  onMapReady?: () => void;
  onRegionChange?: (region: { lat: number; lng: number; zoom: number }) => void;
}

export default function TrackLeafletMap({
  center,
  path = [],
  markers = [],
  groupCenter = null,
  accuracy = null,
  height = 420,
  onMapReady,
  onRegionChange,
}: TrackLeafletMapProps) {
  const TURKEY_CENTER = { lat: 39.0, lng: 35.2433 };
  const defaultCenter = center || TURKEY_CENTER;
  const isTurkeyCenter = defaultCenter.lat === TURKEY_CENTER.lat && defaultCenter.lng === TURKEY_CENTER.lng;

  const html = React.useMemo(() => {
    const pathCoords = path.map(p => [p.latitude, p.longitude]);
    const allMarkers = [
      ...markers,
      ...(groupCenter ? [{ id: 'group-center', lat: groupCenter.lat, lng: groupCenter.lng, color: '#ef4444', title: 'Grup Merkezi' }] : [])
    ];

    return `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; margin: 0; padding: 0; background:#0f172a; }
      .leaflet-container { background: #030712; }
      #map {
        position: relative;
        box-shadow: inset 0 0 40px rgba(15,23,42,0.85);
      }
      .pulse-dot {
        animation: pulse 2s infinite;
      }
      @keyframes pulse {
        0%, 100% { filter: drop-shadow(0 0 6px rgba(14,165,233,0.8)); }
        50% { filter: drop-shadow(0 0 16px rgba(236,72,153,0.9)); }
      }
      .marker-title { 
        font-weight: 700; 
        font-size: 12px; 
        color:#e2e8f0; 
        text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      }
      .speed-badge {
        background: rgba(15,23,42,0.95);
        color: #38bdf8;
        padding: 2px 6px;
        border-radius: 6px;
        font-size: 10px;
        font-weight: 900;
        border: 2px solid #38bdf8;
        margin-top: 4px;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const map = L.map('map', { zoomControl: true }).setView([${defaultCenter.lat}, ${defaultCenter.lng}], ${isTurkeyCenter ? '6' : '15'});
      
      const baseLayers = {
        'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          minZoom: 4,
          subdomains: ['a', 'b', 'c'],
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          tileSize: 256,
          zoomOffset: 0
        }),
        'Koyu Tema': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          minZoom: 4,
          subdomains: 'abcd',
          attribution: '© OpenStreetMap contributors | © CARTO'
        }),
        'Uydu': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          minZoom: 4,
          attribution: '© Esri'
        }),
        'Topografik': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
          maxZoom: 17,
          minZoom: 4,
          subdomains: ['a', 'b', 'c'],
          attribution: '© <a href="https://opentopomap.org">OpenTopoMap</a> contributors'
        })
      };
      
      baseLayers['OpenStreetMap'].addTo(map);
      
      L.control.layers(baseLayers, {}, {
        position: 'topright',
        collapsed: true
      }).addTo(map);

      if (${isTurkeyCenter ? 'true' : 'false'}) {
        map.fitBounds([[36.0, 26.0], [42.0, 45.0]], { padding: [20, 20] });
      }

      // Path polyline
      const pathCoords = ${JSON.stringify(pathCoords)};
      if (pathCoords.length > 1) {
        L.polyline(pathCoords, {
          color: '#38bdf8',
          weight: 4,
          opacity: 0.8,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(map);
      }

      // Accuracy circle
      const accuracy = ${accuracy || 'null'};
      if (accuracy && accuracy > 0) {
        const center = L.latLng(${defaultCenter.lat}, ${defaultCenter.lng});
        L.circle(center, {
          radius: Math.min(accuracy, 200),
          color: 'rgba(14,165,233,0.4)',
          weight: 2,
          fillColor: 'rgba(14,165,233,0.1)',
          fillOpacity: 0.3
        }).addTo(map);
        L.circle(center, {
          radius: Math.min(accuracy * 0.6, 120),
          color: 'rgba(14,165,233,0.6)',
          weight: 2,
          fillColor: 'rgba(14,165,233,0.2)',
          fillOpacity: 0.4
        }).addTo(map);
      }

      // Markers
      const markers = ${JSON.stringify(allMarkers)};
      const markerLayers = {};
      
      const activityIcons = {
        'home': '🏠',
        'stationary': '📍',
        'walking': '🚶',
        'cycling': '🚴',
        'motorcycle': '🏍️',
        'driving': '🚗'
      };
      
      markers.forEach(function(m) {
        const color = m.color || (m.isOnline ? '#10b981' : '#64748b');
        const heading = m.heading || null;
        const speed = m.speed || null;
        const activityIcon = m.activityIcon || (m.activity ? activityIcons[m.activity] : null) || '📍';
        const isUserMarker = m.id === 'user';
        
        let iconHtml = '';
        if (m.id === 'group-center') {
          iconHtml = '<div style="background: #ef4444; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.4);"><span style="color: #fff; font-size: 18px;">🏁</span></div>';
        } else if (m.activity && (isUserMarker || m.activityIcon)) {
          const iconToUse = m.activityIcon || activityIcon;
          iconHtml = '<div style="background: ' + color + '; width: ' + (isUserMarker ? '42' : '36') + 'px; height: ' + (isUserMarker ? '42' : '36') + 'px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.6);' + (heading ? ' transform: rotate(' + heading + 'deg);' : '') + '" class="pulse-dot"><span style="color: #fff; font-size: ' + (isUserMarker ? '24' : '20') + 'px; font-weight: bold;">' + iconToUse + '</span></div>';
        } else if (heading !== null) {
          iconHtml = '<div style="background: ' + color + '; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.4); transform: rotate(' + heading + 'deg);"><span style="color: #fff; font-size: 20px;">🧭</span></div>';
        } else {
          iconHtml = '<div style="background: ' + color + '; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.4);" class="pulse-dot"><span style="color: #fff; font-size: 18px;">' + activityIcon + '</span></div>';
        }
        
        const icon = L.divIcon({
          html: iconHtml + (speed ? '<div class="speed-badge">' + Math.round(speed) + ' km/h</div>' : ''),
          className: 'custom-marker' + (isUserMarker ? ' pulse-dot' : ''),
          iconSize: isUserMarker ? [46, speed ? 56 : 46] : [40, speed ? 50 : 40],
          iconAnchor: isUserMarker ? [23, speed ? 53 : 23] : [20, speed ? 45 : 20]
        });
        
        const marker = L.marker([m.lat, m.lng], { icon: icon });
        
        if (m.title) {
          const activityText = m.activity ? 
            (m.activity === 'home' ? 'Ev' :
             m.activity === 'stationary' ? 'Duruyor' : 
             m.activity === 'walking' ? 'Yürüyor' : 
             m.activity === 'cycling' ? 'Bisiklet' : 
             m.activity === 'motorcycle' ? 'Motor' : 
             m.activity === 'driving' ? 'Araba' : m.activity) : '';
          const popupContent = '<div class="marker-title">' + m.title + '</div>' + 
            (activityText ? '<div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Aktivite: ' + activityText + '</div>' : '');
          marker.bindTooltip(popupContent, { permanent: false });
        }
        
        marker.addTo(map);
        markerLayers[m.id] = marker;
      });

      // Fit bounds
      const allPoints = [
        [${defaultCenter.lat}, ${defaultCenter.lng}],
        ...pathCoords,
        ...markers.map(m => [m.lat, m.lng])
      ];
      if (allPoints.length > 1) {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds.pad(0.1), { animate: true, maxZoom: 18 });
      }

      map.on('moveend', function() {
        const center = map.getCenter();
        const zoom = map.getZoom();
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'regionChange',
            lat: center.lat,
            lng: center.lng,
            zoom: zoom
          }));
        }
      });

      map.whenReady(function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
        }
      });

      // Update marker positions
      function updateMarker(id, lat, lng, heading, speed) {
        if (markerLayers[id]) {
          markerLayers[id].setLatLng([lat, lng]);
          if (heading !== null) {
            const icon = markerLayers[id].getIcon();
            if (icon && icon.options) {
              const color = icon.options.html.includes('#10b981') ? '#10b981' : '#38bdf8';
              const iconHtml = '<div style="background: ' + color + '; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.4); transform: rotate(' + heading + 'deg);"><span style="color: #fff; font-size: 20px;">🧭</span></div>';
              markerLayers[id].setIcon(L.divIcon({
                html: iconHtml + (speed ? '<div class="speed-badge">' + Math.round(speed) + '</div>' : ''),
                className: 'custom-marker',
                iconSize: [40, speed ? 50 : 40],
                iconAnchor: [20, speed ? 45 : 20]
              }));
            }
          }
        }
      }

      window.updateMarker = updateMarker;
      window.updatePath = function(newPath) {
        map.eachLayer(function(layer) {
          if (layer instanceof L.Polyline && layer !== map) {
            map.removeLayer(layer);
          }
        });
        if (newPath.length > 1) {
          L.polyline(newPath, {
            color: '#38bdf8',
            weight: 4,
            opacity: 0.8,
            lineJoin: 'round',
            lineCap: 'round'
          }).addTo(map);
        }
      };
    </script>
  </body>
</html>
    `;
  }, [defaultCenter.lat, defaultCenter.lng, JSON.stringify(path), JSON.stringify(markers), groupCenter, accuracy]);

  const handleMessage = React.useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'mapReady' && onMapReady) {
        onMapReady();
      } else if (data.type === 'regionChange' && onRegionChange) {
        onRegionChange({ lat: data.lat, lng: data.lng, zoom: data.zoom });
      }
    } catch {}
  }, [onMapReady, onRegionChange]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        scalesPageToFit
        style={{ backgroundColor: '#0f172a' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
});

