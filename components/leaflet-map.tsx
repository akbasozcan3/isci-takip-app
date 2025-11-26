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
  // Türkiye merkez koordinatları - varsayılan olarak kullan
  const TURKEY_CENTER = { lat: 39.0, lng: 35.2433 };
  const defaultLat = centerLat || TURKEY_CENTER.lat;
  const defaultLng = centerLng || TURKEY_CENTER.lng;
  
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
        // Türkiye merkezli harita - Profesyonel GPS takip
        const map = L.map('map').setView([${defaultLat}, ${defaultLng}], ${defaultLat === TURKEY_CENTER.lat && defaultLng === TURKEY_CENTER.lng ? '6' : '16'});
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
          maxZoom: 19, 
          minZoom: 5,
          attribution: '© OpenStreetMap | Türkiye Harita' 
        }).addTo(map);
        
        // Türkiye sınırlarına odaklan (eğer merkez Türkiye ise)
        if (${defaultLat === TURKEY_CENTER.lat && defaultLng === TURKEY_CENTER.lng ? 'true' : 'false'}) {
          map.fitBounds([[36.0, 26.0], [42.0, 45.0]], { padding: [20, 20] });
        }
        let marker = null;
        function setMarker(lat, lng) {
          if (marker) { marker.setLatLng([lat, lng]); }
          else { marker = L.marker([lat, lng]).addTo(map); }
        }
        // Initial marker - Türkiye merkezli
        setMarker(${defaultLat}, ${defaultLng});
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
  `, [defaultLat, defaultLng]);

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


