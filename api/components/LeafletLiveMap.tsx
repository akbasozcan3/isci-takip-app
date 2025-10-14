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
  const html = React.useMemo(() => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        html, body, #map { height: 100%; margin: 0; padding: 0; }
        .leaflet-container { background: #0f172a; }
        .marker-title { font-weight: 700; font-size: 12px; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        const map = L.map('map', { zoomControl: true }).setView([${center.lat}, ${center.lng}], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

        // Geofence circle
        const radius = ${Math.max(50, Number(radiusMeters) || 150)};
        const center = L.latLng(${center.lat}, ${center.lng});
        L.circle(center, { radius: radius, color: 'rgba(124,58,237,0.6)', weight: 2, fillColor: 'rgba(124,58,237,0.15)', fillOpacity: 0.6 }).addTo(map);
        L.marker(center, { title: 'Grup Merkezi' }).addTo(map);

        // Markers array
        const markers = ${JSON.stringify(markers || [])};
        markers.forEach(function(m) {
          const pin = L.circleMarker([m.lat, m.lng], { radius: 8, color: m.color || '#06b6d4', fillColor: m.color || '#06b6d4', fillOpacity: 0.9, weight: 2 });
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
  `, [center.lat, center.lng, JSON.stringify(markers), radiusMeters]);

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
