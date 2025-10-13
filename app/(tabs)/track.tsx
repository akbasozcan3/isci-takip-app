import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import React from 'react';
import {
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  Dimensions,
  Easing,
  LayoutAnimation,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import MapView, { Callout, Circle, Marker, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io, Socket } from 'socket.io-client';
import { Toast, useToast } from '../../components/Toast';
import { getApiBase } from '../../utils/api';
import { authFetch } from '../../utils/auth';

// NOTE: This file is a polished, compact redesign of your TrackScreen.
// - Uses a safe, non-hacky header (no negative margins)
// - Adds a modern gradient header with avatar + actions
// - Keeps your original logic intact, only cleans up styles & layout

const { width } = Dimensions.get('window');
const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK_v1';
const API_BASE = getApiBase();
const SERVER_PUSH_URL = `${API_BASE}/api/locations`;
// Grup adresi dinamik olarak gelecek

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  try {
    if (error) return console.error('BG task error', error);
    if (!data) return;
    const { locations } = data as any;
    for (const loc of locations || []) {
      const payload = {
        workerId: (await getWorkerIdFromStorageSafe()) || 'unknown',
        timestamp: loc.timestamp,
        coords: {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
          heading: loc.coords.heading,
          speed: loc.coords.speed,
        },
      };
      try {
        await fetch(SERVER_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.warn('BG upload failed', e);
      }
    }
  } catch (e) {
    console.error('Unhandled BG task error', e);
  }
});

async function getWorkerIdFromStorageSafe(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('workerId');
  } catch {
    return null;
  }
}

type Coord = { latitude: number; longitude: number };

type RemoteUser = { workerId: string; latitude: number; longitude: number };

interface ActiveGroup {
  id: string;
  code: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  memberCount: number;
  onlineCount: number;
  userRole: string;
  isAdmin: boolean;
}

interface GroupMember {
  userId: string;
  displayName: string;
  location: { lat: number; lng: number; timestamp: number } | null;
  isOnline: boolean;
}

export default function TrackScreen(): React.JSX.Element {
  const router = useRouter();
  const { toast, showError, showSuccess, showWarning, showInfo, hideToast } = useToast();
  const [profileName, setProfileName] = React.useState<string>('');
  // --- state & refs (kept your logic) ---
  const [hasPermission, setHasPermission] = React.useState<boolean | null>(null);
  const [bgPermission, setBgPermission] = React.useState<boolean>(false);
  const [isTracking, setIsTracking] = React.useState(false);
  const [coords, setCoords] = React.useState<Coord | null>(null);
  const [accuracyMeters, setAccuracyMeters] = React.useState<number | null>(null);
  const [heading, setHeading] = React.useState<number | null>(null);
  const [speedKmh, setSpeedKmh] = React.useState<number | null>(null);
  const [path, setPath] = React.useState<Coord[]>([]);
  const [mapType, setMapType] = React.useState<'standard' | 'hybrid'>('standard');
  const [follow, setFollow] = React.useState(true);
  const [totalDistance, setTotalDistance] = React.useState<number>(0);
  const [workerId, setWorkerId] = React.useState<string>('');
  const [displayName, setDisplayName] = React.useState<string>('');
  const [phone, setPhone] = React.useState<string>('');
  const [allUsers, setAllUsers] = React.useState<RemoteUser[]>([]);
  const [showAllUsers, setShowAllUsers] = React.useState(false);
  const [userListVisible, setUserListVisible] = React.useState(false);
  const [loadingUsers, setLoadingUsers] = React.useState(false);
  const [searchModalVisible, setSearchModalVisible] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<Array<{ workerId: string; name?: string | null; phone?: string | null; coords: Coord }>>([]);
  const [activeCount, setActiveCount] = React.useState<number>(0);
  const [zoomSlider, setZoomSlider] = React.useState<number>(0.6);
  const [phoneToCall, setPhoneToCall] = React.useState<string>('');
  const [groupAddress, setGroupAddress] = React.useState<string>('');
  const [groupCoord, setGroupCoord] = React.useState<Coord | null>(null);
  const [distanceToGroup, setDistanceToGroup] = React.useState<number | null>(null);
  
  // Grup özellikleri
  const [activeGroups, setActiveGroups] = React.useState<ActiveGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = React.useState<ActiveGroup | null>(null);
  const [groupMembers, setGroupMembers] = React.useState<GroupMember[]>([]);
  const [showGroupSelector, setShowGroupSelector] = React.useState(false);
  const socketRef = React.useRef<Socket | null>(null);

  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const groupPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const membersPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef = React.useRef<Location.LocationSubscription | null>(null);
  const mapRef = React.useRef<MapView | null>(null);
  const accuracyRef = React.useRef<Location.LocationAccuracy>(Location.Accuracy.High);

  const headerY = React.useRef(new Animated.Value(0)).current;
  const pulse = React.useRef(new Animated.Value(0)).current;
  const fabScale = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!mounted) return;
      setHasPermission(status === 'granted');

      if (status === 'granted') {
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          const c = { latitude: last.coords.latitude, longitude: last.coords.longitude };
          setCoords(c);
          setAccuracyMeters(last.coords.accuracy ?? null);
          setHeading(Number.isFinite(last.coords.heading) ? last.coords.heading : null);
          setSpeedKmh(Number.isFinite(last.coords.speed) ? Math.max(0, last.coords.speed! * 3.6) : null);
          setPath([c]);
        }
        // Start foreground watching immediately on first open
        try {
          await startForegroundWatch();
          setIsTracking(true);
        } catch {}
      }

      try {
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (!mounted) return;
        setBgPermission(bgStatus === 'granted');
      } catch {
        if (!mounted) return;
        setBgPermission(false);
      }

      try {
        let stored = await SecureStore.getItemAsync('workerId');
        if (!stored) {
          stored = `expo-${Platform.OS}-${Math.floor(Math.random() * 1e6)}`;
          await SecureStore.setItemAsync('workerId', stored);
        }
        if (!mounted) return;
        setWorkerId(stored);
        try {
          const r = await authFetch('/auth/me');
          if (r.ok) {
            const { user } = await r.json();
            if (user && user.name) setProfileName(user.name);
            if (user && user.id) setWorkerId(user.id); // Kullanıcı ID'sini workerId olarak kullan
          }
        } catch {}
        // optional meta
        const nameStored = await SecureStore.getItemAsync('displayName');
        const phoneStored = await SecureStore.getItemAsync('phone');
        setDisplayName(nameStored || '');
        setPhone(phoneStored || '');
      } catch {}

      // Grup yükleme otomatik, tüm kullanıcı polling'i manuel
      loadActiveGroups();
    })();

    return () => {
      mounted = false;
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (groupPollRef.current) {
        clearInterval(groupPollRef.current);
        groupPollRef.current = null;
      }
      if (membersPollRef.current) {
        clearInterval(membersPollRef.current);
        membersPollRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // Aktif grupları yükle
  const loadActiveGroups = React.useCallback(async () => {
    if (!workerId) {
      console.log('[Track] Cannot load groups, no workerId');
      return;
    }
    try {
      console.log('[Track] Loading active groups for user:', workerId);
      const response = await fetch(`${API_BASE}/api/groups/user/${workerId}/active`);
      console.log('[Track] Groups response status:', response.status);
      if (response.ok) {
        const groups = await response.json();
        console.log('[Track] Loaded groups:', groups);
        setActiveGroups(groups);
        
        // İlk grubu otomatik seç
        if (groups.length > 0 && !selectedGroup) {
          console.log('[Track] Auto-selecting first group:', groups[0]);
          selectGroup(groups[0]);
        }
      }
    } catch (e) {
      console.error('[Track] Load active groups error:', e);
    }
  }, [workerId, selectedGroup]);

  // Grup üyelerini yükle
  const loadGroupMembers = React.useCallback(async (groupId: string) => {
    if (!groupId) {
      console.warn('[Track] Cannot load members, no groupId');
      return;
    }
    
    try {
      console.log('[Track] Loading members for group:', groupId);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 saniye timeout
      
      const response = await fetch(
        `${API_BASE}/api/groups/${groupId}/members-with-locations`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      console.log('[Track] Members response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const members = await response.json();
      console.log('[Track] Loaded members:', members?.length || 0);
      
      // Validate and sanitize data
      const validMembers = (Array.isArray(members) ? members : [])
        .filter(m => m && typeof m === 'object')
        .map((m: any) => ({
          userId: m.userId || '',
          displayName: m.displayName || 'Unknown',
          location: m.location && typeof m.location === 'object' ? {
            lat: Number(m.location.lat) || 0,
            lng: Number(m.location.lng) || 0,
            timestamp: m.location.timestamp || Date.now()
          } : null,
          isOnline: Boolean(m.isOnline)
        }));
      
      setGroupMembers(validMembers);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.error('[Track] Load members timeout');
      } else {
        console.error('[Track] Load group members error:', e);
      }
      // Hata durumunda mevcut veriyi koru, temizleme
    }
  }, []);

  // Grup seç ve socket bağlantısı kur
  const selectGroup = React.useCallback(async (group: ActiveGroup) => {
    try {
      console.log('[Track] Selecting group:', group);
      setSelectedGroup(group);
      setGroupAddress(group.address || 'İstanbul, Türkiye');
      
      if (group.lat && group.lng) {
        console.log('[Track] Group has coordinates:', group.lat, group.lng);
        setGroupCoord({ latitude: group.lat, longitude: group.lng });
      } else {
        try {
          console.log('[Track] Geocoding group address:', group.address);
          const res = await Location.geocodeAsync(group.address);
          console.log('[Track] Geocode result:', res);
          if (res && res.length > 0) {
            setGroupCoord({ latitude: res[0].latitude, longitude: res[0].longitude });
          }
        } catch (error) {
          console.error('[Track] Geocoding error:', error);
        }
      }
      
      // Grup üyelerini yükle
      await loadGroupMembers(group.id);
      
      // Periyodik güncelleme
      if (membersPollRef.current) clearInterval(membersPollRef.current);
      membersPollRef.current = setInterval(() => {
        loadGroupMembers(group.id).catch(e => console.error('[Track] Poll error:', e));
      }, 10000); // 10 saniyede bir
    } catch (error) {
      console.error('[Track] Select group error:', error);
    }
  }, [loadGroupMembers]);

  // Socket bağlantısı - sadece selectedGroup değişince
  React.useEffect(() => {
    if (!selectedGroup) {
      console.log('[Track] No selected group, skipping socket connection');
      if (socketRef.current) {
        try {
          socketRef.current.disconnect();
          socketRef.current = null;
        } catch (e) {
          console.warn('[Track] Socket disconnect error:', e);
        }
      }
      return;
    }
    
    console.log('[Track] Setting up socket for group:', selectedGroup.id);
    
    try {
      // Mevcut socket'i temizle
      if (socketRef.current) {
        console.log('[Track] Disconnecting existing socket');
        try {
          socketRef.current.disconnect();
        } catch (e) {
          console.warn('[Track] Socket disconnect error:', e);
        }
      }
      
      // Yeni socket oluştur
      const socket = io(API_BASE, { 
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
      });
      
      socketRef.current = socket;
      
      socket.on('connect', () => {
        console.log('[Track] Socket connected, joining group:', selectedGroup.id);
        try {
          socket.emit('join_group', selectedGroup.id);
        } catch (e) {
          console.error('[Track] Join group emit error:', e);
        }
      });
      
      socket.on('location_update', (data: any) => {
        try {
          console.log('[Track] Location update received:', data);
          if (data.groupId === selectedGroup.id) {
            console.log('[Track] Reloading group members after location update');
            loadGroupMembers(selectedGroup.id).catch(e => console.error('[Track] Load members error:', e));
          }
        } catch (e) {
          console.error('[Track] Location update handler error:', e);
        }
      });
      
      // If current group gets deleted elsewhere, stop tracking and clear selection
      socket.on('group_deleted', async (ev: { groupId: string }) => {
        try {
          if (!ev || !ev.groupId || ev.groupId !== selectedGroup.id) return;
          await stopBackgroundTracking();
          setSelectedGroup(null);
          setGroupMembers([]);
          setGroupAddress('');
          setGroupCoord(null);
          setShowGroupSelector(false);
          showWarning('Seçili grup silindi. Takip durduruldu.');
        } catch (e) {
          console.warn('[Track] group_deleted handling failed', e);
        }
      });
      
      socket.on('disconnect', (reason: string) => {
        console.log('[Track] Socket disconnected, reason:', reason);
      });
      
      socket.on('error', (error: any) => {
        console.error('[Track] Socket error:', error);
      });
      
      socket.on('connect_error', (error: any) => {
        console.error('[Track] Socket connect error:', error);
      });
      
      socket.on('reconnect', (attemptNumber: number) => {
        console.log('[Track] Socket reconnected after', attemptNumber, 'attempts');
      });
      
      return () => {
        console.log('[Track] Cleaning up socket');
        try {
          socket.off();
          socket.disconnect();
        } catch (e) {
          console.warn('[Track] Socket cleanup error:', e);
        }
        socketRef.current = null;
      };
    } catch (error) {
      console.error('[Track] Socket setup error:', error);
    }
  }, [selectedGroup?.id, loadGroupMembers]);

  // Global data cleared: stop tracking, clear state, disconnect sockets
  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('app:dataCleared', async () => {
      try {
        await stopBackgroundTracking();
      } catch {}
      try {
        if (socketRef.current) {
          socketRef.current.off();
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      } catch {}
      // Reset state
      setActiveGroups([]);
      setSelectedGroup(null);
      setGroupMembers([]);
      setShowGroupSelector(false);
      setCoords(null);
      setPath([]);
      setTotalDistance(0);
      setWorkerId('');
      setDisplayName('');
      setPhone('');
    });
    return () => { sub.remove?.(); };
  }, []);

  React.useEffect(() => {
    if (workerId) {
      loadActiveGroups();
    }
  }, [workerId, loadActiveGroups]);

  // showAllUsers değiştiğinde polling'i başlat/durdur
  React.useEffect(() => {
    startPollingAllUsers();
  }, [showAllUsers]);

  // Konum veya grup adresi değişince gruba mesafeyi hesapla
  React.useEffect(() => {
    if (coords && groupCoord) {
      setDistanceToGroup(haversineMeters(coords, groupCoord));
    } else {
      setDistanceToGroup(null);
    }
  }, [coords, groupCoord]);

  // Follow mode - kullanıcı konumuna odaklan
  React.useEffect(() => {
    if (coords && follow && mapRef.current) {
      try {
        const MIN_DELTA = 0.005;
        const MAX_DELTA = 0.08;
        const delta = MIN_DELTA + (1 - zoomSlider) * (MAX_DELTA - MIN_DELTA);
        
        console.log('[Track] Following user location');
        mapRef.current.animateToRegion({
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta
        }, 500);
      } catch (error) {
        console.error('[Track] AnimateToRegion error:', error);
      }
    }
  }, [coords, follow, zoomSlider]);

  // Ask again or open settings when permission is denied
  const ensureForegroundPermission = React.useCallback(async () => {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status === 'granted') {
      setHasPermission(true);
      return true;
    }
    if (fg.canAskAgain) {
      const req = await Location.requestForegroundPermissionsAsync();
      setHasPermission(req.status === 'granted');
      return req.status === 'granted';
    }
    showWarning('Konum izni reddedilmiş! Ayarlardan izin vermeniz gerekir.');
    return false;
  }, [showWarning]);

  // Konum paylaşımını gruba gönder
  const shareLocationToGroup = React.useCallback(async (location: Location.LocationObject) => {
    if (!selectedGroup || !workerId) return;
    
    const payload = {
      userId: workerId,
      groupId: selectedGroup.id,
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      heading: location.coords.heading ?? null,
      accuracy: location.coords.accuracy ?? null,
      timestamp: location.timestamp,
    };
    
    try {
      // Socket ile gönder
      if (socketRef.current?.connected) {
        socketRef.current.emit('group_location_update', payload);
      } else {
        // Fallback: HTTP POST
        await fetch(`${API_BASE}/api/groups/${selectedGroup.id}/locations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
    } catch (e) {
      console.warn('Share location error:', e);
    }
  }, [selectedGroup, workerId]);

  // --- location watch & tracking functions (kept intact) ---
  const startForegroundWatch = React.useCallback(
    async () => {
      console.log('[Track] Starting foreground watch...');
      if (!hasPermission) {
        console.log('[Track] No location permission, requesting...');
        const ok = await ensureForegroundPermission();
        if (!ok) {
          console.error('[Track] Location permission denied');
          showError('Konum izni verilmedi.');
          return;
        }
      }
      if (watchRef.current) {
        console.log('[Track] Watch already active');
        return;
      }

      console.log('[Track] Creating location watch subscription');
      const sub = await Location.watchPositionAsync(
        { accuracy: accuracyRef.current, timeInterval: 1500, distanceInterval: 3 },
        (pos) => {
          console.log('[Track] Location update:', pos.coords.latitude, pos.coords.longitude);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          const next = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setCoords(next);
          setAccuracyMeters(pos.coords.accuracy ?? null);
          setHeading(Number.isFinite(pos.coords.heading) ? pos.coords.heading : null);
          setSpeedKmh(Number.isFinite(pos.coords.speed) ? Math.max(0, pos.coords.speed! * 3.6) : null);

          setPath((prev) => {
            if (prev.length === 0) return [next];
            const last = prev[prev.length - 1];
            const dist = haversineMeters(last, next);
            setTotalDistance((d) => d + dist);
            return [...prev, next].slice(-5000);
          });

          if (follow && mapRef.current) {
            mapRef.current.animateCamera({ center: next, heading: pos.coords.heading ?? 0, pitch: 0 }, { duration: 600 });
          }

          pushLocationToServer({ workerId, name: displayName || undefined, phone: phone || undefined, timestamp: pos.timestamp, coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy, heading: pos.coords.heading, speed: pos.coords.speed } });
          
          // Gruba da paylaş
          shareLocationToGroup(pos);
        }
      );
      watchRef.current = sub;
    },
    [hasPermission, follow, workerId, displayName, phone, shareLocationToGroup, ensureForegroundPermission, showError]
  );

  const stopForegroundWatch = React.useCallback(() => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
  }, []);

  async function startBackgroundTracking() {
    console.log('[Track] Starting background tracking...');
    if (!hasPermission) {
      console.log('[Track] No permission, requesting...');
      const ok = await ensureForegroundPermission();
      if (!ok) return;
    }
    if (!workerId) {
      console.error('[Track] No workerId, cannot start tracking');
      showError('Lütfen giriş yapın.');
      return;
    }
    if (!selectedGroup) {
      console.warn('[Track] No group selected');
      showWarning('Lütfen önce bir grup seçin.');
      setShowGroupSelector(true);
      return;
    }
    console.log('[Track] Starting tracking for group:', selectedGroup.name);
    try {
      await SecureStore.setItemAsync('workerId', workerId);
    } catch {}

    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (!hasStarted) {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: accuracyRef.current,
          timeInterval: 20000,
          distanceInterval: 10,
          foregroundService: {
            notificationTitle: 'İşçi Takibi Aktif',
            notificationBody: 'Konum arka planda gönderiliyor',
            notificationColor: '#0ea5a4',
          },
          showsBackgroundLocationIndicator: true,
        });
      }
      setIsTracking(true);
      await startForegroundWatch();
    } catch (e) {
      // Arka plan desteklenmiyorsa (Expo Go / iOS Sim), sadece ön planda çalıştır
      setIsTracking(true);
      await startForegroundWatch();
      showInfo('Ön plan takip başlatıldı.');
    } finally {
      Animated.sequence([Animated.timing(fabScale, { toValue: 1.06, duration: 120, useNativeDriver: true }), Animated.spring(fabScale, { toValue: 1, friction: 6, useNativeDriver: true })]).start();
    }
  }

  async function stopBackgroundTracking() {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
    setIsTracking(false);
    stopForegroundWatch();
    Animated.sequence([Animated.timing(fabScale, { toValue: 1.06, duration: 120, useNativeDriver: true }), Animated.spring(fabScale, { toValue: 1, friction: 6, useNativeDriver: true })]).start();
  }

  const toggleTracking = React.useCallback(async () => {
    if (isTracking) await stopBackgroundTracking();
    else await startBackgroundTracking();
  }, [isTracking]);

  const sanitizePhone = (v: string) => v.replace(/[^\d+]/g, '');
  const makePhoneCall = React.useCallback(async () => {
    const num = sanitizePhone(phoneToCall);
    if (!num) {
      showError('Lütfen telefon numarasını girin.');
      return;
    }
    const url = `tel:${num}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else showError('Telefon araması desteklenmiyor.');
    } catch (e) {
      showError('Arama başlatılamadı.');
    }
  }, [phoneToCall, showError]);

  async function pushLocationToServer(payload: any) {
    if (!workerId) return;
    try {
      await fetch(SERVER_PUSH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } catch (e) {
      console.warn('Push failed', e);
    }
  }

  // search active devices by query (name/phone/id)
  async function searchActiveDevices(q: string) {
    try {
      const r = await fetch(`${API_BASE}/api/active?q=${encodeURIComponent(q)}&sinceMs=900000`); // last 15 minutes
      if (!r.ok) return setSearchResults([]);
      const data: { items: Array<{ workerId: string; name?: string; phone?: string; coords: { latitude: number; longitude: number } }> } = await r.json();
      const mapped = (data.items || []).map((x) => ({ workerId: x.workerId, name: x.name, phone: x.phone, coords: { latitude: x.coords.latitude, longitude: x.coords.longitude } }));
      setSearchResults(mapped);
    } catch (e) {
      setSearchResults([]);
    }
  }

  async function fetchHistoryAndRender(id: string) {
    try {
      const r = await fetch(`${API_BASE}/api/locations/${encodeURIComponent(id)}/recent?limit=1000`);
      if (!r.ok) return;
      const data: Array<{ timestamp: number; coords: { latitude: number; longitude: number } }> = await r.json();
      const pts = data.map((d) => ({ latitude: d.coords.latitude, longitude: d.coords.longitude }));
      if (pts.length > 1) {
        setPath(pts);
        setTotalDistance(pts.slice(1).reduce((acc, cur, i) => acc + haversineMeters(pts[i], cur), 0));
        setCoords(pts[pts.length - 1]);
        setFollow(false);
      }
    } catch (e) {
      console.warn('fetchHistoryAndRender failed', e);
    }
  }

  const toggleAccuracy = React.useCallback(() => {
    accuracyRef.current = accuracyRef.current === Location.Accuracy.High ? Location.Accuracy.Balanced : Location.Accuracy.High;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, []);

  function startPollingAllUsers() {
    // Sadece showAllUsers true ise tüm kullanıcıları çek
    if (!showAllUsers) {
      setAllUsers([]);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    
    const fetchAll = async () => {
      setLoadingUsers(true);
      try {
        const [r1, r2] = await Promise.all([
          fetch(`${API_BASE}/api/locations/latest`),
          fetch(`${API_BASE}/api/active?sinceMs=900000`), // 15 dk aktif sayısı
        ]);
        if (r1.ok) {
          const data: { count: number; items: Array<{ workerId: string; last: { timestamp: number; coords: { latitude: number; longitude: number } } }> } = await r1.json();
          const mapped = (data.items || []).map((x) => ({ workerId: x.workerId, latitude: x.last.coords.latitude, longitude: x.last.coords.longitude }));
          setAllUsers(mapped);
        }
        if (r2.ok) {
          const data2: { count: number } = await r2.json();
          setActiveCount(data2.count || 0);
        }
      } catch (e) {
        // ignore polling errors
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchAll();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchAll, 5000);
  }

  const turkeyRegion = { latitude: 39.0, longitude: 35.0, latitudeDelta: 13.0, longitudeDelta: 20.0 };
  const MIN_DELTA = 0.005;
  const MAX_DELTA = 0.08;
  const computedDelta = MIN_DELTA + (1 - zoomSlider) * (MAX_DELTA - MIN_DELTA);
  const followRegion = coords
    ? { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: computedDelta, longitudeDelta: computedDelta }
    : turkeyRegion;

  // small format helpers
  function formatDistance(m: number) {
    if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
    return `${Math.round(m)} m`;
  }
  function formatSpeed(kmh: number | null) {
    return kmh != null ? `${kmh.toFixed(1)} km/s` : '-';
  }

  const fitToTurkey = React.useCallback(() => {
    if (!mapRef.current) return;
    mapRef.current.animateToRegion(turkeyRegion, 700);
    setFollow(false);
    Animated.sequence([Animated.timing(fabScale, { toValue: 1.06, duration: 120, useNativeDriver: true }), Animated.spring(fabScale, { toValue: 1, friction: 6, useNativeDriver: true })]).start();
  }, []);

  const centerOnUser = React.useCallback((u: RemoteUser) => {
    if (!mapRef.current) return;
    mapRef.current.animateCamera({ center: { latitude: u.latitude, longitude: u.longitude }, heading: 0, pitch: 0 }, { duration: 600 });
    setUserListVisible(false);
    setFollow(false);
  }, []);

  // --- UI ---
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Gradient header (no negative margins) */}
      <LinearGradient colors={["#06b6d4", "#0ea5a4"]} style={styles.headerWrap} start={[0, 0]} end={[1, 1]}>
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <View style={styles.headerAvatar}>
              <Ionicons name="navigate-circle" size={27} color="#06b6d4" />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.title}>Canlı Takip</Text>
              <Text style={styles.subtitle}>
                {hasPermission === null
                  ? 'İzin soruluyor…'
                  : hasPermission
                  ? isTracking ? 'Konum paylaşılıyor' : 'Hazır'
                  : 'İzin reddedildi'}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {/* Grup seçici */}
            <Pressable 
              style={[styles.iconBtn, selectedGroup && { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]} 
              onPress={() => setShowGroupSelector(true)} 
              accessibilityLabel="Grup seç"
            >
              <Ionicons name="people" size={20} color={selectedGroup ? "#10b981" : "#042f35"} />
              {selectedGroup && groupMembers.length > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{Math.min(groupMembers.length, 99)}</Text></View>
              )}
            </Pressable>
            
            {/* Tüm kullanıcıları göster toggle */}
            <Pressable 
              style={[styles.iconBtn, { marginLeft: 8 }, showAllUsers && { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]} 
              onPress={() => { setShowAllUsers(!showAllUsers); }} 
              accessibilityLabel="Tüm kullanıcıları göster"
            >
              <Ionicons name="globe" size={20} color={showAllUsers ? "#ef4444" : "#042f35"} />
            </Pressable>
            
            <Pressable style={[styles.iconBtn, { marginLeft: 8 }]} onPress={() => setMapType((t) => (t === 'standard' ? 'hybrid' : 'standard'))} accessibilityLabel="Harita türü">
              <Ionicons name={mapType === 'standard' ? 'map-outline' : 'map'} size={20} color="#042f35" />
            </Pressable>
            <Pressable style={[styles.iconBtn, { marginLeft: 8 }]} onPress={() => { setSearchModalVisible(true); searchActiveDevices(searchQuery); }} accessibilityLabel="Aktif cihazları ara">
              <Ionicons name="search" size={20} color="#042f35" />
            </Pressable>
          </View>
        </View>

        {/* Grup bilgisi */}
        {selectedGroup && (
          <Pressable onPress={() => setShowGroupSelector(true)} style={{ marginTop: 8, backgroundColor: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="location" size={14} color="#fff" style={{ marginRight: 6 }} />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
              {selectedGroup.name} • {groupMembers.filter(m => m.isOnline).length}/{groupMembers.length} online
            </Text>
          </Pressable>
        )}
        
        {/* compact stats row inside header */}
        <View style={styles.headerStats}>
          <Text style={styles.statText}>{formatSpeed(speedKmh)}</Text>
          <Text style={styles.statText}>{accuracyMeters != null ? `${Math.round(accuracyMeters)} m` : '-'}</Text>
          <Text style={styles.statText}>{formatDistance(totalDistance)}</Text>
          <Text style={styles.statText}>{distanceToGroup != null ? formatDistance(distanceToGroup) : '-'}</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {hasPermission === false && (
          <View style={{ marginHorizontal: 14, marginTop: 12, backgroundColor: '#fff3cd', borderColor: '#ffecb5', borderWidth: 1, padding: 12, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: '#664d03', fontWeight: '700', marginBottom: 6, textAlign: 'center' }}>Konum izni gerekli</Text>
            <Text style={{ color: '#664d03', marginBottom: 10, textAlign: 'center' }}>Uygulama doğru çalışmak için konum iznine ihtiyaç duyar.</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={ensureForegroundPermission} style={{ backgroundColor: '#06b6d4', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>İzin Ver</Text>
              </Pressable>
              {Platform.OS === 'android' && (
                <Pressable onPress={() => Linking.openSettings?.()} style={{ backgroundColor: '#0ea5a4', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Ayarları Aç</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
        <View style={styles.mapCard}>
          <MapView ref={(r) => { 
            console.log('[Track] MapView ref set:', !!r);
            mapRef.current = r; 
          }} 
          style={styles.map} 
          initialRegion={followRegion}
          onMapReady={() => console.log('[Track] Map is ready')}
          onRegionChangeComplete={(region) => {
            if (!follow) {
              console.log('[Track] Map region changed by user');
            }
          }}
          zoomControlEnabled={true}
          zoomEnabled={true}
          scrollEnabled={true}
          rotateEnabled={true}
          pitchEnabled={true}
          mapType={mapType} 
          showsCompass 
          loadingEnabled>
            {path.length > 1 && <Polyline coordinates={path} strokeColor="#06b6d4" strokeWidth={4} lineCap="round" />}

            {coords && accuracyMeters != null && accuracyMeters > 0 && <Circle center={coords} radius={Math.min(accuracyMeters, 200)} strokeWidth={1} strokeColor="rgba(6,182,212,0.35)" fillColor="rgba(6,182,212,0.08)" />}

            {coords && (
              <Marker coordinate={coords} anchor={{ x: 0.5, y: 0.5 }} flat>
                <Animated.View style={[styles.pulseWrapper, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }] }]}>
                  <View style={styles.pulseCircle} />
                  <View style={styles.workerDot}>
                    <Ionicons name="navigate" size={20} color="#06b6d4" style={{ transform: [{ rotate: `${heading ?? 0}deg` }] }} />
                  </View>
                </Animated.View>
                <Callout tooltip>
                  <View style={styles.calloutCard}>
                    <Text style={styles.calloutTitle}>Siz</Text>
                    <Text style={styles.calloutSub}>{coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</Text>
                  </View>
                </Callout>
              </Marker>
            )}

            {/* Grup üyeleri */}
            {groupMembers.map((member) => {
              try {
                // Null safety checks
                if (!member?.location?.lat || !member?.location?.lng) {
                  return null;
                }
                if (member.userId === workerId) {
                  return null; // Kendi konumunu gösterme
                }
                
                return (
                  <Marker 
                    key={member.userId} 
                    coordinate={{ 
                      latitude: member.location.lat, 
                      longitude: member.location.lng 
                    }}
                  >
                    <View style={[styles.otherUserMarker, member.isOnline && { backgroundColor: '#10b981' }]}>
                      <Ionicons name="person" size={14} color="#fff" />
                    </View>
                    <Callout>
                      <View style={styles.calloutCard}>
                        <Text style={styles.calloutTitle}>{member.displayName || 'Unknown'}</Text>
                        <Text style={styles.calloutSub}>
                          {member.isOnline ? '🟢 Online' : '⚫ Offline'}
                        </Text>
                      </View>
                    </Callout>
                  </Marker>
                );
              } catch (error) {
                console.error('[Track] Marker render error:', error);
                return null;
              }
            })}
            
            {/* Diğer kullanıcılar (eski sistem - sadece showAllUsers true ise) */}
            {showAllUsers && allUsers.map((u) => (
              <Marker key={u.workerId} coordinate={{ latitude: u.latitude, longitude: u.longitude }}>
                <View style={[styles.otherUserMarker, { backgroundColor: '#64748b' }]}>
                  <Ionicons name="person" size={14} color="#fff" />
                </View>
                <Callout onPress={() => centerOnUser(u)}>
                  <View style={styles.calloutCard}>
                    <Text style={styles.calloutTitle}>{u.workerId}</Text>
                    <Text style={styles.calloutSub}>Tüm kullanıcılar</Text>
                  </View>
                </Callout>
              </Marker>
            ))}

            {groupCoord && (
              <Marker coordinate={groupCoord}>
                <View style={styles.targetMarker}>
                  <Ionicons name="flag" size={14} color="#7f1d1d" />
                </View>
                <Callout tooltip>
                  <View style={styles.calloutCard}>
                    <Text style={styles.calloutTitle}>Grup Merkezi</Text>
                    <Text style={styles.calloutSub}>{groupAddress}</Text>
                    {distanceToGroup != null && (
                      <Text style={styles.calloutSub}>Mesafe: {formatDistance(distanceToGroup)}</Text>
                    )}
                  </View>
                </Callout>
              </Marker>
            )}
          </MapView>

          {/* Floating Actions */}
          <View style={styles.fabGroup} pointerEvents="box-none">
            <Animated.View style={{ transform: [{ scale: fabScale }] }}>
              <Pressable onPress={() => { if (coords && mapRef.current) { mapRef.current.animateCamera({ center: coords, heading: heading ?? 0, pitch: 0 }, { duration: 500 }); setFollow(true); } }} style={styles.fab} accessibilityLabel="Konuma odakla">
                <Ionicons name={follow ? 'locate' : 'locate-outline'} size={18} color="#083344" />
              </Pressable>
            </Animated.View>

            <Animated.View style={{ transform: [{ scale: fabScale }] }}>
              <Pressable onPress={fitToTurkey} style={[styles.fab, { backgroundColor: '#fff' }]} accessibilityLabel="Türkiye'yi göster">
                <Ionicons name="map" size={18} color="#083344" />
              </Pressable>
            </Animated.View>
          </View>
        </View>

        <View style={styles.controlPanel}>
          {allUsers.length === 0 && (
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e6eef0', alignItems: 'center' }}>
              <Text style={{ color: '#083344', fontWeight: '800', marginBottom: 6, textAlign: 'center' }}>Henüz çalışan görünmüyor</Text>
              <Text style={{ color: '#64748b', marginBottom: 8, textAlign: 'center' }}>Aktif cihazları görmek için aramayı kullanın veya cihazlarda takibi başlatın.</Text>
              <Pressable onPress={() => { setSearchModalVisible(true); searchActiveDevices(''); }} style={{ backgroundColor: '#06b6d4', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Aktifleri Ara</Text>
              </Pressable>
            </View>
          )}
          <View style={styles.inputRow}>
            <TextInput 
              placeholder="İşçi ID girin" 
              placeholderTextColor="#9ca3af"
              style={styles.input} 
              value={workerId} 
              onChangeText={setWorkerId} 
              onSubmitEditing={() => { if (workerId) fetchHistoryAndRender(workerId); }} 
              returnKeyType="search" 
            />
            <Pressable onPress={() => { if (workerId) fetchHistoryAndRender(workerId); }} style={styles.searchBtn} accessibilityLabel="Geçmişi getir">
              <Ionicons name="trail-sign-outline" size={18} color="#fff" />
            </Pressable>
          </View>

          <View style={[styles.inputRow, { marginTop: 8 }]}>
            <TextInput 
              placeholder="İsim veya telefon ile ara" 
              placeholderTextColor="#9ca3af"
              style={styles.input} 
              value={searchQuery} 
              onChangeText={setSearchQuery} 
              onSubmitEditing={() => { setSearchModalVisible(true); searchActiveDevices(searchQuery); }} 
              returnKeyType="search" 
            />
            <Pressable onPress={() => { setSearchModalVisible(true); searchActiveDevices(searchQuery); }} style={styles.searchBtn} accessibilityLabel="Aktif cihazları ara">
              <Ionicons name="search" size={18} color="#fff" />
            </Pressable>
          </View>

          {!selectedGroup && (
            <View style={{ backgroundColor: '#fef3c7', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#fbbf24', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Ionicons name="warning" size={16} color="#92400e" style={{ marginRight: 6 }} />
                <Text style={{ color: '#92400e', fontWeight: '700', textAlign: 'center' }}>Grup Seçilmedi</Text>
              </View>
              <Text style={{ color: '#92400e', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>Konum takibini başlatmak için bir grup seçmelisiniz.</Text>
              <Pressable onPress={() => setShowGroupSelector(true)} style={{ backgroundColor: '#f59e0b', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Grup Seç</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.row}>
            <Pressable 
              onPress={async () => { await toggleTracking(); }} 
              style={[
                styles.button, 
                isTracking ? styles.buttonStop : styles.buttonStart,
                !selectedGroup && { opacity: 0.5 }
              ]} 
              accessibilityLabel={isTracking ? 'Takibi durdur' : 'Takibi başlat'}
              disabled={!selectedGroup && !isTracking}
            >
              <Text style={styles.buttonText}>{isTracking ? 'Takibi Durdur' : 'Takibi Başlat'}</Text>
            </Pressable>

            <Pressable onPress={toggleAccuracy} style={styles.secondaryButton} accessibilityLabel="Hassasiyet değiştir">
              <Text style={styles.secondaryText}>Hassasiyet</Text>
              <Text style={styles.secondaryMeta}>{accuracyRef.current === Location.Accuracy.High ? 'Yüksek' : 'Dengeli'}</Text>
            </Pressable>
          </View>

          {/* Phone call input and action */}
          <View style={styles.inputRow}>
            <TextInput
              placeholder="Telefon numarası girin"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              style={styles.input}
              value={phoneToCall}
              onChangeText={setPhoneToCall}
              returnKeyType="go"
              onSubmitEditing={makePhoneCall}
            />
            <Pressable onPress={makePhoneCall} style={styles.callBtn} accessibilityLabel="Ara">
              <Ionicons name="call" size={18} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricItem}><Text style={styles.metricLabel}>Lat</Text><Text style={styles.metricVal}>{coords?.latitude.toFixed(6) ?? '-'}</Text></View>
            <View style={styles.metricItem}><Text style={styles.metricLabel}>Lng</Text><Text style={styles.metricVal}>{coords?.longitude.toFixed(6) ?? '-'}</Text></View>
            <View style={styles.metricItem}><Text style={styles.metricLabel}>Hız</Text><Text style={styles.metricVal}>{formatSpeed(speedKmh)}</Text></View>
            <View style={styles.metricItem}><Text style={styles.metricLabel}>Doğruluk</Text><Text style={styles.metricVal}>{accuracyMeters != null ? `${Math.round(accuracyMeters)} m` : '-'}</Text></View>
            <View style={styles.metricItem}><Text style={styles.metricLabel}>Mesafe</Text><Text style={styles.metricVal}>{formatDistance(totalDistance)}</Text></View>
            <View style={styles.metricItem}><Text style={styles.metricLabel}>Grup Mesafe</Text><Text style={styles.metricVal}>{distanceToGroup != null ? formatDistance(distanceToGroup) : '-'}</Text></View>
          </View>
        </View>
      </ScrollView>

      {/* Users modal */}
      <Modal visible={userListVisible} animationType="slide" onRequestClose={() => setUserListVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Çalışanlar ({allUsers.length})</Text>
            <Pressable onPress={() => setUserListVisible(false)} style={styles.modalClose}><Ionicons name="close" size={20} color="#083344" /></Pressable>
          </View>
          <ScrollView style={styles.modalList} contentContainerStyle={{ flexGrow: 1 }}>
            {loadingUsers && <ActivityIndicator style={{ margin: 20 }} />}
            {allUsers.map((u) => (
              <Pressable key={u.workerId} style={styles.userRow} onPress={() => centerOnUser(u)}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{u.workerId.slice(0, 2).toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{u.workerId}</Text>
                  <Text style={styles.userSub}>{u.latitude.toFixed(4)}, {u.longitude.toFixed(4)}</Text>
                </View>
                <Pressable onPress={() => centerOnUser(u)} style={styles.gotoBtn}><Text style={styles.gotoText}>Göster</Text></Pressable>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Search results modal */}
      <Modal visible={searchModalVisible} animationType="slide" onRequestClose={() => setSearchModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Aktif Cihazlar</Text>
            <Pressable onPress={() => setSearchModalVisible(false)} style={styles.modalClose}><Ionicons name="close" size={20} color="#083344" /></Pressable>
          </View>
          <ScrollView style={styles.modalList} contentContainerStyle={{ flexGrow: 1 }}>
            {searchResults.map((r) => (
              <Pressable key={r.workerId} style={styles.userRow} onPress={() => { setSearchModalVisible(false); setFollow(false); setCoords(r.coords); mapRef.current?.animateCamera({ center: r.coords, heading: 0, pitch: 0 }, { duration: 600 }); }}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{(r.name || r.workerId).slice(0, 2).toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{r.name || r.workerId}</Text>
                  <Text style={styles.userSub}>{r.phone || r.workerId}</Text>
                </View>
                <Pressable onPress={() => { setSearchModalVisible(false); setCoords(r.coords); mapRef.current?.animateCamera({ center: r.coords, heading: 0, pitch: 0 }, { duration: 600 }); }} style={styles.gotoBtn}><Text style={styles.gotoText}>Göster</Text></Pressable>
              </Pressable>
            ))}
            {searchResults.length === 0 && (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <Text style={{ color: '#64748b', textAlign: 'center' }}>Son 15 dakikada aktif cihaz bulunamadı.</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Group selector modal */}
      <Modal visible={showGroupSelector} animationType="slide" onRequestClose={() => setShowGroupSelector(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Gruplarım ({activeGroups.length})</Text>
            <Pressable onPress={() => setShowGroupSelector(false)} style={styles.modalClose}><Ionicons name="close" size={20} color="white" /></Pressable>
          </View>
          <ScrollView style={styles.modalList} contentContainerStyle={{ flexGrow: 1 }}>
            {activeGroups.map((group) => (
              <Pressable 
                key={group.id} 
                style={[styles.userRow, selectedGroup?.id === group.id && { borderColor: '#10b981', borderWidth: 2 }]} 
                onPress={() => { selectGroup(group); setShowGroupSelector(false); }}
              >
                <View style={[styles.avatar, { backgroundColor: group.isAdmin ? '#10b981' : '#334155' }]}>
                  <Ionicons name="people" size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{group.name}</Text>
                  <Text style={styles.userSub}>{group.address}</Text>
                  <Text style={styles.userSub}>
                    {group.onlineCount}/{group.memberCount} online • {group.isAdmin ? 'Admin' : 'Üye'}
                  </Text>
                </View>
                {selectedGroup?.id === group.id && (
                  <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                )}
              </Pressable>
            ))}
            {activeGroups.length === 0 && (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <Text style={{ color: '#64748b', textAlign: 'center' }}>Henüz bir gruba katılmadınız.</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={hideToast}
      />
    </SafeAreaView>
  );
}

// haversine helper (kept same)
function haversineMeters(a: Coord, b: Coord) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  headerWrap: { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 18 : 18, paddingHorizontal: 14, paddingBottom: 12, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.9)' },
  headerAvatarText: { color: '#042f35', fontWeight: '800' },
  title: { color: '#042f35', fontSize: 16, fontWeight: '800' },
  subtitle: { color: 'rgba(4,47,53,0.9)', fontSize: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#06b6d4' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  headerStats: { marginTop: 10, flexDirection: 'row', gap: 12, justifyContent: 'flex-start' },
  statText: { color: 'rgba(4,47,53,0.9)', fontWeight: '700', marginRight: 18 },

  mapCard: { height: 420, marginHorizontal: 14, borderRadius: 18, overflow: 'hidden', backgroundColor: '#1e293b', marginTop: 12, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  map: { width: '100%', height: '100%' },
  workerDot: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 2, borderColor: '#06b6d4' },
  pulseWrapper: { alignItems: 'center', justifyContent: 'center' },
  pulseCircle: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(6,182,212,0.12)' },
  otherUserMarker: { padding: 8, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(4,47,53,0.06)' },
  targetMarker: { padding: 8, borderRadius: 12, backgroundColor: '#fff5f5', borderWidth: 1, borderColor: 'rgba(127,29,29,0.25)' },
  calloutCard: { backgroundColor: '#fff', padding: 8, borderRadius: 8 },
  calloutTitle: { fontWeight: '700', color: '#083344' },
  calloutSub: { fontSize: 12, color: '#64748b' },

  fabGroup: { position: 'absolute', top: 14, right: 14, gap: 10, alignItems: 'flex-end' },
  fab: { height: 46, width: 46, borderRadius: 12, backgroundColor: '#e6f5f4', alignItems: 'center', justifyContent: 'center', borderWidth: 0 },

  controlPanel: { marginHorizontal: 14, gap: 12, marginBottom: 40, marginTop: 6 },
  inputRow: { flexDirection: 'row' },
  input: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12, backgroundColor: '#1e293b', color: '#fff' },
  searchBtn: { width: 46, height: 46, marginLeft: 8, borderRadius: 12, backgroundColor: '#06b6d4', alignItems: 'center', justifyContent: 'center' },
  callBtn: { width: 46, height: 46, marginLeft: 8, borderRadius: 12, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonStart: { backgroundColor: '#06b6d4' },
  buttonStop: { backgroundColor: '#ef4444' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryButton: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  secondaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondaryMeta: { color: '#64748b', fontSize: 12 },

  metricsRow: { marginTop: 12, backgroundColor: '#1e293b', borderRadius: 14, padding: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', borderWidth: 1, borderColor: '#334155' },
  metricItem: { width: (width - 56) / 3, marginBottom: 6 },
  metricLabel: { fontSize: 11, color: '#94a3b8' },
  metricVal: { fontSize: 13, color: '#fff', fontWeight: '800' },
  modalContainer: { flex: 1, backgroundColor: '#0f172a' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 25, borderBottomWidth: 1, borderColor: '#eceff1', paddingTop: 79 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  modalClose: { padding: 8 },
  modalList: { paddingHorizontal: 12 },
  userRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#1e293b', borderRadius: 14, marginVertical: 8, borderWidth: 1, borderColor: '#334155' },
  avatar: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#334155', marginRight: 12 },
  avatarText: { color: '#06b6d4', fontWeight: '900' },
  userName: { fontWeight: '900', color: '#fff' },
  userSub: { fontSize: 12, color: '#64748b' },
  gotoBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#06b6d4', borderRadius: 8 },
  gotoText: { color: '#fff', fontWeight: '700' },
});
