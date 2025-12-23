import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface LeafletMarker {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  icon?: string;
}

interface LeafletMapProps {
  centerLat: number;
  centerLng: number;
  onSelect?: (lat: number, lng: number) => void;
  height?: number;
  markers?: LeafletMarker[];
  fitToMarkers?: boolean;
  onReady?: () => void;
}

export default function LeafletMap({ centerLat, centerLng, onSelect, height = 200, markers = [], fitToMarkers = true, onReady }: LeafletMapProps) {
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
        .leaflet-control-zoom {
          background-color: #1e293b !important;
          border: 1px solid #334155 !important;
          border-radius: 8px !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
        }
        .leaflet-control-zoom a {
          color: #38bdf8 !important;
          background-color: #0f172a !important;
          border: 1px solid #334155 !important;
          font-weight: bold !important;
          font-size: 18px !important;
          width: 36px !important;
          height: 36px !important;
          line-height: 36px !important;
        }
        .leaflet-control-zoom a:hover {
          background-color: #1e293b !important;
          color: #0ea5e9 !important;
        }
        .leaflet-control-zoom-in {
          border-radius: 8px 8px 0 0 !important;
        }
        .leaflet-control-zoom-out {
          border-radius: 0 0 8px 8px !important;
          border-top: none !important;
        }
        /* If two zoom controls are rendered, hide the second one */
        .leaflet-control-zoom + .leaflet-control-zoom {
          display: none !important;
        }
        /* Add spacing so controls don't overlap and align nicely */
        .leaflet-top.leaflet-left .leaflet-control,
        .leaflet-top.leaflet-right .leaflet-control {
          margin-top: 120px !important;
        }
        .leaflet-control-zoom {
          display: flex !important;
          flex-direction: column;
          gap: 8px;
          padding: 6px !important;
        }
        .leaflet-control-zoom a {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin: 0 !important;
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
        
        // Zoom controls - visible and styled for dark theme
        L.control.zoom({ position: 'topleft' }).addTo(map);
        
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

        // layer to hold other markers
        const markerLayer = L.layerGroup().addTo(map);

        function clearMarkers() {
          markerLayer.clearLayers();
        }

        function addMarkers(list) {
          if (!list || !Array.isArray(list)) return;
          clearMarkers();
          const coords = [];
          list.forEach(m => {
            try {
              const lat = Number(m.lat);
              const lng = Number(m.lng);
              if (!isFinite(lat) || !isFinite(lng)) return;
              coords.push([lat, lng]);
              const circle = L.circleMarker([lat, lng], {
                radius: 9,
                color: m.color || '#0EA5E9',
                weight: 2,
                fillColor: m.color || '#0EA5E9',
                fillOpacity: 0.95
              });
              const title = (m.icon ? (m.icon + ' ') : '') + (m.label || '');
              circle.bindPopup(title);
              circle.addTo(markerLayer);
            } catch (e) { /* ignore malformed marker */ }
          });
          if (coords.length > 0 && ${fitToMarkers ? 'true' : 'false'}) {
            try {
              map.fitBounds(coords, { padding: [24,24], maxZoom: 16 });
            } catch (e) {}
          }
        }

        // Listen for messages from React Native to update markers or center
        function handleMessage(event) {
          try {
            const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (!payload || !payload.type) return;
            if (payload.type === 'markers') {
              addMarkers(payload.markers || []);
            } else if (payload.type === 'center') {
              const c = payload.center;
              if (c && c.lat && c.lng) map.setView([c.lat, c.lng], payload.zoom || map.getZoom());
            }
          } catch (e) { /* ignore */ }
        }

        // attach listeners for both webview message variants
        document.addEventListener('message', handleMessage);
        window.addEventListener('message', handleMessage);

        // initial markers from React Native via injected global variable
        try { if (window.__initialMarkers) addMarkers(window.__initialMarkers); } catch(e){}

        // notify RN that map finished initialising
        try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' })); } catch(e){}

        // Click -> send to RN
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

  const webviewRef = React.useRef<any>(null);

  const handleMessage = React.useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (!data) return;
      if (data.type === 'select' && onSelect) {
        onSelect(Number(data.lat), Number(data.lng));
      }
      if (data.type === 'ready') {
        try { onReady && onReady(); } catch(e){}
      }
    } catch {}
  }, [onSelect, onReady]);

  // send markers to webview whenever they change
  React.useEffect(() => {
    try {
      if (!webviewRef.current) return;
      const payload = JSON.stringify({ type: 'markers', markers });
      webviewRef.current.postMessage(payload);
    } catch (e) {
      // ignore
    }
  }, [markers]);

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
        ref={webviewRef}
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


