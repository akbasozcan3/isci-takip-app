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
        html, body, #map { height: 100%; margin: 0; padding: 0; background:#020617; }
        .leaflet-container { background: #030712; }
        #map {
          position: relative;
          box-shadow: inset 0 0 40px rgba(15,23,42,0.85);
        }
        #map::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(circle at 30% 20%, rgba(56,189,248,0.15), transparent 45%),
                      radial-gradient(circle at 70% 80%, rgba(147,51,234,0.1), transparent 40%);
        }
        .glow-pin {
          filter: drop-shadow(0 0 8px rgba(14,165,233,0.8));
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        // Türkiye merkezli harita - Profesyonel GPS takip
        const map = L.map('map').setView([${defaultLat}, ${defaultLng}], ${defaultLat === TURKEY_CENTER.lat && defaultLng === TURKEY_CENTER.lng ? '6' : '16'});
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
        
        // Türkiye sınırlarına odaklan (eğer merkez Türkiye ise)
        if (${defaultLat === TURKEY_CENTER.lat && defaultLng === TURKEY_CENTER.lng ? 'true' : 'false'}) {
          map.fitBounds([[36.0, 26.0], [42.0, 45.0]], { padding: [20, 20] });
        }
        let marker = null;
        function setMarker(lat, lng) {
          if (marker) { marker.setLatLng([lat, lng]); }
          else { 
            marker = L.circleMarker([lat, lng], { 
              radius: 9,
              color: '#38bdf8',
              weight: 2,
              fillColor: '#0ea5e9',
              fillOpacity: 0.9,
              className: 'glow-pin'
            }).addTo(map); 
          }
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
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});


