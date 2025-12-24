import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View
} from 'react-native';
import Reanimated, { FadeInDown, FadeInUp, Layout, SlideInDown, SlideInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io, Socket } from 'socket.io-client';
import { NetworkStatusIcon } from '../../components/NetworkStatusIcon';
import { UnifiedHeader } from '../../components/UnifiedHeader';
import { Toast, useToast } from '../../components/Toast';
import TrackLeafletMap from '../../components/TrackLeafletMap';
import mapTheme from '../../components/ui/mapTheme';
import { getApiBase } from '../../utils/api';
import { authFetch } from '../../utils/auth';
import { detectActivity, getActivityDetector } from '../../utils/activityDetector';
import { getRouteRecorder, Route } from '../../utils/routeRecorder';
import { getGeofencingService, GeofenceEvent } from '../../utils/geofencing';
import { getOfflineStorage } from '../../utils/offlineStorage';
import { getSyncService } from '../../utils/syncService';
import { calculateOptimalTracking, getDeviceState } from '../../utils/trackingOptimizer';
import { processRoute } from '../../utils/routeSmoothing';
import { Accelerometer } from 'expo-sensors';
// Android'de API key gerektirmeyen Leaflet haritası kullanıyoruz
const USE_LEAFLET = Platform.OS === 'android';
// Guard react-native-maps for web bundling (iOS için)
const Maps: any = Platform.OS === 'web' || USE_LEAFLET ? null : require('react-native-maps');
const MapView: any = Platform.OS === 'web' || USE_LEAFLET ? View : Maps.default;
const Marker: any = Platform.OS === 'web' || USE_LEAFLET ? View : Maps.Marker;
const Circle: any = Platform.OS === 'web' || USE_LEAFLET ? View : Maps.Circle;
const Callout: any = Platform.OS === 'web' || USE_LEAFLET ? View : Maps.Callout;
const Polyline: any = Platform.OS === 'web' || USE_LEAFLET ? View : Maps.Polyline;

// PROFESYONEL GPS CANLI TAKİP UYGULAMASI
// - Türkiye merkezli harita sistemi
// - Yüksek performanslı konum takibi
// - Gerçek zamanlı grup takibi
// - Profesyonel GPS navigasyon özellikleri

const { width } = Dimensions.get('window');
const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK_v1';
const API_BASE = getApiBase();
const SERVER_PUSH_URL = `${API_BASE}/api/locations`;
// Grup adresi dinamik olarak gelecek

interface LocationTaskData {
  locations?: Array<{
    timestamp: number;
    coords: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      heading?: number;
      speed?: number;
    };
  }>;
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  try {
    if (error) return console.error('BG task error', error);
    if (!data) return;
    const { locations } = data as LocationTaskData;
    const workerId = (await getWorkerIdFromStorageSafe()) || 'unknown';

    for (const loc of locations || []) {
      const payload = {
        workerId,
        deviceId: workerId,
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
        const token = await SecureStore.getItemAsync('token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        await fetch(SERVER_PUSH_URL, {
          method: 'POST',
          headers,
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
  activity?: { type: string; icon: string; name: string } | null;
}

export default function TrackScreen(): React.JSX.Element {
  const router = useRouter();
  const { toast, showError, showSuccess, showWarning, showInfo, hideToast } = useToast();
  const [profileName, setProfileName] = React.useState<string>('');
  const [mapError, setMapError] = React.useState<Error | null>(null);
  // --- state & refs (kept your logic) ---
  const [hasPermission, setHasPermission] = React.useState<boolean | null>(null);
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
  const [zoomSlider] = React.useState<number>(0.6);
  const [currentRegion, setCurrentRegion] = React.useState({
    latitude: 39.0,
    longitude: 35.2433,
    latitudeDelta: 13.0,
    longitudeDelta: 20.0,
  });
  const [phoneToCall, setPhoneToCall] = React.useState<string>('');
  const [groupAddress, setGroupAddress] = React.useState<string>('');
  const [groupCoord, setGroupCoord] = React.useState<Coord | null>(null);
  const [distanceToGroup, setDistanceToGroup] = React.useState<number | null>(null);

  // Grup özellikleri
  const [activeGroups, setActiveGroups] = React.useState<ActiveGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = React.useState<ActiveGroup | null>(null);
  const [groupMembers, setGroupMembers] = React.useState<GroupMember[]>([]);
  const [showGroupSelector, setShowGroupSelector] = React.useState(false);
  const [loadingGroups, setLoadingGroups] = React.useState(false);
  const [showTrackInfo, setShowTrackInfo] = React.useState(false);

  // Araba takip özellikleri
  const [vehicleStatus, setVehicleStatus] = React.useState<{
    isInVehicle: boolean;
    confidence: number;
    speed: number;
    status: string;
    reason?: string;
  } | null>(null);
  const [vehicleMode, setVehicleMode] = React.useState(false);
  const [groupVehicles] = React.useState<Array<{
    userId: string;
    name: string;
    isInVehicle: boolean;
    speed: number;
    status: string;
    location: { lat: number; lng: number; timestamp: number };
  }>>([]);
  const [loadingVehicle, setLoadingVehicle] = React.useState(false);

  // Aktivite durumu
  const [activityStatus, setActivityStatus] = React.useState<{
    activity: string;
    confidence: number;
    speed: number;
    reason: string;
    icon: string;
    color: string;
    location?: { lat: number; lng: number; timestamp: number };
  } | null>(null);
  const [currentGeocode, setCurrentGeocode] = React.useState<{
    city: string;
    province: string;
    district?: string;
    fullAddress?: string;
  } | null>(null);

  const socketRef = React.useRef<Socket | null>(null);

  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const groupPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const membersPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef = React.useRef<Location.LocationSubscription | null>(null);
  const mapRef = React.useRef<typeof MapView | null>(null);
  const accuracyRef = React.useRef<Location.LocationAccuracy>(Location.Accuracy.High);
  const accelerometerRef = React.useRef<any>(null);
  const lastLocationRef = React.useRef<any>(null);
  const [isRecordingRoute, setIsRecordingRoute] = React.useState(false);
  const [currentRoute, setCurrentRoute] = React.useState<Route | null>(null);
  const [geofenceEvents, setGeofenceEvents] = React.useState<GeofenceEvent[]>([]);

  const initials = React.useMemo(() => {
    if (!profileName) return '';
    return profileName
      .split(' ')
      .map((s) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [profileName]);

  // Türkiye merkezli harita ayarları ve zoom hesaplamaları
  const TURKEY_CENTER = React.useMemo(() => ({ latitude: 39.0, longitude: 35.2433 }), []);
  const TURKEY_REGION = React.useMemo(
    () => ({ latitude: TURKEY_CENTER.latitude, longitude: TURKEY_CENTER.longitude, latitudeDelta: 13.0, longitudeDelta: 20.0 }),
    [TURKEY_CENTER]
  );
  // clamp removed - not used
  const MIN_DELTA = 0.004;
  const MAX_DELTA = 0.12;
  const computedDelta = MIN_DELTA + (1 - zoomSlider) * (MAX_DELTA - MIN_DELTA);
  const animatedRegion = React.useMemo(() => {
    const base = coords || currentRegion || TURKEY_REGION;
    return {
      latitude: base.latitude,
      longitude: base.longitude,
      latitudeDelta: computedDelta,
      longitudeDelta: computedDelta,
    };
  }, [coords, currentRegion, TURKEY_REGION, computedDelta]);

  const pulse = React.useRef(new Animated.Value(0)).current;
  const fabScale = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Çok katmanlı pulse animasyonu - Profesyonel GPS efekti
  React.useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2000,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true
        }),
      ])
    );
    pulseAnimation.start();
    return () => pulseAnimation.stop();
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
        } catch { }
      }

      try {
        await Location.requestBackgroundPermissionsAsync();
      } catch {
        // Background permission request failed
      }

      try {
        let stored = await SecureStore.getItemAsync('workerId');
        if (!stored) {
          stored = `expo-${Platform.OS}-${Math.floor(Math.random() * 1e6)}`;
          await SecureStore.setItemAsync('workerId', stored);
        }
        if (!mounted) return;
        setWorkerId(stored);

        // ÖNCE SecureStore'dan displayName oku (groups.tsx'deki gibi)
        const storedDisplayName = await SecureStore.getItemAsync('displayName');
        if (storedDisplayName) {
          setProfileName(storedDisplayName);
        }

        try {
          const trackInfoSeen = await SecureStore.getItemAsync('trackInfoSeen');
          if (!trackInfoSeen) {
            // Modal'ı daha sonra göster, hemen değil
            setTimeout(() => {
              if (mounted) {
                setShowTrackInfo(true);
              }
            }, 3000);
          }
        } catch { }
        try {
          const r = await authFetch('/users/me');
          if (r.ok) {
            const { user } = await r.json();
            if (user) {
              // displayName öncelikli, yoksa name kullan
              const profileDisplayName = user.displayName || user.name || '';
              if (profileDisplayName) {
                setProfileName(profileDisplayName);
                // SecureStore'a da kaydet (index.tsx'deki gibi)
                await SecureStore.setItemAsync('displayName', profileDisplayName);
              }
              if (user.id) setWorkerId(user.id); // Kullanıcı ID'sını workerId olarak kullan
            }
          }
        } catch { }
        // optional meta
        const nameStored = await SecureStore.getItemAsync('displayName');
        const phoneStored = await SecureStore.getItemAsync('phone');
        setDisplayName(nameStored || '');
        setPhone(phoneStored || '');
      } catch { }

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
      setLoadingGroups(true);
      console.log('[Track] Loading active groups for user:', workerId);
      const token = await SecureStore.getItemAsync('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE}/api/groups/user/${workerId}/active`, { headers });
      console.log('[Track] Groups response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('[Track] API response:', result);

        // Backend returns { success: true, data: [...groups] }
        const groups = result.data || result;
        console.log('[Track] Extracted groups array:', groups);

        const groupsArray = Array.isArray(groups) ? groups : [];
        setActiveGroups(groupsArray);

        if (groupsArray.length > 0) {
          showSuccess(`${groupsArray.length} grup yüklendi`);

          try {
            const savedGroupJson = await AsyncStorage.getItem('selectedGroup');
            if (savedGroupJson && !selectedGroup) {
              const savedGroup = JSON.parse(savedGroupJson);
              // Check if saved group still exists in active groups
              const groupStillExists = groupsArray.find(g => g.id === savedGroup.id);
              if (groupStillExists) {
                console.log('[Track] ✅ Restoring previously selected group:', groupStillExists.name);
                selectGroup(groupStillExists);
              } else {
                console.log('[Track] Saved group no longer exists, selecting first group');
                selectGroup(groupsArray[0]);
              }
            } else if (!selectedGroup) {
              // No saved group, select first one
              console.log('[Track] Auto-selecting first group:', groupsArray[0]);
              selectGroup(groupsArray[0]);
            }
          } catch (storageError) {
            console.warn('[Track] Failed to restore selected group:', storageError);
            // Fallback to first group
            if (!selectedGroup) {
              selectGroup(groupsArray[0]);
            }
          }
        } else {
          showInfo('Henüz bir gruba katılmadınız');
        }
      } else {
        if (response.status === 429) {
          showWarning('Çok fazla istek gönderildi, lütfen bekleyin');
        } else if (response.status === 401) {
          showError('Oturum süreniz dolmuş, lütfen tekrar giriş yapın');
        } else {
          showError('Gruplar yüklenemedi');
        }
        console.warn('[Track] Failed to load groups:', response.status);
      }
    } catch (e: any) {
      console.error('[Track] Load active groups error:', e);
      showError('Gruplar yüklenirken bir hata oluştu');
    } finally {
      setLoadingGroups(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId, showSuccess, showInfo, showWarning, showError]);

  // Grup üyelerini yükle
  const checkActivityStatus = React.useCallback(async () => {
    if (!workerId) return;

    try {
      const params = new URLSearchParams({ deviceId: workerId });
      if (selectedGroup) {
        params.append('groupId', selectedGroup.id);
      }

      const res = await authFetch(`/api/location/activity/status?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setActivityStatus(data.data);

          const prevActivity = activityStatus?.activity;
          const newActivity = data.data.activity;

          if (prevActivity && prevActivity !== newActivity) {
            const activityNames: Record<string, string> = {
              'home': '🏠 Ev',
              'stationary': '📍 Duruyor',
              'walking': '🚶 Yürüyor',
              'cycling': '🚴 Bisiklet',
              'motorcycle': '🏍️ Motor',
              'driving': '🚗 Araba'
            };
            showInfo(`${data.data.icon} ${activityNames[newActivity] || newActivity} - ${data.data.speed.toFixed(1)} km/h`);
          }
        }
      }
    } catch (error: any) {
      console.error('[Track] Activity status check error:', error);
    }
  }, [workerId, selectedGroup, activityStatus, showInfo]);

  const checkVehicleStatus = React.useCallback(async () => {
    if (!workerId) return;

    try {
      setLoadingVehicle(true);
      const params = new URLSearchParams({ deviceId: workerId });
      if (selectedGroup) {
        params.append('groupId', selectedGroup.id);
      }

      const res = await authFetch(`/api/location/vehicle/status?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setVehicleStatus(data.data);

          if (data.data.isInVehicle && data.data.confidence > 70) {
            if (!vehicleMode) {
              setVehicleMode(true);
              showInfo(`🚗 Araç kullanımı tespit edildi! Hız: ${data.data.speed.toFixed(1)} km/h`);
            }
          } else if (vehicleMode && data.data.confidence < 50) {
            setVehicleMode(false);
            showInfo('🚶 Yürüme moduna geçildi');
          }
        }
      }
    } catch (error: any) {
      console.error('[Track] Vehicle status check error:', error);
    } finally {
      setLoadingVehicle(false);
    }
  }, [workerId, selectedGroup, vehicleMode, showInfo]);

  // loadGroupVehicles removed - not used

  const loadGroupMembers = React.useCallback(async (groupId: string) => {
    if (!groupId) {
      console.warn('[Track] Cannot load members, no groupId');
      return;
    }

    try {
      console.log('[Track] Loading members for group:', groupId);
      const token = await SecureStore.getItemAsync('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 saniye timeout

      const response = await fetch(
        `${API_BASE}/api/groups/${groupId}/members-with-locations`,
        { headers, signal: controller.signal }
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
          isOnline: Boolean(m.isOnline),
          activity: m.activity || null
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

      // Save to AsyncStorage for persistence
      try {
        await AsyncStorage.setItem('selectedGroup', JSON.stringify(group));
        console.log('[Track] ✅ Selected group saved to storage');
      } catch (storageError) {
        console.warn('[Track] Failed to save selected group:', storageError);
      }

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

    const setupSocket = async () => {
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

        // Yeni socket oluştur - authentication token ile
        const token = await SecureStore.getItemAsync('token');
        const socket = io(API_BASE, {
          transports: ['websocket'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
          auth: token ? { token } : undefined,
          extraHeaders: token ? { Authorization: `Bearer ${token}` } : undefined
        });

        socketRef.current = socket;
        const currentGroupId = selectedGroup.id;

        socket.on('connect', () => {
          console.log('[Track] Socket connected, joining group:', currentGroupId);
          try {
            socket.emit('join_group', currentGroupId);
          } catch (e: any) {
            console.error('[Track] Join group emit error:', e);
          }
        });

        socket.on('location_update', (data: { groupId: string; userId: string; lat: number; lng: number; timestamp: number }) => {
          try {
            console.log('[Track] Location update received:', data);
            if (data.groupId === currentGroupId) {
              console.log('[Track] Reloading group members after location update');
              loadGroupMembers(currentGroupId).catch((e: any) => console.error('[Track] Load members error:', e));
            }
          } catch (e: any) {
            console.error('[Track] Location update handler error:', e);
          }
        });

        // 30 km mesafe bildirimi dinle
        socket.on('member_distance_alert', (data: {
          groupId: string;
          userId: string;
          userName: string;
          distance: number;
          threshold: number;
          message: string;
          timestamp: number;
        }) => {
          try {
            console.log('[Track] Member distance alert received:', data);
            if (data.groupId === currentGroupId) {
              // Bildirim göster
              showWarning(`${data.userName} 30 km'yi geçti!`);

              // Grup üyelerini yeniden yükle (mesafe değişikliği için)
              loadGroupMembers(currentGroupId).catch((e: any) =>
                console.error('[Track] Load members error after distance alert:', e)
              );
            }
          } catch (e: any) {
            console.error('[Track] Member distance alert handler error:', e);
          }
        });

        // If current group gets deleted elsewhere, stop tracking and clear selection
        socket.on('group_deleted', async (ev: { groupId: string }) => {
          try {
            if (!ev || !ev.groupId || ev.groupId !== currentGroupId) return;
            await stopBackgroundTracking();
            setSelectedGroup(null);
            // Clear from AsyncStorage
            await AsyncStorage.removeItem('selectedGroup');
            console.log('[Track] ✅ Cleared selected group from storage');
            setGroupMembers([]);
            setGroupAddress('');
            setGroupCoord(null);
            setShowGroupSelector(false);
            showWarning('Seçili grup silindi. Takip durduruldu.');
          } catch (e: any) {
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
      } catch (error: any) {
        console.error('[Track] Socket setup error:', error);
      }
    };

    setupSocket();

    return () => {
      console.log('[Track] Cleaning up socket');
      if (socketRef.current) {
        try {
          socketRef.current.off();
          socketRef.current.disconnect();
        } catch (e: any) {
          console.warn('[Track] Socket cleanup error:', e);
        }
        socketRef.current = null;
      }
    };
  }, [selectedGroup, loadGroupMembers]);

  // Global data cleared: stop tracking, clear state, disconnect sockets
  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('app:dataCleared', async () => {
      try {
        await stopBackgroundTracking();
      } catch { }
      try {
        if (socketRef.current) {
          socketRef.current.off();
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      } catch { }
      // Reset state
      setActiveGroups([]);
      setSelectedGroup(null);
      // Clear from AsyncStorage
      AsyncStorage.removeItem('selectedGroup').catch(e => console.warn('[Track] Storage clear error:', e));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId]);

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
        const nextRegion = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: computedDelta,
          longitudeDelta: computedDelta,
        };
        console.log('[Track] Following user location');
        mapRef.current.animateToRegion(nextRegion, 500);
        setCurrentRegion(nextRegion);
      } catch (error) {
        console.error('[Track] AnimateToRegion error:', error);
      }
    }
  }, [coords, follow, computedDelta]);

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
        const token = await SecureStore.getItemAsync('token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        await fetch(`${API_BASE}/api/groups/${selectedGroup.id}/locations`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
      }
    } catch (e) {
      console.warn('Share location error:', e);
    }
  }, [selectedGroup, workerId]);

  const shareLocationLink = React.useCallback(async () => {
    if (!coords) {
      showWarning('Konum bilgisi bulunamadı');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      showInfo('Paylaşım linki oluşturuluyor...');

      const lat = coords.latitude;
      const lng = coords.longitude;
      const name = displayName || profileName || 'Konumum';

      const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      const appleMapsUrl = `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(name)}`;
      const shareUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

      const shareMessage = `📍 ${name}\n\nKonum: ${lat.toFixed(6)}, ${lng.toFixed(6)}\n\nGoogle Maps: ${googleMapsUrl}\n\nApple Maps: ${appleMapsUrl}`;

      const result = await Share.share({
        message: shareMessage,
        url: shareUrl,
        title: `${name} - Konum Paylaş`
      });

      if (result.action === Share.sharedAction) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showSuccess('Konum başarıyla paylaşıldı!');
      }
    } catch (error: any) {
      console.error('Share location link error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError(error.message || 'Paylaşım başarısız oldu');
    }
  }, [coords, displayName, profileName, showInfo, showSuccess, showError, showWarning]);

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
      let timeInterval = 3000;
      let distanceInterval = 5;

      try {
        const subRes = await authFetch('/me/subscription');
        if (subRes.ok) {
          const subData = await subRes.json();
          const planId = subData.subscription?.planId || 'free';

          try {
            const recRes = await authFetch(`/location/${workerId}/recommendations`);
            if (recRes.ok) {
              const recData = await recRes.json();
              timeInterval = recData.recommendedInterval || timeInterval;
              distanceInterval = recData.recommendedDistance || distanceInterval;
              console.log(`[Track] Smart tracking: ${recData.movementPattern}, interval: ${timeInterval}ms, distance: ${distanceInterval}m`);
            }
          } catch (recErr) {
            console.warn('[Track] Recommendations fetch error, using defaults:', recErr);
            if (planId === 'business') {
              timeInterval = 500;
              distanceInterval = 1;
            } else if (planId === 'plus') {
              timeInterval = 1000;
              distanceInterval = 3;
            }
          }

          console.log(`[Track] Plan: ${planId}, Update interval: ${timeInterval}ms, Distance: ${distanceInterval}m`);
        }
      } catch (e) {
        console.warn('[Track] Subscription check error:', e);
      }

      // Adaptive tracking: Calculate optimal interval based on speed/battery
      const deviceState = await getDeviceState();
      const movementState = {
        speed: null,
        acceleration: null,
        isMoving: false,
        lastUpdateTime: Date.now(),
      };
      const optimalConfig = calculateOptimalTracking(movementState, deviceState);
      timeInterval = optimalConfig.timeInterval;
      distanceInterval = optimalConfig.distanceInterval;
      accuracyRef.current = optimalConfig.accuracy;

      // Start accelerometer for activity detection
      try {
        const isAvailable = await Accelerometer.isAvailableAsync();
        if (isAvailable) {
          Accelerometer.setUpdateInterval(100);
          accelerometerRef.current = Accelerometer.addListener(() => {
          });
        }
      } catch (e) {
        console.warn('[Track] Accelerometer not available:', e);
      }

      const sub = await Location.watchPositionAsync(
        { accuracy: accuracyRef.current, timeInterval, distanceInterval },
        async (pos) => {
          console.log('[Track] Location update:', pos.coords.latitude, pos.coords.longitude);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          const next = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setCoords(next);
          setAccuracyMeters(pos.coords.accuracy ?? null);
          setHeading(Number.isFinite(pos.coords.heading) ? pos.coords.heading : null);
          setSpeedKmh(Number.isFinite(pos.coords.speed) ? Math.max(0, pos.coords.speed! * 3.6) : null);

          // Advanced activity detection
          const activityDetector = getActivityDetector();
          const lastLocation = lastLocationRef.current;
          const currentLocationPoint = {
            timestamp: pos.timestamp,
            coords: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              heading: pos.coords.heading,
              speed: pos.coords.speed,
              altitude: pos.coords.altitude,
            },
          };

          // Get accelerometer data if available
          let accelData = null;
          try {
            if (accelerometerRef.current) {
              // Accelerometer data is handled in listener above
            }
          } catch (e) {
            // Ignore
          }

          const detectedActivity = activityDetector.detectActivity(currentLocationPoint, accelData || undefined);
          setActivityStatus({
            activity: detectedActivity.type,
            icon: detectedActivity.icon,
            color: detectedActivity.color,
            speed: detectedActivity.speed,
            confidence: detectedActivity.confidence,
            reason: `${detectedActivity.name} - ${detectedActivity.speed.toFixed(1)} km/h`,
          });

          // Route recording
          if (isRecordingRoute) {
            const routeRecorder = getRouteRecorder();
            routeRecorder.addPoint(pos, detectedActivity);
            const route = routeRecorder.getCurrentRoute();
            if (route) setCurrentRoute(route);
          }

          // Geofencing check
          const geofencing = getGeofencingService();
          const events = geofencing.checkLocation(pos);
          if (events.length > 0) {
            setGeofenceEvents((prev) => [...prev, ...events]);
            events.forEach((event) => {
              showInfo(`${event.type === 'enter' ? '📍' : '🚪'} ${event.geofenceName} - ${event.type === 'enter' ? 'Girdi' : 'Çıktı'}`);
            });
          }

          // Offline storage
          try {
            const offlineStorage = getOfflineStorage();
            await offlineStorage.initialize();
            await offlineStorage.storeLocation({
              deviceId: workerId,
              userId: workerId,
              timestamp: pos.timestamp,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              heading: pos.coords.heading,
              speed: pos.coords.speed,
              altitude: pos.coords.altitude,
              metadata: JSON.stringify({ activity: detectedActivity.type }),
            });
          } catch (e) {
            console.warn('[Track] Offline storage error:', e);
          }

          setPath((prev) => {
            if (prev.length === 0) return [next];
            const last = prev[prev.length - 1];
            const dist = haversineMeters(last, next);
            setTotalDistance((d) => d + dist);
            const newPath = [...prev, next].slice(-5000);

            // Aktivite durumunu kontrol et (her 3 konum güncellemesinde bir)
            if (newPath.length % 3 === 0) {
              setTimeout(() => checkActivityStatus(), 100);
            }

            // Araba durumunu kontrol et (her 5 konum güncellemesinde bir)
            if (newPath.length % 5 === 0) {
              setTimeout(() => checkVehicleStatus(), 100);
            }

            return newPath;
          });

          if (follow && mapRef.current) {
            mapRef.current.animateCamera({ center: next, heading: pos.coords.heading ?? 0, pitch: 0 }, { duration: 600 });
          }

          pushLocationToServer({ workerId, timestamp: pos.timestamp, coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? undefined, heading: pos.coords.heading ?? undefined, speed: pos.coords.speed ?? undefined } });

          lastLocationRef.current = pos;

          SecureStore.getItemAsync('token').then(token => {
            return fetch(`${API_BASE}/api/location/geocode?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`, {
              headers: { 'Authorization': `Bearer ${token || ''}` }
            });
          })
            .then(res => res.json())
            .then(data => {
              if (data.data?.geocode) {
                setCurrentGeocode(data.data.geocode);
              }
            })
            .catch(err => console.warn('[Track] Geocoding fetch error:', err));

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
    } catch { }

    // Start route recording
    const routeRecorder = getRouteRecorder();
    const route = routeRecorder.startRecording(`Rota ${new Date().toLocaleString('tr-TR')}`, {
      deviceId: workerId,
      userId: workerId,
      groupId: selectedGroup.id,
    });
    setCurrentRoute(route);
    setIsRecordingRoute(true);

    // Start offline sync
    const syncService = getSyncService();
    syncService.startAutoSync(30000); // Every 30 seconds

    // Get adaptive tracking config
    const deviceState = await getDeviceState();
    const movementState = {
      speed: null,
      acceleration: null,
      isMoving: false,
      lastUpdateTime: Date.now(),
    };
    const optimalConfig = calculateOptimalTracking(movementState, deviceState);

    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (!hasStarted) {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: optimalConfig.accuracy,
          timeInterval: optimalConfig.timeInterval,
          distanceInterval: optimalConfig.distanceInterval,
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

    // Stop route recording
    if (isRecordingRoute) {
      const routeRecorder = getRouteRecorder();
      const finalRoute = routeRecorder.stopRecording();
      if (finalRoute) {
        setCurrentRoute(finalRoute);
        showSuccess(`Rota kaydedildi: ${finalRoute.totalDistance.toFixed(0)}m, ${(finalRoute.totalDuration / 60).toFixed(1)} dk`);
      }
      setIsRecordingRoute(false);
    }

    // Stop sync
    const syncService = getSyncService();
    syncService.stopAutoSync();

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

  interface LocationPayload {
    workerId: string;
    timestamp: number;
    coords: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      heading?: number;
      speed?: number;
    };
  }

  async function pushLocationToServer(payload: LocationPayload) {
    if (!workerId) return;
    try {
      const token = await SecureStore.getItemAsync('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(SERVER_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...payload,
          deviceId: payload.workerId,
        })
      });
    } catch (e) {
      console.warn('Push failed', e);
    }
  }

  // search active devices by query (name/phone/id)
  async function searchActiveDevices(q: string) {
    try {
      const token = await SecureStore.getItemAsync('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const r = await fetch(`${API_BASE}/api/active?q=${encodeURIComponent(q)}&sinceMs=900000`, { headers }); // last 15 minutes
      if (!r.ok) {
        if (r.status !== 429) {
          console.warn('[Track] Search active devices failed:', r.status);
        }
        return setSearchResults([]);
      }
      const data: { items: Array<{ workerId: string; name?: string; phone?: string; coords: { latitude: number; longitude: number } }> } = await r.json();
      const mapped = (data.items || []).map((x) => ({ workerId: x.workerId, name: x.name, phone: x.phone, coords: { latitude: x.coords.latitude, longitude: x.coords.longitude } }));
      setSearchResults(mapped);
    } catch (e) {
      setSearchResults([]);
    }
  }

  async function fetchHistoryAndRender(id: string) {
    try {
      const token = await SecureStore.getItemAsync('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const r = await fetch(`${API_BASE}/api/locations/${encodeURIComponent(id)}/recent?limit=1000`, { headers });
      if (!r.ok) {
        if (r.status !== 429) {
          console.warn('[Track] Fetch history failed:', r.status);
        }
        return;
      }
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
        const token = await SecureStore.getItemAsync('token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const [r1, r2] = await Promise.all([
          fetch(`${API_BASE}/api/locations/latest`, { headers }),
          fetch(`${API_BASE}/api/active?sinceMs=900000`, { headers }), // 15 dk aktif sayısı
        ]);
        if (r1.ok) {
          const data: { count: number; items: Array<{ workerId: string; last: { timestamp: number; coords: { latitude: number; longitude: number } } }> } = await r1.json();
          const mapped = (data.items || []).map((x) => ({ workerId: x.workerId, latitude: x.last.coords.latitude, longitude: x.last.coords.longitude }));
          setAllUsers(mapped);
        } else {
          if (r1.status !== 429) {
            console.warn('[Track] Fetch latest locations failed:', r1.status);
          }
        }
        if (r2.ok) {
          await r2.json();
        } else {
          if (r2.status !== 429) {
            console.warn('[Track] Fetch active count failed:', r2.status);
          }
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

  const followRegion = coords
    ? { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: computedDelta, longitudeDelta: computedDelta }
    : TURKEY_REGION;

  // small format helpers
  function formatDistance(m: number | null | undefined) {
    if (m == null || !isFinite(m)) return '-';
    if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
    return `${Math.round(m)} m`;
  }
  function formatSpeed(kmh: number | null | undefined) {
    if (kmh == null || !isFinite(kmh)) return '-';
    return `${kmh.toFixed(1)} km/s`;
  }

  // fitToTurkey removed - not used

  const centerOnUser = React.useCallback((u: RemoteUser) => {
    if (!mapRef.current) return;
    if (!isFinite(u.latitude) || !isFinite(u.longitude)) return;
    mapRef.current.animateCamera({ center: { latitude: u.latitude, longitude: u.longitude }, heading: 0, pitch: 0 }, { duration: 600 });
    setUserListVisible(false);
    setFollow(false);
  }, []);

  // --- UI ---
  return (
    <SafeAreaView style={[styles.container, { flex: 1 }]} edges={["top"]}>
      <LinearGradient
        colors={['#0f172a', '#1e293b']}
        style={[styles.gradient, { flex: 1 }]}
      >
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >

          {/* Professional Header with Glassmorphism */}
          <LinearGradient
            colors={['rgba(15,23,42,0.95)', 'rgba(30,41,59,0.9)', 'transparent']}
            style={styles.headerGradientWrapper}
          >
            <View style={styles.modernHeader}>
              {/* Top Row: Title + Quick Actions */}
              <Reanimated.View
                entering={FadeInDown.delay(100).springify()}
                style={styles.headerTopRow}
              >
                {/* Title Section */}
                <View style={styles.headerTitleSection}>
                  <View style={styles.headerIconWrapper}>
                    <LinearGradient
                      colors={['#0EA5E9', '#0ea5e9', '#0891b2']}
                      style={styles.headerIconGradient}
                    >
                      <Ionicons name="navigate-circle" size={26} color="#fff" />
                    </LinearGradient>
                  </View>
                  <View style={styles.headerTitleContent}>
                    <Text style={styles.headerTitle}>GPS Canlı Takip</Text>
                    <View style={styles.statusBadge}>
                      <View style={[styles.statusDot, isTracking && styles.statusDotActive]} />
                      <Text style={styles.statusText}>
                        {hasPermission === null
                          ? 'İzin soruluyor...'
                          : hasPermission
                            ? isTracking ? 'Konum Paylaşılıyor' : 'GPS Hazır'
                            : 'İzin Reddedildi'}
                      </Text>
                    </View>
                  </View>
                </View>


                {/* Quick Action Buttons */}
                <View style={styles.headerQuickActions}>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push('/(tabs)/profile');
                    }}
                    style={({ pressed }) => [
                      styles.quickActionBtn,
                      pressed && styles.quickActionBtnPressed
                    ]}
                  >
                    {initials ? (
                      <View style={styles.profileInitialsSmall}>
                        <Text style={styles.profileInitialsText}>{initials}</Text>
                      </View>
                    ) : (
                      <Ionicons name="person-circle" size={20} color="#0EA5E9" />
                    )}
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.quickActionBtn,
                      selectedGroup && styles.quickActionBtnActive,
                      pressed && styles.quickActionBtnPressed
                    ]}
                    onPress={() => setShowGroupSelector(true)}
                  >
                    <Ionicons
                      name="people"
                      size={20}
                      color={selectedGroup ? "#10b981" : "#94a3b8"}
                    />
                    {selectedGroup && groupMembers.length > 0 && (
                      <View style={styles.quickActionBadge}>
                        <Text style={styles.quickActionBadgeText}>
                          {Math.min(groupMembers.length, 99)}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              </Reanimated.View>

              {/* Live Stats Grid */}
              <Reanimated.View
                entering={FadeInDown.delay(200).springify()}
                style={styles.statsGrid}
              >
                {/* Speed */}
                <View style={styles.statCard}>
                  <View style={styles.statIconWrapper}>
                    <LinearGradient
                      colors={['rgba(6,182,212,0.2)', 'rgba(6,182,212,0.1)']}
                      style={styles.statIconBg}
                    >
                      <Ionicons name="speedometer" size={18} color="#0EA5E9" />
                    </LinearGradient>
                  </View>
                  <View style={styles.statContent}>
                    <Text style={styles.statLabel}>Hız</Text>
                    <Text style={styles.statValue}>
                      {formatSpeed(speedKmh)}
                    </Text>
                  </View>
                </View>

                {/* Accuracy */}
                <View style={styles.statCard}>
                  <View style={styles.statIconWrapper}>
                    <LinearGradient
                      colors={['rgba(16,185,129,0.2)', 'rgba(16,185,129,0.1)']}
                      style={styles.statIconBg}
                    >
                      <Ionicons name="locate" size={18} color="#10b981" />
                    </LinearGradient>
                  </View>
                  <View style={styles.statContent}>
                    <Text style={styles.statLabel}>Doğruluk</Text>
                    <Text style={styles.statValue}>
                      {accuracyMeters != null && isFinite(accuracyMeters)
                        ? `${Math.round(accuracyMeters)}m`
                        : '-'}
                    </Text>
                  </View>
                </View>

                {/* Distance */}
                <View style={styles.statCard}>
                  <View style={styles.statIconWrapper}>
                    <LinearGradient
                      colors={['rgba(124,58,237,0.2)', 'rgba(124,58,237,0.1)']}
                      style={styles.statIconBg}
                    >
                      <Ionicons name="analytics" size={18} color="#7c3aed" />
                    </LinearGradient>
                  </View>
                  <View style={styles.statContent}>
                    <Text style={styles.statLabel}>Mesafe</Text>
                    <Text style={styles.statValue}>
                      {formatDistance(totalDistance)}
                    </Text>
                  </View>
                </View>
              </Reanimated.View>

              {/* Action Toolbar */}
              <Reanimated.View
                entering={FadeInUp.delay(300).springify()}
                style={styles.actionToolbar}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.toolbarBtn,
                    showAllUsers && styles.toolbarBtnActive,
                    pressed && { opacity: 0.7 }
                  ]}
                  onPress={() => setShowAllUsers(!showAllUsers)}
                >
                  <Ionicons
                    name="globe"
                    size={18}
                    color={showAllUsers ? "#ef4444" : "#94a3b8"}
                  />
                  <Text style={[
                    styles.toolbarBtnText,
                    showAllUsers && styles.toolbarBtnTextActive
                  ]}>
                    Tüm Kullanıcılar
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.toolbarBtn,
                    pressed && { opacity: 0.7 }
                  ]}
                  onPress={() => setMapType((t) => (t === 'standard' ? 'hybrid' : 'standard'))}
                >
                  <Ionicons
                    name={mapType === 'standard' ? 'map-outline' : 'map'}
                    size={18}
                    color="#94a3b8"
                  />
                  <Text style={styles.toolbarBtnText}>
                    {mapType === 'standard' ? 'Hybrid' : 'Standart'}
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.toolbarBtn,
                    !coords && styles.toolbarBtnDisabled,
                    pressed && { opacity: 0.7 }
                  ]}
                  onPress={shareLocationLink}
                  disabled={!coords}
                >
                  <Ionicons
                    name="share-social"
                    size={18}
                    color={coords ? "#94a3b8" : "#475569"}
                  />
                  <Text style={[
                    styles.toolbarBtnText,
                    !coords && styles.toolbarBtnTextDisabled
                  ]}>
                    Paylaş
                  </Text>
                </Pressable>
              </Reanimated.View>
            </View>
          </LinearGradient>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowGroupSelector(true);
            }}
            style={styles.groupBannerWrapper}
            android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
          >
            <LinearGradient
              colors={selectedGroup
                ? ['rgba(124,58,237,0.15)', 'rgba(6,182,212,0.15)']
                : ['rgba(100,116,139,0.15)', 'rgba(71,85,105,0.15)']}
              start={[0, 0]}
              end={[1, 0]}
              style={styles.groupBanner}
            >
              <View style={styles.groupBannerIcon}>
                <LinearGradient
                  colors={selectedGroup ? ['#7c3aed', '#0EA5E9'] : ['#64748b', '#475569']}
                  style={styles.groupBannerIconGradient}
                >
                  <Ionicons name="people" size={20} color="#fff" />
                </LinearGradient>
              </View>
              <View style={styles.groupBannerContent}>
                {selectedGroup ? (
                  <>
                    <Text style={styles.groupBannerName}>{selectedGroup.name}</Text>
                    <Text style={styles.groupBannerStats}>
                      {groupMembers.filter(m => m.isOnline).length}/{groupMembers.length} online • {groupMembers.length} üye
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.groupBannerName}>
                      {activeGroups.length > 0 ? 'Grup Seç' : 'Henüz Grup Yok'}
                    </Text>
                    <Text style={styles.groupBannerStats}>
                      {activeGroups.length > 0
                        ? `${activeGroups.length} grup mevcut`
                        : 'Gruplar sekmesinden grup oluşturun'}
                    </Text>
                  </>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
            </LinearGradient>
          </Pressable>

          {/* Araba Durumu Kartı */}
          {
            vehicleStatus && vehicleStatus.isInVehicle && vehicleStatus.confidence > 60 && (
              <View style={styles.vehicleStatusCard}>
                <LinearGradient
                  colors={vehicleStatus.status === 'driving_fast'
                    ? ['rgba(239,68,68,0.2)', 'rgba(239,68,68,0.1)']
                    : vehicleStatus.status === 'driving'
                      ? ['rgba(245,158,11,0.2)', 'rgba(245,158,11,0.1)']
                      : ['rgba(16,185,129,0.2)', 'rgba(16,185,129,0.1)']}
                  start={[0, 0]}
                  end={[1, 0]}
                  style={styles.vehicleStatusGradient}
                >
                  <View style={styles.vehicleStatusContent}>
                    <Ionicons
                      name="car"
                      size={24}
                      color={vehicleStatus.status === 'driving_fast' ? '#ef4444' : vehicleStatus.status === 'driving' ? '#f59e0b' : '#10b981'}
                    />
                    <View style={styles.vehicleStatusInfo}>
                      <Text style={styles.vehicleStatusTitle}>
                        {vehicleStatus.status === 'driving_fast' ? '🚗 Hızlı Sürüş'
                          : vehicleStatus.status === 'driving' ? '🚗 Sürüş'
                            : '🚗 Yavaş Sürüş'}
                      </Text>
                      <Text style={styles.vehicleStatusSubtitle}>
                        Hız: {vehicleStatus.speed.toFixed(1)} km/h • Güven: %{vehicleStatus.confidence}
                      </Text>
                    </View>
                    {loadingVehicle && (
                      <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 8 }} />
                    )}
                  </View>
                </LinearGradient>
              </View>
            )
          }


          {hasPermission === false && (
            <View style={styles.permissionWarningCard}>
              <View style={styles.permissionWarningHeader}>
                <Ionicons name="warning" size={24} color="#f59e0b" />
                <Text style={styles.permissionWarningTitle}>Konum İzni Gerekli</Text>
              </View>
              <Text style={styles.permissionWarningText}>
                GPS takip özelliğini kullanmak için konum iznine ihtiyaç duyuyoruz. Lütfen izin verin.
              </Text>
              <View style={styles.permissionWarningActions}>
                <Pressable
                  onPress={ensureForegroundPermission}
                  style={styles.permissionWarningButton}
                  android_ripple={{ color: 'rgba(6,182,212,0.3)' }}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.permissionWarningButtonText}>İzin Ver</Text>
                </Pressable>
                {Platform.OS === 'android' && (
                  <Pressable
                    onPress={() => Linking.openSettings?.()}
                    style={[styles.permissionWarningButton, styles.permissionWarningButtonSecondary]}
                    android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                  >
                    <Ionicons name="person" size={18} color="#0EA5E9" style={{ marginRight: 6 }} />
                    <Text style={styles.permissionWarningButtonTextSecondary}>Ayarlar</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
          <View style={styles.mapCard}>
            {USE_LEAFLET ? (
              <TrackLeafletMap
                center={coords ? { lat: coords.latitude, lng: coords.longitude } : { lat: TURKEY_CENTER.latitude, lng: TURKEY_CENTER.longitude }}
                path={path}
                markers={[
                  ...(coords ? [{
                    id: 'user',
                    lat: coords.latitude,
                    lng: coords.longitude,
                    title: activityStatus
                      ? `${activityStatus.icon} ${displayName || 'Konumunuz'} - ${activityStatus.reason}`
                      : displayName || 'Konumunuz',
                    color: activityStatus?.color || (speedKmh && speedKmh > 10 ? '#10b981' : '#0EA5E9'),
                    heading: heading,
                    speed: speedKmh,
                    isOnline: isTracking,
                    ...(activityStatus ? {
                      activity: activityStatus.activity,
                      activityIcon: activityStatus.icon
                    } : {})
                  } as any] : []),
                  ...groupMembers
                    .filter(m => m.location && m.userId !== workerId)
                    .map(m => ({
                      id: m.userId,
                      lat: m.location!.lat,
                      lng: m.location!.lng,
                      title: m.displayName || 'Üye',
                      color: m.isOnline ? '#10b981' : '#64748b',
                      isOnline: m.isOnline,
                      activity: m.activity?.type || null,
                      activityIcon: m.activity?.icon || null
                    })),
                  ...(vehicleMode && groupVehicles.length > 0 ? groupVehicles
                    .filter((v: { isInVehicle: boolean; userId: string }) => v.isInVehicle && v.userId !== workerId)
                    .map((v: { userId: string; name: string; location: { lat: number; lng: number }; status: string; speed: number }) => ({
                      id: `vehicle_${v.userId}`,
                      lat: v.location.lat,
                      lng: v.location.lng,
                      title: `🚗 ${v.name}`,
                      color: v.status === 'driving_fast' ? '#ef4444' : v.status === 'driving' ? '#f59e0b' : '#10b981',
                      speed: v.speed,
                      isVehicle: true
                    })) : []),
                  ...(showAllUsers ? allUsers
                    .filter(u => isFinite(u.latitude) && isFinite(u.longitude))
                    .map(u => ({
                      id: u.workerId,
                      lat: u.latitude,
                      lng: u.longitude,
                      title: 'Aktif Kullanıcı',
                      color: '#64748b'
                    })) : [])
                ]}
                groupCenter={groupCoord ? { lat: groupCoord.latitude, lng: groupCoord.longitude } : null}
                accuracy={accuracyMeters}
                height={420}
                onMapReady={() => {
                  console.log('[Track] Leaflet map ready');
                  setMapError(null);
                }}
                onRegionChange={(region: { lat: number; lng: number; zoom: number }) => {
                  setCurrentRegion({
                    latitude: region.lat,
                    longitude: region.lng,
                    latitudeDelta: computedDelta,
                    longitudeDelta: computedDelta
                  });
                }}
              />
            ) : mapError ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e293b' }}>
                <Ionicons name="map-outline" size={48} color="#64748b" />
                <Text style={{ color: '#94a3b8', marginTop: 12, fontSize: 14 }}>Harita yüklenemedi</Text>
                <Text style={{ color: '#64748b', marginTop: 4, fontSize: 12 }}>{mapError.message}</Text>
              </View>
            ) : (
              <MapView ref={(r: typeof MapView | null) => {
                console.log('[Track] MapView ref set:', !!r);
                mapRef.current = r;
              }}
                style={[styles.map, { height: 500, width: '100%' }]}
                initialRegion={coords ? followRegion : TURKEY_REGION}
                onMapReady={() => {
                  console.log('[Track] Map is ready');
                  setMapError(null);
                  if (mapRef.current) {
                    setTimeout(() => {
                      mapRef.current?.animateToRegion(animatedRegion, 900);
                      setCurrentRegion(animatedRegion);
                    }, 450);
                  }
                }}
                onError={(error: any) => {
                  console.error('[Track] MapView error:', error);
                  setMapError(new Error(error?.message || 'Harita yüklenemedi'));
                }}
                onRegionChangeComplete={(region: any) => {
                  setCurrentRegion(region);
                  if (!follow) {
                    console.log('[Track] Map region changed by user');
                  }
                }}
                zoomControlEnabled={false}
                zoomEnabled={true}
                scrollEnabled={true}
                rotateEnabled={true}
                pitchEnabled={true}
                mapType={mapType}
                showsCompass={true}
                showsScale={true}
                showsMyLocationButton={false}
                loadingEnabled={true}
                loadingIndicatorColor={mapTheme.colors.gps.marker}
                loadingBackgroundColor={mapTheme.colors.background}
                customMapStyle={mapType === 'standard' ? mapTheme.map.darkStyle : undefined}>
                {/* Yol Çizgisi - Profesyonel GPS Stili */}
                {path.length > 1 && (
                  <Polyline
                    coordinates={path}
                    strokeColor={mapTheme.path.color}
                    strokeWidth={speedKmh && speedKmh > 5 ? mapTheme.path.width + 1 : mapTheme.path.width}
                    lineCap={mapTheme.path.lineCap}
                    lineJoin={mapTheme.path.lineJoin}
                    zIndex={1}
                  />
                )}

                {/* Doğruluk Çemberi - Çok Katmanlı Profesyonel Stil */}
                {coords && accuracyMeters != null && accuracyMeters > 0 && (
                  <>
                    <Circle
                      center={coords}
                      radius={Math.min(accuracyMeters, 200)}
                      strokeWidth={mapTheme.accuracy.outer.strokeWidth}
                      strokeColor={mapTheme.accuracy.outer.color}
                      fillColor={mapTheme.accuracy.outer.fillColor}
                      zIndex={0}
                    />
                    <Circle
                      center={coords}
                      radius={Math.min(accuracyMeters * 0.6, 120)}
                      strokeWidth={mapTheme.accuracy.inner.strokeWidth}
                      strokeColor={mapTheme.accuracy.inner.color}
                      fillColor={mapTheme.accuracy.inner.fillColor}
                      zIndex={0}
                    />
                  </>
                )}

                {/* PROFESYONEL GPS KULLANICI MARKER'I - Stabil ve Optimize */}
                {coords && (
                  <Marker coordinate={coords} anchor={{ x: 0.5, y: 0.5 }} flat={true}>
                    <View style={styles.professionalMarkerWrapper}>
                      {/* Pulse Halkaları */}
                      <Animated.View
                        style={[
                          styles.markerPulseOuter,
                          {
                            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
                            opacity: pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.2, 0] })
                          }
                        ]}
                      />
                      <Animated.View
                        style={[
                          styles.markerPulseInner,
                          {
                            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) }],
                            opacity: pulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.4, 0.1, 0] })
                          }
                        ]}
                      />

                      {/* Ana Marker */}
                      <View style={[
                        styles.professionalMarkerMain,
                        { backgroundColor: activityStatus?.color || (speedKmh && speedKmh > 10 ? mapTheme.colors.gps.active : mapTheme.colors.gps.marker) }
                      ]}>
                        {/* Aktivite İkonu */}
                        {activityStatus?.icon ? (
                          <Text style={{ fontSize: 28, color: '#fff' }}>
                            {activityStatus.icon}
                          </Text>
                        ) : (
                          <Ionicons
                            name={heading != null ? "navigate" : "location"}
                            size={heading != null ? 28 : 24}
                            color="#fff"
                            style={heading != null ? { transform: [{ rotate: `${heading}deg` }] } : undefined}
                          />
                        )}
                      </View>

                      {/* Hız Badge - Marker dışında */}
                      {speedKmh != null && isFinite(speedKmh) && speedKmh > 0 && (
                        <View style={styles.markerSpeedBadge}>
                          <Text style={styles.markerSpeedText}>{Math.round(speedKmh)}</Text>
                        </View>
                      )}

                      {/* Takip Badge - Marker dışında */}
                      {isTracking && (
                        <View style={styles.markerTrackingBadge} />
                      )}
                    </View>

                    {/* Bilgilendirici Callout */}
                    <Callout tooltip={false}>
                      <View style={styles.professionalCallout}>
                        <View style={styles.calloutHeader}>
                          <View style={styles.calloutIcon}>
                            <Ionicons name="navigate" size={20} color="#0EA5E9" />
                          </View>
                          <Text style={styles.calloutTitle}>Konumunuz</Text>
                        </View>

                        <View style={styles.calloutInfoGrid}>
                          <View style={styles.calloutInfoItem}>
                            <Ionicons name="speedometer-outline" size={14} color="#64748b" />
                            <Text style={styles.calloutInfoLabel}>Hız</Text>
                            <Text style={styles.calloutInfoValue}>{formatSpeed(speedKmh)}</Text>
                          </View>

                          <View style={styles.calloutInfoItem}>
                            <Ionicons name="radio" size={14} color="#64748b" />
                            <Text style={styles.calloutInfoLabel}>Doğruluk</Text>
                            <Text style={styles.calloutInfoValue}>{accuracyMeters != null && isFinite(accuracyMeters) ? `${Math.round(accuracyMeters)}m` : '-'}</Text>
                          </View>

                          <View style={styles.calloutInfoItem}>
                            <Ionicons name="map-outline" size={14} color="#64748b" />
                            <Text style={styles.calloutInfoLabel}>Mesafe</Text>
                            <Text style={styles.calloutInfoValue}>{formatDistance(totalDistance)}</Text>
                          </View>

                          {heading != null && isFinite(heading) && (
                            <View style={styles.calloutInfoItem}>
                              <Ionicons name="compass-outline" size={14} color="#64748b" />
                              <Text style={styles.calloutInfoLabel}>Yön</Text>
                              <Text style={styles.calloutInfoValue}>{Math.round(heading)}°</Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.calloutCoordinates}>
                          <Text style={styles.calloutCoordText}>
                            {coords ? `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}` : '-'}
                          </Text>
                        </View>
                      </View>
                    </Callout>
                  </Marker>
                )}

                {/* Grup üyeleri - Profesyonel İkonlu Markerlar */}
                {groupMembers.map((member) => {
                  try {
                    if (!member?.location?.lat || !member?.location?.lng) return null;
                    if (!isFinite(member.location.lat) || !isFinite(member.location.lng)) return null;
                    if (member.userId === workerId) return null;

                    return (
                      <Marker
                        key={member.userId}
                        coordinate={{ latitude: member.location.lat, longitude: member.location.lng }}
                        anchor={{ x: 0.5, y: 0.5 }}
                      >
                        <View style={styles.memberMarkerWrapper}>
                          <View style={[
                            styles.memberMarkerMain,
                            { backgroundColor: member.isOnline ? '#10b981' : '#64748b' }
                          ]}>
                            {member.activity?.icon ? (
                              <Text style={{ fontSize: 24, color: '#fff' }}>
                                {member.activity.icon}
                              </Text>
                            ) : (
                              <Ionicons
                                name={member.isOnline ? "person-circle" : "person-circle-outline"}
                                size={28}
                                color="#fff"
                              />
                            )}
                          </View>
                          {member.isOnline && (
                            <View style={styles.memberOnlineDot} />
                          )}
                        </View>
                        <Callout tooltip={false}>
                          <View style={styles.memberCallout}>
                            <View style={styles.memberCalloutHeader}>
                              <View style={[styles.memberCalloutIcon, { backgroundColor: member.isOnline ? '#10b981' : '#64748b' }]}>
                                <Ionicons name="person" size={20} color="#fff" />
                              </View>
                              <Text style={styles.memberCalloutTitle}>{member.displayName || 'Bilinmiyor'}</Text>
                            </View>
                            <View style={styles.memberCalloutInfo}>
                              <View style={styles.memberCalloutStatus}>
                                <Ionicons name={member.isOnline ? "radio-button-on" : "radio-button-off"} size={14} color={member.isOnline ? '#10b981' : '#64748b'} />
                                <Text style={[styles.memberCalloutStatusText, { color: member.isOnline ? '#10b981' : '#64748b' }]}>
                                  {member.isOnline ? 'Online' : 'Offline'}
                                </Text>
                              </View>
                              {member.location && isFinite(member.location.lat) && isFinite(member.location.lng) && (
                                <>
                                  {(member.location as any).geocode && (
                                    <Text style={[styles.memberCalloutLocation, { color: '#0EA5E9', fontWeight: '700', marginBottom: 4 }]}>
                                      {(member.location as any).geocode.city || ''}
                                      {(member.location as any).geocode.province ? `, ${(member.location as any).geocode.province}` : ''}
                                    </Text>
                                  )}
                                  <Text style={styles.memberCalloutLocation}>
                                    {member.location.lat.toFixed(5)}, {member.location.lng.toFixed(5)}
                                  </Text>
                                </>
                              )}
                            </View>
                          </View>
                        </Callout>
                      </Marker>
                    );
                  } catch (error) {
                    console.error('[Track] Marker render error:', error);
                    return null;
                  }
                })}

                {/* Diğer kullanıcılar - Profesyonel İkonlu Markerlar */}
                {showAllUsers && allUsers.filter(u => isFinite(u.latitude) && isFinite(u.longitude)).map((u) => (
                  <Marker
                    key={u.workerId}
                    coordinate={{ latitude: u.latitude, longitude: u.longitude }}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={styles.otherUserMarkerWrapper}>
                      <View style={styles.otherUserMarkerMain}>
                        <Ionicons name="people-circle-outline" size={32} color="#64748b" />
                      </View>
                    </View>
                    <Callout tooltip={false} onPress={() => centerOnUser(u)}>
                      <View style={styles.otherUserCallout}>
                        <View style={styles.otherUserCalloutHeader}>
                          <View style={styles.otherUserCalloutIcon}>
                            <Ionicons name="globe" size={20} color="#0EA5E9" />
                          </View>
                          <Text style={styles.otherUserCalloutTitle}>Aktif Kullanıcı</Text>
                        </View>
                        <Text style={styles.otherUserCalloutId}>{u.workerId}</Text>
                        <Text style={styles.otherUserCalloutLocation}>
                          {isFinite(u.latitude) && isFinite(u.longitude) ? `${u.latitude.toFixed(5)}, ${u.longitude.toFixed(5)}` : '-'}
                        </Text>
                      </View>
                    </Callout>
                  </Marker>
                ))}

                {/* Grup Merkezi - Profesyonel İkonlu Marker */}
                {groupCoord && (
                  <Marker coordinate={groupCoord} anchor={{ x: 0.5, y: 1 }}>
                    <View style={styles.groupCenterMarkerWrapper}>
                      <View style={styles.groupCenterMarkerMain}>
                        <Ionicons name="flag" size={28} color="#fff" />
                      </View>
                      <View style={styles.groupCenterMarkerShadow} />
                    </View>
                    <Callout tooltip={false}>
                      <View style={styles.groupCenterCallout}>
                        <View style={styles.groupCenterCalloutHeader}>
                          <View style={styles.groupCenterCalloutIcon}>
                            <Ionicons name="location" size={20} color="#ef4444" />
                          </View>
                          <Text style={styles.groupCenterCalloutTitle}>Grup Merkezi</Text>
                        </View>
                        <Text style={styles.groupCenterCalloutAddress}>{groupAddress}</Text>
                        {distanceToGroup != null && (
                          <View style={styles.groupCenterCalloutDistance}>
                            <Ionicons name="navigate" size={14} color="#0EA5E9" />
                            <Text style={styles.groupCenterCalloutDistanceText}>
                              Mesafe: {formatDistance(distanceToGroup)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </Callout>
                  </Marker>
                )}
              </MapView>
            )}

          </View>

          {/* Floating Group Selector Button - Premium Design */}
          {activeGroups.length > 0 && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowGroupSelector(true);
              }}
              disabled={loadingGroups}
              style={({ pressed }) => [
                styles.groupSelectorFAB,
                pressed && { transform: [{ scale: 0.95 }], opacity: 0.9 },
                loadingGroups && { opacity: 0.6 }
              ]}
            >
              <LinearGradient
                colors={['#06b6d4', '#0891b2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.groupFABGradient}
              >
                <Ionicons name="people" size={24} color="#fff" />
                <View style={styles.groupFABContent}>
                  <Text style={styles.groupFABText} numberOfLines={1}>
                    {selectedGroup?.name || 'Grup Seç'}
                  </Text>
                  <View style={styles.groupFABStats}>
                    <View style={styles.groupFABOnlineDot} />
                    <Text style={styles.groupFABStatsText}>
                      {selectedGroup?.onlineCount || 0}/{selectedGroup?.memberCount || 0}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
              </LinearGradient>
            </Pressable>
          )}

          <View style={styles.controlPanel}>
            {/* Premium Search Section */}
            <View style={styles.searchSection}>
              <Text style={styles.sectionTitle}>🔍 Konum Takibi</Text>

              {/* Worker ID Search */}
              <View style={styles.searchCard}>
                <Text style={styles.searchLabel}>İşçi ID</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    placeholder="ID girin (örn: 0l7wfuyvqb)"
                    placeholderTextColor="rgba(148, 163, 184, 0.6)"
                    style={styles.input}
                    value={workerId}
                    onChangeText={setWorkerId}
                    onSubmitEditing={() => { if (workerId) fetchHistoryAndRender(workerId); }}
                    returnKeyType="search"
                  />
                  <Pressable
                    onPress={() => { if (workerId) fetchHistoryAndRender(workerId); }}
                    style={({ pressed }) => [
                      styles.searchBtn,
                      pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }
                    ]}
                    accessibilityLabel="Geçmişi getir"
                  >
                    <LinearGradient
                      colors={workerId ? ['#0EA5E9', '#06B6D4'] : ['#475569', '#64748b']}
                      style={styles.searchBtnGradient}
                    >
                      <Ionicons name="trail-sign-outline" size={20} color="#fff" />
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>

              {/* Active Devices Search */}
              <View style={styles.searchCard}>
                <Text style={styles.searchLabel}>Aktif Cihazlar</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    placeholder="İsim veya telefon ile ara"
                    placeholderTextColor="rgba(148, 163, 184, 0.6)"
                    style={styles.input}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={() => { setSearchModalVisible(true); searchActiveDevices(searchQuery); }}
                    returnKeyType="search"
                  />
                  <Pressable
                    onPress={() => { setSearchModalVisible(true); searchActiveDevices(searchQuery); }}
                    style={({ pressed }) => [
                      styles.searchBtn,
                      pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }
                    ]}
                    accessibilityLabel="Aktif cihazları ara"
                  >
                    <LinearGradient
                      colors={['#10b981', '#059669']}
                      style={styles.searchBtnGradient}
                    >
                      <Ionicons name="search" size={20} color="#fff" />
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>

              {/* Quick Actions */}
              {allUsers.length === 0 && (
                <Pressable
                  onPress={() => { setSearchModalVisible(true); searchActiveDevices(''); }}
                  style={({ pressed }) => [
                    styles.quickActionBtn,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
                  ]}
                >
                  <LinearGradient
                    colors={['#8b5cf6', '#7c3aed']}
                    style={styles.quickActionGradient}
                  >
                    <Ionicons name="people" size={20} color="#fff" />
                    <Text style={styles.quickActionText}>Tüm Aktifleri Göster</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </LinearGradient>
                </Pressable>
              )}
            </View>

            {/* Group Warning */}
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

            {currentGeocode && (
              <View style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#334155' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="location" size={18} color="#0EA5E9" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#0EA5E9', fontWeight: '700', fontSize: 14 }}>Konum Bilgisi</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {currentGeocode.city && (
                    <View style={{ backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                      <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>Şehir</Text>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{currentGeocode.city}</Text>
                    </View>
                  )}
                  {currentGeocode.province && (
                    <View style={{ backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                      <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>İl</Text>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{currentGeocode.province}</Text>
                    </View>
                  )}
                  {currentGeocode.district && (
                    <View style={{ backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                      <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>İlçe</Text>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{currentGeocode.district}</Text>
                    </View>
                  )}
                </View>
                {currentGeocode.fullAddress && (
                  <Text style={{ color: '#64748b', fontSize: 12, marginTop: 8 }} numberOfLines={2}>{currentGeocode.fullAddress}</Text>
                )}
              </View>
            )}
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}><Text style={styles.metricLabel}>Lat</Text><Text style={styles.metricVal}>{coords?.latitude != null ? coords.latitude.toFixed(6) : '-'}</Text></View>
              <View style={styles.metricItem}><Text style={styles.metricLabel}>Lng</Text><Text style={styles.metricVal}>{coords?.longitude != null ? coords.longitude.toFixed(6) : '-'}</Text></View>
              <View style={styles.metricItem}><Text style={styles.metricLabel}>Hız</Text><Text style={styles.metricVal}>{formatSpeed(speedKmh)}</Text></View>
            </View>
          </View>

          {/* FABs - Profesyonel Control Layer */}
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
                      <Text style={styles.userSub}>{isFinite(u.latitude) && isFinite(u.longitude) ? `${u.latitude.toFixed(4)}, ${u.longitude.toFixed(4)}` : '-'}</Text>
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
                  <Pressable key={r.workerId} style={styles.userRow} onPress={() => {
                    if (r.coords && isFinite(r.coords.latitude) && isFinite(r.coords.longitude)) {
                      setSearchModalVisible(false);
                      setFollow(false);
                      setCoords(r.coords);
                      mapRef.current?.animateCamera({ center: r.coords, heading: 0, pitch: 0 }, { duration: 600 });
                    }
                  }}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{(r.name || r.workerId || '').slice(0, 2).toUpperCase()}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName}>{r.name || r.workerId || '-'}</Text>
                      <Text style={styles.userSub}>{r.phone || r.workerId || '-'}</Text>
                    </View>
                    <Pressable onPress={() => {
                      if (r.coords && isFinite(r.coords.latitude) && isFinite(r.coords.longitude)) {
                        setSearchModalVisible(false);
                        setCoords(r.coords);
                        mapRef.current?.animateCamera({ center: r.coords, heading: 0, pitch: 0 }, { duration: 600 });
                      }
                    }} style={styles.gotoBtn}><Text style={styles.gotoText}>Göster</Text></Pressable>
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
                {loadingGroups && (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                    <ActivityIndicator size="large" color="#0EA5E9" />
                    <Text style={{ color: '#64748b', marginTop: 16, textAlign: 'center' }}>Gruplar yükleniyor...</Text>
                  </View>
                )}
                {!loadingGroups && activeGroups.map((group) => (
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
                {!loadingGroups && activeGroups.length === 0 && (
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

          {/* Track Info Modal */}
          <Modal
            visible={showTrackInfo}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowTrackInfo(false)}
            statusBarTranslucent={false}
            presentationStyle="overFullScreen"
          >
            <Pressable
              style={styles.trackInfoOverlay}
              onPress={() => {
                setShowTrackInfo(false);
              }}
            >
              <Pressable
                style={styles.trackInfoModal}
                onPress={(e) => e.stopPropagation()}
              >
                <LinearGradient
                  colors={['#0f172a', '#1e293b', '#0f172a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.trackInfoGradient}
                >
                  {/* Header with animated icon */}
                  <View style={styles.trackInfoHeader}>
                    <Animated.View
                      style={[
                        styles.trackInfoIconWrapper,
                        {
                          transform: [{
                            scale: pulse.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.1]
                            })
                          }]
                        }
                      ]}
                    >
                      <LinearGradient
                        colors={['#0EA5E9', '#0ea5e9', '#0891b2']}
                        style={styles.trackInfoIconGradient}
                      >
                        <Ionicons name="navigate-circle" size={36} color="#fff" />
                      </LinearGradient>
                    </Animated.View>
                    <View style={styles.trackInfoHeaderText}>
                      <Text style={styles.trackInfoTitle}>GPS Canlı Takip</Text>
                      <Text style={styles.trackInfoSubtitle}>Profesyonel konum takip sistemi</Text>
                    </View>
                    <Pressable
                      onPress={() => setShowTrackInfo(false)}
                      style={styles.trackInfoClose}
                    >
                      <Ionicons name="close" size={22} color="#94a3b8" />
                    </Pressable>
                  </View>

                  {/* Content */}
                  <ScrollView
                    style={styles.trackInfoContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {/* Step 1 */}
                    <View style={styles.trackInfoStep}>
                      <View style={styles.trackInfoStepHeader}>
                        <View style={[styles.trackInfoStepNumber, { backgroundColor: '#0EA5E9' }]}>
                          <Text style={styles.trackInfoStepNumberText}>1</Text>
                        </View>
                        <View style={styles.trackInfoStepContent}>
                          <View style={styles.trackInfoStepTitleRow}>
                            <Ionicons name="people-circle" size={20} color="#0EA5E9" />
                            <Text style={styles.trackInfoStepTitle}>Grup Seçin veya Oluşturun</Text>
                          </View>
                          <Text style={styles.trackInfoStepDescription}>
                            Sağ üstteki grup ikonuna tıklayarak mevcut gruplarınızdan birini seçin veya yeni bir grup oluşturun. Grup oluştururken adres bilgisi ekleyerek merkez noktayı belirleyin.
                          </Text>
                          <View style={styles.trackInfoStepFeature}>
                            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                            <Text style={styles.trackInfoStepFeatureText}>Sınırsız grup oluşturma</Text>
                          </View>
                          <View style={styles.trackInfoStepFeature}>
                            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                            <Text style={styles.trackInfoStepFeatureText}>Adres bazlı merkez nokta</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Step 2 */}
                    <View style={styles.trackInfoStep}>
                      <View style={styles.trackInfoStepHeader}>
                        <View style={[styles.trackInfoStepNumber, { backgroundColor: '#7c3aed' }]}>
                          <Text style={styles.trackInfoStepNumberText}>2</Text>
                        </View>
                        <View style={styles.trackInfoStepContent}>
                          <View style={styles.trackInfoStepTitleRow}>
                            <Ionicons name="play-circle" size={20} color="#7c3aed" />
                            <Text style={styles.trackInfoStepTitle}>Takibi Başlatın</Text>
                          </View>
                          <Text style={styles.trackInfoStepDescription}>
                            "Takibi Başlat" butonuna basarak konum paylaşımını aktifleştirin. Sistem otomatik olarak konumunuzu grup üyeleriyle paylaşmaya başlar. Arka planda da çalışmaya devam eder.
                          </Text>
                          <View style={styles.trackInfoStepFeature}>
                            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                            <Text style={styles.trackInfoStepFeatureText}>Arka plan takibi</Text>
                          </View>
                          <View style={styles.trackInfoStepFeature}>
                            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                            <Text style={styles.trackInfoStepFeatureText}>Otomatik konum paylaşımı</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Step 3 */}
                    <View style={styles.trackInfoStep}>
                      <View style={styles.trackInfoStepHeader}>
                        <View style={[styles.trackInfoStepNumber, { backgroundColor: '#10b981' }]}>
                          <Text style={styles.trackInfoStepNumberText}>3</Text>
                        </View>
                        <View style={styles.trackInfoStepContent}>
                          <View style={styles.trackInfoStepTitleRow}>
                            <Ionicons name="map" size={20} color="#10b981" />
                            <Text style={styles.trackInfoStepTitle}>Canlı Takip ve Yönetim</Text>
                          </View>
                          <Text style={styles.trackInfoStepDescription}>
                            Haritada ekibinizin konumunu gerçek zamanlı olarak görüntüleyin. Grup üyelerinin konumlarını, hızlarını ve yönlerini takip edin. Mesafe hesaplamaları ve rota analizi yapın.
                          </Text>
                          <View style={styles.trackInfoStepFeature}>
                            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                            <Text style={styles.trackInfoStepFeatureText}>Gerçek zamanlı konum güncellemeleri</Text>
                          </View>
                          <View style={styles.trackInfoStepFeature}>
                            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                            <Text style={styles.trackInfoStepFeatureText}>Hız ve yön bilgisi</Text>
                          </View>
                          <View style={styles.trackInfoStepFeature}>
                            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                            <Text style={styles.trackInfoStepFeatureText}>Mesafe hesaplama</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Advanced Features */}
                    <View style={styles.trackInfoAdvanced}>
                      <View style={styles.trackInfoAdvancedHeader}>
                        <LinearGradient
                          colors={['#f59e0b', '#fbbf24']}
                          style={styles.trackInfoAdvancedIcon}
                        >
                          <Ionicons name="flash" size={24} color="#fff" />
                        </LinearGradient>
                        <Text style={styles.trackInfoAdvancedTitle}>Akıllı Optimizasyon</Text>
                      </View>
                      <Text style={styles.trackInfoAdvancedDescription}>
                        Sistem hızınıza, hareket durumunuza ve planınıza göre otomatik olarak güncelleme sıklığını ayarlar. Daha az batarya tüketimi, daha fazla verimlilik.
                      </Text>
                      <View style={styles.trackInfoAdvancedGrid}>
                        <View style={styles.trackInfoAdvancedItem}>
                          <Ionicons name="battery-charging" size={20} color="#10b981" />
                          <Text style={styles.trackInfoAdvancedItemLabel}>Batarya Dostu</Text>
                        </View>
                        <View style={styles.trackInfoAdvancedItem}>
                          <Ionicons name="speedometer" size={20} color="#0EA5E9" />
                          <Text style={styles.trackInfoAdvancedItemLabel}>Hız Bazlı</Text>
                        </View>
                        <View style={styles.trackInfoAdvancedItem}>
                          <Ionicons name="analytics" size={20} color="#7c3aed" />
                          <Text style={styles.trackInfoAdvancedItemLabel}>Plan Bazlı</Text>
                        </View>
                        <View style={styles.trackInfoAdvancedItem}>
                          <Ionicons name="shield-checkmark" size={20} color="#f59e0b" />
                          <Text style={styles.trackInfoAdvancedItemLabel}>Güvenli</Text>
                        </View>
                      </View>
                    </View>

                    {/* Plan Benefits */}
                    <View style={styles.trackInfoPlans}>
                      <Text style={styles.trackInfoPlansTitle}>Plan Özellikleri</Text>
                      <View style={styles.trackInfoPlanCard}>
                        <View style={styles.trackInfoPlanHeader}>
                          <Ionicons name="star" size={18} color="#fbbf24" />
                          <Text style={styles.trackInfoPlanName}>Free Plan</Text>
                        </View>
                        <Text style={styles.trackInfoPlanDetail}>50 istek/dakika • 3 saniye güncelleme</Text>
                      </View>
                      <View style={[styles.trackInfoPlanCard, styles.trackInfoPlanCardHighlight]}>
                        <View style={styles.trackInfoPlanHeader}>
                          <Ionicons name="rocket" size={18} color="#7c3aed" />
                          <Text style={styles.trackInfoPlanName}>Plus Plan</Text>
                          <View style={styles.trackInfoPlanBadge}>
                            <Text style={styles.trackInfoPlanBadgeText}>Önerilen</Text>
                          </View>
                        </View>
                        <Text style={styles.trackInfoPlanDetail}>200 istek/dakika • 1 saniye güncelleme</Text>
                      </View>
                      <View style={styles.trackInfoPlanCard}>
                        <View style={styles.trackInfoPlanHeader}>
                          <Ionicons name="diamond" size={18} color="#0EA5E9" />
                          <Text style={styles.trackInfoPlanName}>Business Plan</Text>
                        </View>
                        <Text style={styles.trackInfoPlanDetail}>500 istek/dakika • 0.5 saniye güncelleme</Text>
                      </View>
                    </View>
                  </ScrollView>

                  {/* Footer Button */}
                  <View style={styles.trackInfoFooter}>
                    <Pressable
                      onPress={async () => {
                        try {
                          await SecureStore.setItemAsync('trackInfoSeen', 'true');
                        } catch { }
                        setShowTrackInfo(false);
                      }}
                      style={styles.trackInfoButton}
                      android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                    >
                      <LinearGradient
                        colors={['#0EA5E9', '#0ea5e9']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.trackInfoButtonGradient}
                      >
                        <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.trackInfoButtonText}>Anladım, Başlayalım</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                </LinearGradient>
              </Pressable>
            </Pressable>
          </Modal>
        </ScrollView>
      </LinearGradient >
    </SafeAreaView >
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
  // Professional Header Styles
  headerGradientWrapper: {
    paddingTop: 12,
    paddingBottom: 16,
  },
  modernHeader: {
    paddingHorizontal: 16,
    gap: 16,
  },

  // Header Top Row
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  headerIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerIconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContent: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94a3b8',
  },
  statusDotActive: {
    backgroundColor: '#10b981',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    fontFamily: 'Poppins-SemiBold',
  },

  // Quick Actions
  headerQuickActions: {
    flexDirection: 'row',
    gap: 10,
  },
  quickActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  quickActionBtnActive: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  quickActionBtnPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.8,
  },
  profileInitialsSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  profileInitialsText: {
    color: '#0EA5E9',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
    fontFamily: 'Poppins-Bold',
  },
  quickActionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#10b981',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#0f172a',
  },
  quickActionBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    overflow: 'hidden',
  },
  statIconBg: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statContent: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    fontFamily: 'Poppins-SemiBold',
    // textTransform: 'uppercase', // Removed to fix wrapping
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },

  // Action Toolbar
  actionToolbar: {
    flexDirection: 'row',
    gap: 8,
  },
  toolbarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  toolbarBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  toolbarBtnDisabled: {
    opacity: 0.4,
  },
  toolbarBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    fontFamily: 'Poppins-Bold',
  },
  toolbarBtnTextActive: {
    color: '#ef4444',
  },
  toolbarBtnTextDisabled: {
    color: '#475569',
  },

  // Group Banner
  groupBannerWrapper: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  groupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  groupBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  groupBannerIconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupBannerContent: {
    flex: 1,
    gap: 3,
  },
  groupBannerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
  groupBannerStats: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Poppins-SemiBold',
  },

  // Legacy styles (kept for compatibility)
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900', fontFamily: 'Poppins-Bold' },
  headerStats: { marginTop: 4, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statText: { color: 'rgba(255,255,255,0.95)', fontWeight: '700', fontSize: 11, fontFamily: 'Poppins-Bold' },
  headerStatusRow: { paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },

  mapCard: { height: 420, marginHorizontal: 14, borderRadius: 18, overflow: 'hidden', backgroundColor: '#1e293b', marginTop: 12, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  map: { width: '100%', height: '100%' },
  professionalMarkerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
  },
  markerPulseOuter: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: mapTheme.colors.gps.accuracy,
    borderWidth: 2,
    borderColor: mapTheme.colors.gps.pulse,
  },
  markerPulseInner: {
    position: 'absolute',
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: mapTheme.accuracy.inner.fillColor,
    borderWidth: 2,
    borderColor: mapTheme.accuracy.inner.color,
  },
  professionalMarkerMain: {
    width: mapTheme.markers.user.size,
    height: mapTheme.markers.user.size,
    borderRadius: mapTheme.markers.user.size / 2,
    borderWidth: mapTheme.markers.user.borderWidth,
    borderColor: mapTheme.markers.user.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerSpeedBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    backgroundColor: mapTheme.controls.backgroundColor,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: mapTheme.colors.gps.marker,
    minWidth: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerSpeedText: {
    fontSize: 9,
    fontWeight: '900',
    color: mapTheme.colors.gps.marker,
    fontFamily: 'Poppins-ExtraBold',
  },
  markerTrackingBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: mapTheme.colors.gps.active,
    borderWidth: 2,
    borderColor: '#fff',
  },
  // Profesyonel Callout - Zengin Bilgi Gösterimi
  professionalCallout: {
    backgroundColor: mapTheme.callout.backgroundColor,
    borderRadius: mapTheme.callout.borderRadius,
    padding: mapTheme.callout.padding,
    minWidth: 240,
    maxWidth: 280,
    borderWidth: 1,
    borderColor: mapTheme.callout.borderColor,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  calloutIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(6,182,212,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#083344',
    fontFamily: 'Poppins-ExtraBold',
    flex: 1,
  },
  calloutInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  calloutInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    flex: 1,
    minWidth: '45%',
  },
  calloutInfoLabel: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'Poppins-Regular',
    marginRight: 4,
  },
  calloutInfoValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#083344',
    fontFamily: 'Poppins-Bold',
  },
  calloutCoordinates: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  calloutCoordText: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
  },

  // Üye Marker Stilleri - Profesyonel İkonlu
  memberMarkerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
  },
  memberMarkerMain: {
    width: mapTheme.markers.group.size,
    height: mapTheme.markers.group.size,
    borderRadius: mapTheme.markers.group.size / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: mapTheme.markers.group.borderWidth,
    borderColor: mapTheme.markers.group.borderColor,
  },
  memberOnlineDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: mapTheme.colors.gps.active,
    borderWidth: 2,
    borderColor: '#fff',
  },

  // Diğer Kullanıcı Marker Stilleri
  otherUserMarkerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherUserMarkerMain: {
    width: mapTheme.markers.other.size,
    height: mapTheme.markers.other.size,
    borderRadius: mapTheme.markers.other.size / 2,
    backgroundColor: mapTheme.controls.backgroundColor,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: mapTheme.markers.other.borderWidth,
    borderColor: mapTheme.markers.other.color,
  },

  // Grup Merkezi Marker Stilleri
  groupCenterMarkerWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 60,
    height: 60,
  },
  groupCenterMarkerMain: {
    width: mapTheme.markers.center.size,
    height: mapTheme.markers.center.size,
    borderRadius: mapTheme.markers.center.size / 2,
    backgroundColor: mapTheme.markers.center.color,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: mapTheme.markers.center.borderWidth,
    borderColor: mapTheme.markers.center.borderColor,
    zIndex: 2,
  },
  groupCenterMarkerShadow: {
    position: 'absolute',
    bottom: 0,
    width: 40,
    height: 15,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 1,
  },

  // Member Callout Stilleri
  memberCallout: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    minWidth: 200,
  },
  memberCalloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  memberCalloutIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  memberCalloutTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#083344',
    fontFamily: 'Poppins-ExtraBold',
    flex: 1,
  },
  memberCalloutInfo: {
    gap: 6,
  },
  memberCalloutStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberCalloutStatusText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
  memberCalloutLocation: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'Poppins-Regular',
  },

  // Other User Callout Stilleri
  otherUserCallout: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    minWidth: 180,
  },
  otherUserCalloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  otherUserCalloutIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(6,182,212,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  otherUserCalloutTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#083344',
    fontFamily: 'Poppins-Bold',
  },
  otherUserCalloutId: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
    fontFamily: 'Poppins-SemiBold',
  },
  otherUserCalloutLocation: {
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: 'Poppins-Regular',
  },

  // Group Center Callout Stilleri
  groupCenterCallout: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    minWidth: 220,
  },
  groupCenterCalloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupCenterCalloutIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  groupCenterCalloutTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#083344',
    fontFamily: 'Poppins-ExtraBold',
  },
  groupCenterCalloutAddress: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 6,
    fontFamily: 'Poppins-Regular',
  },
  groupCenterCalloutDistance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  groupCenterCalloutDistanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0EA5E9',
    fontFamily: 'Poppins-Bold',
  },

  // Eski stiller (geriye uyumluluk için)
  workerDot: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 2, borderColor: '#0EA5E9' },
  pulseWrapper: { alignItems: 'center', justifyContent: 'center' },
  pulseCircle: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(6,182,212,0.12)' },
  otherUserMarker: { padding: 8, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(4,47,53,0.06)' },
  targetMarker: { padding: 8, borderRadius: 12, backgroundColor: '#fff5f5', borderWidth: 1, borderColor: 'rgba(127,29,29,0.25)' },
  calloutCard: { backgroundColor: '#fff', padding: 8, borderRadius: 8 },
  calloutSub: { fontSize: 12, color: '#64748b', fontFamily: 'Poppins-Regular' },


  controlPanel: {
    marginHorizontal: 14,
    marginBottom: Platform.OS === 'ios' ? 30 : 40,
    marginTop: 6
  },
  searchSection: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Poppins-ExtraBold',
    marginBottom: 4,
  },
  searchCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 16,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.15)',
  },
  searchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 4,
  },
  searchBtnGradient: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  quickActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  quickActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
    flex: 1,
    textAlign: 'center',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
  },
  searchBtn: {
    marginLeft: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  callBtn: { width: 46, height: 46, marginLeft: 8, borderRadius: 12, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonStart: { backgroundColor: '#0EA5E9' },
  buttonStop: { backgroundColor: '#ef4444' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'Poppins-Bold' },
  secondaryButton: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  secondaryText: { color: '#fff', fontSize: 14, fontWeight: '700', fontFamily: 'Poppins-Bold' },
  secondaryMeta: { color: '#64748b', fontSize: 12, fontFamily: 'Poppins-Regular' },

  metricsRow: { marginTop: 12, backgroundColor: '#1e293b', borderRadius: 14, padding: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', borderWidth: 1, borderColor: '#334155' },
  metricItem: { width: (width - 56) / 3, marginBottom: 6 },
  metricLabel: { fontSize: 11, color: '#94a3b8', fontFamily: 'Poppins-Regular' },
  metricVal: { fontSize: 13, color: '#fff', fontWeight: '800', fontFamily: 'Poppins-ExtraBold' },
  modalContainer: { flex: 1, backgroundColor: '#0f172a' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 25, borderBottomWidth: 1, borderColor: '#eceff1', paddingTop: 79 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#fff', fontFamily: 'Poppins-Bold' },
  modalClose: { padding: 8 },
  modalList: { paddingHorizontal: 12 },
  userRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#1e293b', borderRadius: 14, marginVertical: 8, borderWidth: 1, borderColor: '#334155' },
  avatar: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#334155', marginRight: 12 },
  avatarText: { color: '#0EA5E9', fontWeight: '900' },
  userName: { fontWeight: '900', color: '#fff' },
  userSub: { fontSize: 12, color: '#64748b' },
  gotoBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#0EA5E9', borderRadius: 8 },
  gotoText: { color: '#fff', fontWeight: '700' },
  groupInfoBanner: {
    marginTop: 10,
    marginHorizontal: 14,
    borderRadius: 14,
    overflow: 'hidden',
  },
  groupInfoGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
  },
  groupInfoName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'Poppins-Bold',
    marginBottom: 2,
  },
  groupInfoStats: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },

  permissionWarningCard: {
    marginHorizontal: 14,
    marginTop: 14,
    backgroundColor: '#1e293b',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
  },
  permissionWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  permissionWarningTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    fontFamily: 'Poppins-Bold',
    flex: 1,
  },
  permissionWarningText: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    fontFamily: 'Poppins-Regular',
  },
  permissionWarningActions: {
    flexDirection: 'row',
    gap: 10,
  },
  permissionWarningButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  permissionWarningButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#0EA5E9',
  },
  permissionWarningButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'Poppins-Bold',
  },
  permissionWarningButtonTextSecondary: {
    color: '#0EA5E9',
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'Poppins-Bold',
  },

  // Track Info Modal Styles
  trackInfoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  trackInfoModal: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.3)',
    backgroundColor: 'transparent',
  },
  trackInfoGradient: {
    minHeight: 400,
    maxHeight: '90%',
  },
  trackInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  trackInfoIconWrapper: {
    marginRight: 16,
  },
  trackInfoIconGradient: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfoHeaderText: {
    flex: 1,
  },
  trackInfoTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
    marginBottom: 4,
  },
  trackInfoSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'Poppins-Regular',
  },
  trackInfoClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfoContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  trackInfoStep: {
    marginBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  trackInfoStepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  trackInfoStepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  trackInfoStepNumberText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'Poppins-Bold',
  },
  trackInfoStepContent: {
    flex: 1,
  },
  trackInfoStepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  trackInfoStepTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
  trackInfoStepDescription: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 12,
    fontFamily: 'Poppins-Regular',
  },
  trackInfoStepFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  trackInfoStepFeatureText: {
    fontSize: 12,
    color: '#cbd5e1',
    fontFamily: 'Poppins-Regular',
  },
  trackInfoAdvanced: {
    marginTop: 8,
    marginBottom: 24,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  trackInfoAdvancedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  trackInfoAdvancedIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfoAdvancedTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
  trackInfoAdvancedDescription: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 20,
    marginBottom: 16,
    fontFamily: 'Poppins-Regular',
  },
  trackInfoAdvancedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  trackInfoAdvancedItem: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 12,
  },
  trackInfoAdvancedItemLabel: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
  },
  trackInfoPlans: {
    marginBottom: 24,
  },
  trackInfoPlansTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 16,
    fontFamily: 'Poppins-Bold',
  },
  trackInfoPlanCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  trackInfoPlanCardHighlight: {
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderColor: 'rgba(124,58,237,0.3)',
    borderWidth: 2,
  },
  trackInfoPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  trackInfoPlanName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
    flex: 1,
  },
  trackInfoPlanBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trackInfoPlanBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
  trackInfoPlanDetail: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'Poppins-Regular',
    marginLeft: 28,
  },
  trackInfoFooter: {
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  trackInfoButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  trackInfoButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  trackInfoButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'Poppins-Bold',
  },
  vehicleStatusCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  vehicleStatusGradient: {
    padding: 12,
    borderRadius: 12,
  },
  vehicleStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleStatusInfo: {
    flex: 1,
    marginLeft: 12,
  },
  vehicleStatusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  vehicleStatusSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },

  // Group Selector FAB - Premium Floating Button
  groupSelectorFAB: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 110 : 120,
    left: 16,
    right: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  groupFABGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  groupFABContent: {
    flex: 1,
    gap: 4,
  },
  groupFABText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
  groupFABStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupFABOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  groupFABStatsText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Poppins-Medium',
  },

  // Group Selector Modal Styles
  groupSelectorHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  groupSelectorHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupSelectorIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
  },
  groupSelectorIconGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupSelectorTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
  groupSelectorSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    fontFamily: 'Poppins-Regular',
    marginTop: 2,
  },
  groupSelectorClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
  },

  // Group Cards
  groupSelectorCard: {
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  groupSelectorCardSelected: {
    borderColor: '#06b6d4',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  groupSelectorCardGradient: {
    padding: 20,
    position: 'relative',
  },
  groupSelectorCardBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  groupSelectorCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  groupSelectorCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
  },
  groupSelectorCardIconBg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupSelectorCardName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 6,
    fontFamily: 'Poppins-Bold',
  },
  groupSelectorCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupSelectorCardAddress: {
    fontSize: 13,
    color: '#64748b',
    fontFamily: 'Poppins-Regular',
    flex: 1,
  },
  groupSelectorCardStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  groupSelectorCardStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  groupSelectorCardStatDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  groupSelectorCardStatText: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'Poppins-Medium',
  },

  // Empty State
  groupSelectorEmpty: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  groupSelectorEmptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  groupSelectorEmptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 12,
    fontFamily: 'Poppins-Bold',
  },
  groupSelectorEmptyText: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    fontFamily: 'Poppins-Regular',
  },
  groupSelectorEmptyButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  groupSelectorEmptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  groupSelectorEmptyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
});
