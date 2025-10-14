import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface LeafletMapProps {
  centerLat: number;
  centerLng: number;
  onSelect?: (lat: number, lng: number) => void;
  height?: number;
}

export default function LeafletMap({ centerLat, centerLng, onSelect, height = 200 }: LeafletMapProps) {
  const html = React.useMemo(() => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        html, body, #map { height: 100%; margin: 0; padding: 0; }
        .leaflet-container { background: #f6f9fb; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        const map = L.map('map').setView([${centerLat}, ${centerLng}], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
        let marker = null;
        function setMarker(lat, lng) {
          if (marker) { marker.setLatLng([lat, lng]); }
          else { marker = L.marker([lat, lng]).addTo(map); }
        }
        // Initial marker
        setMarker(${centerLat}, ${centerLng});
        map.on('click', function(e) {
          const lat = e.latlng.lat;
          const lng = e.latlng.lng;
          setMarker(lat, lng);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'select', lat, lng }));
          }
        });
      </script>
    </body>
  </html>
  `, [centerLat, centerLng]);

  const handleMessage = React.useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data && data.type === 'select' && onSelect) {
        onSelect(Number(data.lat), Number(data.lng));
      }
    } catch {}
  }, [onSelect]);

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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#e9eef3',
  },
});


