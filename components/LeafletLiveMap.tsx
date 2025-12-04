import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export type LiveMarker = {
  lat: number;
  lng: number;
  title?: string;
  color?: string; // css color for marker icon
};

interface LeafletLiveMapProps {
  center: { lat: number; lng: number };
  markers: LiveMarker[];
  radiusMeters?: number; // optional geofence circle
  height?: number;
}

export default function LeafletLiveMap({ center, markers, radiusMeters = 150, height = 300 }: LeafletLiveMapProps) {
  // Türkiye merkez koordinatları - varsayılan olarak kullan
  const TURKEY_CENTER = { lat: 39.0, lng: 35.2433 };
  const defaultCenter = center || TURKEY_CENTER;
  const isTurkeyCenter = defaultCenter.lat === TURKEY_CENTER.lat && defaultCenter.lng === TURKEY_CENTER.lng;
  
  const html = React.useMemo(() => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        html, body, #map { height: 100%; margin: 0; padding: 0; background:#020617; }
        .leaflet-container { background: #050816; }
        #map {
          position: relative;
          box-shadow: inset 0 0 40px rgba(0,0,0,0.6);
        }
        #map::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(circle at 20% 25%, rgba(59,130,246,0.15), transparent 45%),
                      radial-gradient(circle at 80% 70%, rgba(147,51,234,0.2), transparent 40%);
        }
        .marker-title { font-weight: 700; font-size: 12px; color:#e2e8f0; }
        .pulse-dot {
          animation: pulse 2.4s infinite;
        }
        @keyframes pulse {
          0% { filter: drop-shadow(0 0 4px rgba(14,165,233,0.9)); }
          50% { filter: drop-shadow(0 0 14px rgba(236,72,153,0.9)); }
          100% { filter: drop-shadow(0 0 4px rgba(14,165,233,0.9)); }
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        // Türkiye merkezli canlı harita - Profesyonel GPS takip
        const map = L.map('map', { zoomControl: true }).setView([${defaultCenter.lat}, ${defaultCenter.lng}], ${isTurkeyCenter ? '6' : '15'});
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { 
          maxZoom: 20, 
          minZoom: 4,
          subdomains: 'abcd',
          attribution: '© OpenStreetMap contributors | © CARTO' 
        }).addTo(map);
        
        // Türkiye sınırlarına odaklan (eğer merkez Türkiye ise)
        if (${isTurkeyCenter ? 'true' : 'false'}) {
          map.fitBounds([[36.0, 26.0], [42.0, 45.0]], { padding: [20, 20] });
        }

        // Geofence circle - Türkiye merkezli
        const radius = ${Math.max(50, Number(radiusMeters) || 150)};
        const center = L.latLng(${defaultCenter.lat}, ${defaultCenter.lng});
        L.circle(center, { radius: radius, color: 'rgba(14,165,233,0.6)', weight: 2, fillColor: 'rgba(14,165,233,0.15)', fillOpacity: 0.7 }).addTo(map);
        L.circleMarker(center, { radius: 9, color: '#22d3ee', weight: 2, fillColor: '#22d3ee', fillOpacity: 0.95, className: 'pulse-dot' }).addTo(map);

        // Markers array
        const markers = ${JSON.stringify(markers || [])};
        markers.forEach(function(m) {
          const color = m.color || '#f472b6';
          const pin = L.circleMarker([m.lat, m.lng], { radius: 8, color, fillColor: color, fillOpacity: 0.95, weight: 2, className: 'pulse-dot' });
          var title = (m.title && String(m.title)) || 'Üye';
          pin.bindTooltip('<div class="marker-title">' + title + '</div>', { permanent: false });
          pin.addTo(map);
        });

        // Fit bounds if we have many points
        const all = [center, ...markers.map(x => L.latLng(x.lat, x.lng))];
        if (all.length > 1) {
          const bounds = L.latLngBounds(all);
          map.fitBounds(bounds.pad(0.2), { animate: true });
        }
      </script>
    </body>
  </html>
  `, [defaultCenter.lat, defaultCenter.lng, JSON.stringify(markers), radiusMeters]);

  return (
    <View style={[styles.container, { height }]}> 
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        scalesPageToFit
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
});
