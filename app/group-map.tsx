// GroupMapScreen.tsx - Yönetici Perspektifi (Admin Dashboard)
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import React from 'react';
import {
    ActivityIndicator,
    Animated,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io, Socket } from 'socket.io-client';
import { Toast, useToast } from '../components/Toast';
import { getApiBase } from '../utils/api';
import { getMapFeatures, getMapLayers, type MapFeatures } from '../utils/mapFeatures';
import LeafletMap from '../components/leaflet-map';

const API_BASE = getApiBase();
const BACKGROUND_LOCATION_TASK = 'GROUP_BACKGROUND_LOCATION_TASK';

// --- types ---
interface GroupLocation {
    lat: number;
    lng: number;
    heading: number | null;
    accuracy: number | null;
    timestamp: number;
    geocode?: {
        city: string;
        province: string;
        district?: string;
        fullAddress?: string;
        country?: string;
    } | null;
}

interface MemberWithLocation {
    userId: string;
    displayName: string;
    email: string;
    role: string;
    joinedAt: number;
    location: GroupLocation | null;
    isOnline: boolean;
    lastSeen: number | null;
    // computed client-side (optional)
    distanceFromCenter?: number; // meters
    inWorkArea?: boolean;
}

interface GroupInfo {
    id: string;
    code: string;
    name: string;
    address: string;
    lat: number | null;
    lng: number | null;
    memberCount: number;
    // optional geofence radius (meters). If absent, default will be applied on client
    workRadius?: number;
}

// SecureStore keys must be [A-Za-z0-9_.-], no colon
const PERSIST_KEY = (groupId: string) => `sharePersistent_${groupId}`;

// --- helpers: distance & formatting ---
function toRad(v: number) { return (v * Math.PI) / 180; }
function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
    const R = 6371e3;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return Math.round(R * c);
}
function fmtMeters(m?: number | null) {
    if (m == null) return '-';
    if (m < 1000) return `${m} m`;
    return `${(m / 1000).toFixed(2)} km`;
}

// Background task definition
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
    if (error) {
        console.error('Background location error:', error);
        return;
    }

    if (data) {
        const taskData = data as LocationTaskData;
        const { locations } = taskData;
        if (!locations || locations.length === 0) return;
        const location = locations[0];

        if (!location) return;

        try {
            // Get stored groupId and userId
            const groupId = await SecureStore.getItemAsync('activeGroupId');
            const userId = await SecureStore.getItemAsync('workerId');

            if (!groupId || !userId) return;

            const payload = {
                userId,
                lat: location.coords.latitude,
                lng: location.coords.longitude,
                heading: location.coords.heading,
                accuracy: location.coords.accuracy,
                timestamp: location.timestamp
            };

            // Send to backend
            await fetch(`${API_BASE}/api/groups/${groupId}/locations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            console.log('Background location sent:', payload);
        } catch (e) {
            console.error('Background location send error:', e);
        }
    }
});

export default function GroupMapScreen() {
    console.log('[GroupMap] Component rendering');
    const router = useRouter();
    const { toast, showError, showSuccess, showWarning, showInfo, hideToast } = useToast();
    const params = useLocalSearchParams();
    const groupId = (params.groupId as string) || '';
    const groupCode = (params.groupCode as string) || '';
    console.log('[GroupMap] Params - groupId:', groupId, 'groupCode:', groupCode);

    const [groupInfo, setGroupInfo] = React.useState<GroupInfo | null>(null);
    const [membersWithLocations, setMembersWithLocations] = React.useState<MemberWithLocation[]>([]);
    const [locations, setLocations] = React.useState<Record<string, GroupLocation>>({});
    const [selectedMember, setSelectedMember] = React.useState<MemberWithLocation | null>(null);
    const [showMemberModal, setShowMemberModal] = React.useState(false);
    const [refreshing, setRefreshing] = React.useState(false);
    const [myLocation, setMyLocation] = React.useState<Location.LocationObject | null>(null);
    const [mapLoading, setMapLoading] = React.useState<boolean>(true);

    const [isSharing, setIsSharing] = React.useState(false);
    const [sharingLoading, setSharingLoading] = React.useState(false);
    const [persistShare, setPersistShare] = React.useState(false);

    const [userId, setUserId] = React.useState('');
    const [mapFeatures, setMapFeatures] = React.useState<MapFeatures | null>(null);
    const [availableLayers, setAvailableLayers] = React.useState<Record<string, any>>({});

    // Animasyonlar
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const slideAnim = React.useRef(new Animated.Value(50)).current;
    const pulseAnim = React.useRef(new Animated.Value(1)).current;
    const statsScaleAnim = React.useRef(new Animated.Value(0.95)).current;

    const socketRef = React.useRef<Socket | null>(null);
    const subscriptionRef = React.useRef<Location.LocationSubscription | null>(null);
    const resendIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
    const lastPayloadRef = React.useRef<any | null>(null);

    // Türkiye merkez koordinatları - Profesyonel GPS takip için
    const TURKEY_CENTER = { latitude: 39.0, longitude: 35.2433 };
    const TURKEY_REGION = {
        latitude: TURKEY_CENTER.latitude,
        longitude: TURKEY_CENTER.longitude,
        latitudeDelta: 13.0,
        longitudeDelta: 20.0
    };

    // Responsive map height calculation (professional defaults)
    const windowHeight = Dimensions.get('window').height;
    const MAP_MIN_HEIGHT = 160; // small devices
    const MAP_MAX_HEIGHT = Math.round(windowHeight * 0.55); // allow up to 55% of screen
    // estimated chrome (header + paddings) and footer (members panel)
    const EST_HEADER = (StatusBar.currentHeight ?? 24) + 120; // header area
    const EST_FOOTER = 160; // members panel and margins
    const initialMapHeight = Math.max(MAP_MIN_HEIGHT, Math.min(MAP_MAX_HEIGHT, windowHeight - EST_HEADER - EST_FOOTER));
    const [mapHeight, setMapHeight] = React.useState<number>(initialMapHeight);

    React.useEffect(() => {
        const handle = ({ window }: { window: { height: number; width: number } }) => {
            const wh = window.height;
            const maxH = Math.round(wh * 0.55);
            const est = Math.max(MAP_MIN_HEIGHT, Math.min(maxH, wh - EST_HEADER - EST_FOOTER));
            setMapHeight(est);
        };
        // Dimensions API differences across RN versions
        const sub: any = Dimensions.addEventListener ? Dimensions.addEventListener('change', handle) : null;
        if (!sub) {
            // fallback for older RN: keep no-op (listener not critical)
        }
        return () => {
            try { if (sub && sub.remove) sub.remove(); } catch { }
        };
    }, []);


    // --- initial load: workerId + persisted preference ---
    React.useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const stored = await SecureStore.getItemAsync('workerId');
                const persistValue = await SecureStore.getItemAsync(PERSIST_KEY(groupId));
                if (!mounted) return;
                if (stored) setUserId(stored);
                setPersistShare(persistValue === '1');
            } catch (e) {
                console.warn('initial load error', e);
            }
        })();
        return () => { mounted = false; };
    }, [groupId]);

    const loadMembersWithLocations = React.useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/groups/${groupId}/members-with-locations`, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (res.ok) {
                const responseData = await res.json();
                const data = responseData.data || responseData;
                if (Array.isArray(data)) {
                    setMembersWithLocations(data);
                    await AsyncStorage.setItem(`group_members_${groupId}`, JSON.stringify(data));
                }
            }
        } catch (e) {
            console.warn('Load members error:', e);
            try {
                const cached = await AsyncStorage.getItem(`group_members_${groupId}`);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) {
                        setMembersWithLocations(parsed);
                    }
                }
            } catch { }
        }
    }, [groupId]);

    interface GroupLocationPayload {
        userId: string;
        groupId: string;
        lat: number;
        lng: number;
        heading: number | null;
        accuracy: number | null;
        timestamp: number;
    }

    const safeSendLocation = React.useCallback(async (payload: GroupLocationPayload) => {
        lastPayloadRef.current = payload;
        console.log('[GroupMap] 🚀 Sending location:', {
            userId: payload.userId,
            groupId: payload.groupId,
            lat: payload.lat,
            lng: payload.lng
        });

        try {
            const s = socketRef.current;
            if (s && (s as any).connected) {
                console.log('[GroupMap] ✅ Sending via Socket.IO');
                s.emit('group_location_update', payload);
                return;
            } else {
                console.log('[GroupMap] ⚠️ Socket not connected, using HTTP fallback');
            }
        } catch (e) {
            console.warn('[GroupMap] ❌ Socket emit failed', e);
        }

        try {
            const response = await fetch(`${API_BASE}/api/groups/${groupId}/locations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            console.log('[GroupMap] 📡 HTTP fallback response:', response.status);
        } catch (err) {
            console.warn('[GroupMap] ❌ Fallback POST failed', err);
        }
    }, [groupId]);

    const stopLocationSharing = React.useCallback(() => {
        setSharingLoading(true);
        try {
            setIsSharing(false);
            if (subscriptionRef.current) {
                try { subscriptionRef.current.remove(); } catch (e) { console.warn(e); }
                subscriptionRef.current = null;
            }
            if (resendIntervalRef.current) {
                clearInterval(resendIntervalRef.current);
                resendIntervalRef.current = null;
            }
            console.log('[GroupMap] 🛑 Location sharing stopped');
        } catch (e) {
            console.error('[GroupMap] Stop sharing error:', e);
        } finally {
            setSharingLoading(false);
        }
    }, []);

    // --- socket lifecycle + reconnect handling ---
    React.useEffect(() => {
        if (!groupId) {
            console.log('[GroupMap] No groupId, skipping socket');
            return;
        }

        console.log('[GroupMap] Setting up socket for group:', groupId);
        const s = io(API_BASE, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000
        });
        socketRef.current = s;

        const join = () => {
            try {
                console.log('[GroupMap] Emitting join_group:', groupId);
                s.emit('join_group', groupId);
            } catch (e) {
                console.error('[GroupMap] Join group error:', e);
            }
            if (isSharing && lastPayloadRef.current) {
                safeSendLocation(lastPayloadRef.current);
            }
        };

        s.on('connect', () => { console.log('[GroupMap] Socket connected'); join(); });
        s.on('reconnect', () => { console.log('[GroupMap] Socket reconnected'); join(); });
        s.on('location_update', (data: { groupId: string; userId: string; location: GroupLocation }) => {
            try {
                console.log('[GroupMap] 📍 Location update received:', {
                    userId: data.userId,
                    lat: data.location?.lat,
                    lng: data.location?.lng,
                    timestamp: data.location?.timestamp
                });
                if (data.groupId !== groupId) {
                    console.log('[GroupMap] ⚠️ GroupId mismatch, ignoring');
                    return;
                }
                setLocations(prev => {
                    const updated = { ...prev, [data.userId]: data.location };
                    console.log('[GroupMap] 📌 Total locations now:', Object.keys(updated).length);
                    return updated;
                });
            } catch (e) {
                console.error('[GroupMap] Location update handler error:', e);
            }
        });
        s.on('member_approved', (data: { groupId: string; userId: string; displayName: string }) => {
            try {
                console.log('[GroupMap] Member approved:', data);
                if (data.groupId !== groupId) return;
                showSuccess(`${data.displayName} gruba katıldı`);
                loadMembersWithLocations();
            } catch (e) {
                console.error('[GroupMap] Member approved handler error:', e);
            }
        });
        s.on('geofence_violation', (data: { groupId: string; userId: string; distance: number; radius: number; center: { lat: number; lng: number }; at: number }) => {
            try {
                if (!data || data.groupId !== groupId) return;
                console.log('[GroupMap] ⚠️ Geofence violation:', data);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                const meters = data.distance;
                const msg = `Bir üye iş alanı dışında: ${meters} m (limit ${data.radius} m)`;
                showWarning(msg);
            } catch (e) {
                console.warn('[GroupMap] geofence_violation handler error:', e);
            }
        });
        s.on('connect_error', (err: Error) => console.error('[GroupMap] Socket connect error:', err));
        s.on('group_deleted', async (data: { groupId: string }) => {
            try {
                if (!data || data.groupId !== groupId) return;
                console.log('[GroupMap] Group deleted signal received for', data.groupId);
                stopLocationSharing();
                try {
                    await SecureStore.deleteItemAsync(PERSIST_KEY(groupId));
                } catch { }
                try {
                    await SecureStore.deleteItemAsync('activeGroupId');
                } catch { }
                try { await AsyncStorage.removeItem(`group_members_${groupId}`); } catch { }
                showWarning('Grup silindi. Ekran kapatılıyor.');
                // Navigate back to groups
                setTimeout(() => {
                    try { router.replace('/(tabs)/groups' as any); } catch { }
                }, 300);
            } catch (e) {
                console.warn('[GroupMap] group_deleted handling failed', e);
            }
        });
        s.on('disconnect', (reason: string) => console.log('[GroupMap] Socket disconnected:', reason));

        return () => {
            console.log('[GroupMap] Cleaning up socket');
            try { s.off(); s.disconnect(); } catch (e) {
                console.warn('[GroupMap] Socket cleanup error:', e);
            }
            socketRef.current = null;
        };
    }, [groupId, stopLocationSharing, showWarning, router, loadMembersWithLocations, isSharing, safeSendLocation]);

    // --- load initial backend data ---
    const loadGroupInfo = React.useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/groups/${groupCode}/info`, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                const responseData = await response.json();
                const info = responseData.data || responseData;
                if (info && typeof info === 'object') {
                    const withRadius: GroupInfo = {
                        id: info.id || '',
                        code: info.code || groupCode,
                        name: info.name || 'Grup',
                        address: info.address || '',
                        lat: typeof info.lat === 'number' ? info.lat : null,
                        lng: typeof info.lng === 'number' ? info.lng : null,
                        memberCount: typeof info.memberCount === 'number' ? info.memberCount : 0,
                        workRadius: typeof info.workRadius === 'number' ? info.workRadius : 150
                    };
                    setGroupInfo(withRadius);
                }
            }
        } catch (e) {
            console.warn('Load group info error:', e);
        }
    }, [groupCode]);


    const loadLocations = React.useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/groups/${groupId}/locations`, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (res.ok) {
                const responseData = await res.json();
                const data = responseData.data || responseData;
                if (data.locations && typeof data.locations === 'object') {
                    const locationsMap: Record<string, GroupLocation> = {};
                    if (Array.isArray(data.locations)) {
                        data.locations.forEach((loc: any) => {
                            if (loc.userId && loc.location) {
                                locationsMap[loc.userId] = loc.location;
                            }
                        });
                    } else {
                        Object.entries(data.locations).forEach(([userId, loc]: [string, any]) => {
                            if (loc && typeof loc === 'object' && loc.lat && loc.lng) {
                                locationsMap[userId] = loc as GroupLocation;
                            }
                        });
                    }
                    setLocations(locationsMap);
                    // first successful load -> hide map loading indicator
                    setMapLoading(false);
                }
            }
        } catch (e) {
            console.warn('Load locations error:', e);
            // tolerate errors but stop showing initial loader after a moment
            setTimeout(() => setMapLoading(false), 1000);
        }
    }, [groupId]);

    // Poll locations periodically as a robust fallback (uses socket for realtime)
    React.useEffect(() => {
        if (!groupId) return;
        const id = setInterval(() => {
            loadLocations().catch(() => { });
        }, 10000); // every 10s
        return () => clearInterval(id);
    }, [groupId, loadLocations]);

    React.useEffect(() => {
        if (!groupId) return;
        loadGroupInfo();
        loadMembersWithLocations();
        loadLocations();

        (async () => {
            try {
                const features = await getMapFeatures();
                const layers = await getMapLayers();
                setMapFeatures(features);
                setAvailableLayers(layers);
            } catch (e) {
                console.warn('[GroupMap] Map features load error:', e);
            }
        })();

        // Giriş animasyonu
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.spring(statsScaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 7,
                useNativeDriver: true,
            }),
        ]).start();

        // Pulse animasyonu
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [groupId, loadGroupInfo, loadMembersWithLocations, loadLocations]);

    // Refresh handler
    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await Promise.all([
            loadGroupInfo(),
            loadMembersWithLocations(),
            loadLocations()
        ]);
        setRefreshing(false);
    }, [loadGroupInfo, loadMembersWithLocations, loadLocations]);

    // Tüm konumları göster (benim + çalışanlar)
    const fitAllLocations = React.useCallback(() => {
        const allCoords: Array<{ latitude: number; longitude: number }> = [];

        // Benim konumum
        if (myLocation) {
            allCoords.push({
                latitude: myLocation.coords.latitude,
                longitude: myLocation.coords.longitude
            });
        }

        // Tüm çalışanlar
        Object.values(locations).forEach(loc => {
            allCoords.push({ latitude: loc.lat, longitude: loc.lng });
        });

        // Grup merkezi
        if (groupInfo?.lat && groupInfo?.lng) {
            allCoords.push({ latitude: groupInfo.lat, longitude: groupInfo.lng });
        }

        if (allCoords.length === 0) return;
    }, [myLocation, locations, groupInfo]);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            fitAllLocations();
        }, 500);
        return () => clearTimeout(timer);
    }, [fitAllLocations, locations, myLocation, groupInfo?.lat, groupInfo?.lng]);

    // Üyeye odaklan
    const focusOnMember = React.useCallback((member: MemberWithLocation) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (member.location) {
        }
        setSelectedMember(member);
        setShowMemberModal(true);
    }, []);

    // Online üye sayısı
    const onlineCount = membersWithLocations.filter(m => m.isOnline).length;
    const adminCount = membersWithLocations.filter(m => m.role === 'admin').length;

    // --- permission request once ---
    React.useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (!mounted) return;
                if (status === 'granted') {
                    const last = await Location.getLastKnownPositionAsync();
                    if (last) setMyLocation(last);
                }
            } catch (e) { console.warn('perm error', e); }
        })();
        return () => { mounted = false; };
    }, []);

    // --- start sharing (robust) ---
    const startLocationSharing = React.useCallback(async () => {
        console.log('[GroupMap] 🟢 Starting location sharing...');
        setSharingLoading(true);
        try {
            // ensure userId
            let currentUserId = userId;
            if (!currentUserId) {
                try {
                    const stored = await SecureStore.getItemAsync('workerId');
                    if (stored) {
                        currentUserId = stored;
                        setUserId(stored);
                        console.log('[GroupMap] 👤 UserId loaded:', currentUserId);
                    }
                } catch (e) {
                    console.warn('SecureStore error:', e);
                }
            }

            if (!currentUserId) {
                console.log('[GroupMap] ❌ No userId, cannot start sharing');
                showError('Lütfen önce giriş yapın.');
                return;
            }

            console.log('[GroupMap] ✅ UserId confirmed:', currentUserId);

            // ensure permission
            const fg = await Location.getForegroundPermissionsAsync();
            if (fg.status !== 'granted') {
                const req = await Location.requestForegroundPermissionsAsync();
                if (req.status !== 'granted') {
                    showError('Konum izni verilmedi.');
                    return;
                }
            }

            // persist preference if requested by ui (handled separately)
            try { await SecureStore.setItemAsync('workerId', currentUserId); } catch (e) { }

            console.log('[GroupMap] 📍 Starting location watch...');

            // start watch
            const sub = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.High, timeInterval: 8000, distanceInterval: 5 },
                async (location) => {
                    console.log('[GroupMap] 📡 Location update from GPS:', {
                        lat: location.coords.latitude,
                        lng: location.coords.longitude,
                        accuracy: location.coords.accuracy
                    });
                    setMyLocation(location);
                    const payload = {
                        userId: currentUserId,
                        groupId,
                        lat: location.coords.latitude,
                        lng: location.coords.longitude,
                        heading: location.coords.heading ?? null,
                        accuracy: location.coords.accuracy ?? null,
                        timestamp: location.timestamp,
                    };
                    await safeSendLocation(payload);
                }
            );

            if (!sub) throw new Error('Watch subscription failed');
            subscriptionRef.current = sub;
            setIsSharing(true);
            console.log('[GroupMap] ✅ Location sharing started successfully!');
            showSuccess('Konum paylaşımı başladı');

            // start resend interval — keeps server updated during flaky reconnects (cleared on stop)
            if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
            resendIntervalRef.current = setInterval(() => {
                if (lastPayloadRef.current) {
                    console.log('[GroupMap] 🔄 Resending last location (keep-alive)');
                    safeSendLocation(lastPayloadRef.current);
                }
            }, 30000); // every 30s
        } catch (e) {
            console.error('[GroupMap] ❌ Start sharing error:', e);
            showError('Konum paylaşımı başlatılamadı.');
            setIsSharing(false);
        } finally {
            setSharingLoading(false);
        }
    }, [groupId, userId]);


    // --- toggle with persistent preference saved ---
    const toggleLocationSharing = React.useCallback(async () => {
        if (sharingLoading) return;
        Haptics.notificationAsync(
            isSharing ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success
        );
        if (isSharing) {
            // turning off: also clear persist setting
            stopLocationSharing();
            try { await SecureStore.deleteItemAsync(PERSIST_KEY(groupId)); setPersistShare(false); } catch { }
        } else {
            await startLocationSharing();
            // if user chose to persist via UI, that action should save the key; here we keep current persistShare
            if (persistShare) {
                try { await SecureStore.setItemAsync(PERSIST_KEY(groupId), '1'); } catch { }
            }
        }
    }, [isSharing, startLocationSharing, stopLocationSharing, sharingLoading, persistShare, groupId]);

    // --- auto-start sharing if persisted ---
    React.useEffect(() => {
        let mounted = true;
        (async () => {
            if (!groupId) return;
            try {
                const p = await SecureStore.getItemAsync(PERSIST_KEY(groupId));
                if (!mounted) return;
                if (p === '1') {
                    setPersistShare(true);
                    // auto-start after tiny delay to let socket connect
                    setTimeout(() => {
                        if (!isSharing) startLocationSharing().catch((e) => console.warn('autostart failed', e));
                    }, 800);
                }
            } catch (e) { console.warn('autostart check failed', e); }
        })();
        return () => { mounted = false; };
    }, [groupId]);

    // --- cleanup on unmount ---
    React.useEffect(() => {
        return () => {
            stopLocationSharing();
            try { socketRef.current?.disconnect(); } catch (e) { }
        };
    }, [stopLocationSharing]);

    // --- UI helpers ---
    function formatDistance(m: number) {
        if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
        return `${Math.round(m)} m`;
    }

    // Haversine mesafe hesaplama (metre)
    function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371000; // Dünya yarıçapı (metre)
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Grup merkezine olan mesafe
    const distanceToCenter = React.useMemo(() => {
        if (!myLocation || !groupInfo?.lat || !groupInfo?.lng) return null;
        return calculateDistance(
            myLocation.coords.latitude,
            myLocation.coords.longitude,
            groupInfo.lat,
            groupInfo.lng
        );
    }, [myLocation, groupInfo]);

    // --- Render ---
    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <LinearGradient colors={["#0EA5E9", "#0ea5a4"]} style={styles.header} start={[0, 0]} end={[1, 1]}>
                <View style={styles.headerContent}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Pressable onPress={() => {
                            router.back();
                        }} style={styles.backBtn} accessibilityLabel="Geri dön">
                            <Ionicons name="chevron-back" size={22} color="#042f35" />
                        </Pressable>
                        <View style={{ marginLeft: 8 }}>
                            <Text style={styles.title}>{groupInfo?.name || 'Grup Haritası'}</Text>
                            <Text style={styles.subtitle}>
                                {groupInfo?.memberCount || 0} üye • {Object.keys(locations).length} aktif
                                {distanceToCenter !== null && (
                                    <Text style={{ color: distanceToCenter > 1000 ? '#f59e0b' : '#10b981', flexDirection: 'row', alignItems: 'center' }}>
                                        {' • '}<Ionicons name="location" size={12} color={distanceToCenter > 1000 ? '#f59e0b' : '#10b981'} />{' '}{formatDistance(distanceToCenter)}
                                    </Text>
                                )}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.headerActions}>
                        {/* Hepsini Göster butonu */}
                        <Pressable
                            onPress={fitAllLocations}
                            style={styles.actionButton}
                            accessibilityLabel="Hepsini göster"
                        >
                            <Ionicons name="scan-outline" size={20} color="#042f35" />
                        </Pressable>

                        {mapFeatures?.satelliteView && (
                            <Pressable
                                onPress={() => setMapType((t) => (t === 'standard' ? 'hybrid' : 'standard'))}
                                style={[styles.actionButton]}
                                accessibilityLabel="Harita türü"
                            >
                            </Pressable>
                        )}
                        {mapFeatures?.exportMap && (
                            <Pressable
                                onPress={async () => {
                                    try {
                                        const { exportMap } = await import('../utils/mapFeatures');
                                        await exportMap(null, 'png', [], []);
                                        showSuccess('Harita export ediliyor...');
                                    } catch (e) {
                                        showError('Harita export edilemedi');
                                    }
                                }}
                                style={[styles.actionButton]}
                                accessibilityLabel="Harita export"
                            >
                                <Ionicons name="download-outline" size={18} color="#042f35" />
                            </Pressable>
                        )}

                        {/* persistent toggle (press to toggle persist) */}
                        <Pressable
                            onPress={async () => {
                                const next = !persistShare;
                                setPersistShare(next);
                                try {
                                    if (next) await SecureStore.setItemAsync(PERSIST_KEY(groupId), '1');
                                    else await SecureStore.deleteItemAsync(PERSIST_KEY(groupId));
                                } catch (e) { console.warn('persist toggle error', e); }
                            }}
                            onLongPress={() => showInfo('Açık ise uygulama yeniden başlatıldığında konum paylaşımı otomatik devam eder.')}
                            style={[styles.persistBtn, persistShare && styles.persistBtnActive]}
                            accessibilityLabel="Kalıcı paylaşım"
                        >
                            <Ionicons name="save" size={16} color={persistShare ? '#fff' : '#0EA5E9'} />
                        </Pressable>

                        <Pressable
                            onPress={toggleLocationSharing}
                            style={[styles.actionButton, isSharing && styles.actionButtonActive]}
                            accessibilityLabel="Konum paylaşımını değiştir"
                            disabled={sharingLoading}
                        >
                            {sharingLoading ? (
                                <ActivityIndicator size="small" color={isSharing ? '#fff' : '#0EA5E9'} />
                            ) : (
                                <Ionicons name={isSharing ? 'location' : 'location-outline'} size={18} color={isSharing ? '#fff' : '#0EA5E9'} />
                            )}
                        </Pressable>
                    </View>
                </View>
            </LinearGradient>

            <View style={styles.mapContainer}>
                <LeafletMap
                    centerLat={groupInfo?.lat ?? 38.9637}
                    centerLng={groupInfo?.lng ?? 35.2433}
                    height={mapHeight}
                    onReady={() => setMapLoading(false)}
                    markers={(() => {
                        const allMarkers = [];

                        // Grup merkezi
                        if (groupInfo?.lat && groupInfo?.lng) {
                            allMarkers.push({
                                lat: groupInfo.lat,
                                lng: groupInfo.lng,
                                label: groupInfo.name,
                                color: '#7c3aed',
                                icon: '🚩'
                            });
                        }

                        // Benim konumum
                        if (myLocation) {
                            allMarkers.push({
                                lat: myLocation.coords.latitude,
                                lng: myLocation.coords.longitude,
                                label: 'Benim Konumum',
                                color: '#0EA5E9',
                                icon: '📍'
                            });
                        }

                        // Diğer üyelerin konumları
                        Object.entries(locations).forEach(([uid, loc]) => {
                            if (uid !== userId) {
                                const member = membersWithLocations.find(m => m.userId === uid);
                                const isAdmin = member?.role === 'admin';
                                let inWork = false;
                                if (groupInfo?.lat && groupInfo?.lng) {
                                    const distance = haversineMeters(groupInfo.lat, groupInfo.lng, loc.lat, loc.lng);
                                    inWork = distance <= (groupInfo.workRadius ?? 150);
                                }

                                allMarkers.push({
                                    lat: loc.lat,
                                    lng: loc.lng,
                                    label: member?.displayName || uid.slice(0, 8),
                                    color: inWork ? '#10b981' : '#ef4444',
                                    icon: isAdmin ? '👑' : '👤'
                                });
                            }
                        });

                        return allMarkers;
                    })()}
                />

                {mapLoading && (
                    <View style={styles.mapLoaderOverlay} pointerEvents="none">
                        <ActivityIndicator size="large" color="#0EA5E9" />
                    </View>
                )}

                <View style={styles.statusBar}>
                    <View style={styles.statusItem}>
                        <Ionicons name={isSharing ? 'radio-button-on' : 'radio-button-off'} size={16} color={isSharing ? '#10b981' : '#ef4444'} />
                        <Text style={[styles.statusText, isSharing && styles.statusTextActive]}>{isSharing ? 'Paylaşılıyor' : 'Paylaşılmıyor'}</Text>
                    </View>

                    {distanceToCenter !== null && (
                        <View style={styles.statusItem}>
                            <Ionicons name="navigate" size={16} color={distanceToCenter > 1000 ? '#f59e0b' : '#10b981'} />
                            <Text style={[styles.statusText, { color: distanceToCenter > 1000 ? '#f59e0b' : '#10b981', fontWeight: '700' }]}>
                                {formatDistance(distanceToCenter)}
                            </Text>
                        </View>
                    )}

                    <Text style={styles.statusText}>{Object.keys(locations).length} aktif üye</Text>
                </View>
            </View>

            {/* İstatistikler Paneli */}
            <Animated.View style={[styles.statsPanel, {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }, { scale: statsScaleAnim }]
            }]}>
                <View style={styles.statCard}>
                    <Ionicons name="people" size={20} color="#0EA5E9" />
                    <Text style={styles.statValue}>{membersWithLocations.length}</Text>
                    <Text style={styles.statLabel}>Toplam Üye</Text>
                </View>
                <View style={styles.statCard}>
                    <Ionicons name="radio-button-on" size={20} color="#10b981" />
                    <Text style={styles.statValue}>{onlineCount}</Text>
                    <Text style={styles.statLabel}>Online</Text>
                </View>
                <View style={styles.statCard}>
                    <Ionicons name="shield-checkmark" size={20} color="#f59e0b" />
                    <Text style={styles.statValue}>{adminCount}</Text>
                    <Text style={styles.statLabel}>Admin</Text>
                </View>
                {distanceToCenter !== null && (
                    <View style={styles.statCard}>
                        <Ionicons name="navigate" size={20} color={distanceToCenter > 1000 ? '#f59e0b' : '#10b981'} />
                        <Text style={styles.statValue}>{formatDistance(distanceToCenter)}</Text>
                        <Text style={styles.statLabel}>Mesafe</Text>
                    </View>
                )}
            </Animated.View>

            <View style={styles.membersContainer}>
                <View style={styles.membersHeader}>
                    <Text style={styles.membersTitle}>Grup Üyeleri ({membersWithLocations.length})</Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statBadge}>
                            <Ionicons name="radio-button-on" size={12} color="#10b981" />
                            <Text style={styles.statText}>{onlineCount} online</Text>
                        </View>
                        <View style={styles.statBadge}>
                            <Ionicons name="shield-checkmark" size={12} color="#f59e0b" />
                            <Text style={styles.statText}>{adminCount} admin</Text>
                        </View>
                    </View>
                </View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.membersList}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >
                    {membersWithLocations.map((member) => (
                        <Pressable
                            key={member.userId}
                            style={({ pressed }) => [
                                styles.memberCard,
                                pressed && { transform: [{ scale: 0.95 }], opacity: 0.8 }
                            ]}
                            onPress={() => focusOnMember(member)}
                            android_ripple={{ color: 'rgba(6, 182, 212, 0.2)', borderless: false }}
                        >
                            <View style={[styles.memberAvatar, member.isOnline && styles.memberAvatarOnline]}>
                                <Text style={styles.memberAvatarText}>{member.displayName.slice(0, 2).toUpperCase()}</Text>
                                {member.isOnline && <View style={styles.onlineIndicator} />}
                            </View>
                            <Text style={styles.memberName} numberOfLines={1}>{member.displayName}</Text>
                            <Text style={styles.memberRole}>{member.role === 'admin' ? '👑 Admin' : '👤 Üye'}</Text>
                            {member.location && (
                                <>
                                    {member.location.geocode && (
                                        <Text style={[styles.memberLocation, { color: '#0EA5E9', fontWeight: '700' }]}>
                                            {member.location.geocode.city || ''}
                                            {member.location.geocode.province ? `, ${member.location.geocode.province}` : ''}
                                        </Text>
                                    )}
                                    <Text style={styles.memberLocation}>
                                        {new Date(member.location.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </>
                            )}
                            {!member.isOnline && member.lastSeen && (
                                <Text style={styles.memberOffline}>
                                    {Math.floor((Date.now() - member.lastSeen) / 60000)}dk önce
                                </Text>
                            )}
                        </Pressable>
                    ))}
                </ScrollView>
            </View>

            {/* Üye Detay Modal */}
            <Modal
                visible={showMemberModal}
                animationType="slide"
                transparent
                onRequestClose={() => setShowMemberModal(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowMemberModal(false)}
                >
                    <View style={styles.modalContent}>
                        {selectedMember && (
                            <>
                                <View style={styles.modalHeader}>
                                    <View style={[styles.modalAvatar, selectedMember.isOnline && styles.modalAvatarOnline]}>
                                        <Text style={styles.modalAvatarText}>
                                            {selectedMember.displayName.slice(0, 2).toUpperCase()}
                                        </Text>
                                        {selectedMember.isOnline && <View style={styles.onlineIndicatorLarge} />}
                                    </View>
                                    <Pressable
                                        onPress={() => setShowMemberModal(false)}
                                        style={styles.modalClose}
                                    >
                                        <Ionicons name="close" size={24} color="#64748b" />
                                    </Pressable>
                                </View>

                                <Text style={styles.modalName}>{selectedMember.displayName}</Text>
                                <Text style={styles.modalEmail}>{selectedMember.email || selectedMember.userId}</Text>

                                <View style={styles.modalInfo}>
                                    <View style={styles.infoRow}>
                                        <Ionicons name="shield-checkmark" size={20} color="#f59e0b" />
                                        <Text style={styles.infoLabel}>Rol:</Text>
                                        <Text style={styles.infoValue}>
                                            {selectedMember.role === 'admin' ? 'Admin' : 'Üye'}
                                        </Text>
                                    </View>

                                    <View style={styles.infoRow}>
                                        <Ionicons
                                            name={selectedMember.isOnline ? "radio-button-on" : "radio-button-off"}
                                            size={20}
                                            color={selectedMember.isOnline ? "#10b981" : "#ef4444"}
                                        />
                                        <Text style={styles.infoLabel}>Durum:</Text>
                                        <Text style={[styles.infoValue, selectedMember.isOnline && styles.infoValueOnline]}>
                                            {selectedMember.isOnline ? 'Online' : 'Offline'}
                                        </Text>
                                    </View>

                                    {selectedMember.location && (
                                        <>
                                            {selectedMember.location.geocode && (
                                                <>
                                                    <View style={styles.infoRow}>
                                                        <Ionicons name="business" size={20} color="#0EA5E9" />
                                                        <Text style={styles.infoLabel}>Şehir:</Text>
                                                        <Text style={styles.infoValue}>
                                                            {selectedMember.location.geocode.city || 'Bilinmiyor'}
                                                        </Text>
                                                    </View>
                                                    <View style={styles.infoRow}>
                                                        <Ionicons name="map" size={20} color="#0EA5E9" />
                                                        <Text style={styles.infoLabel}>İl:</Text>
                                                        <Text style={styles.infoValue}>
                                                            {selectedMember.location.geocode.province || 'Bilinmiyor'}
                                                        </Text>
                                                    </View>
                                                    {selectedMember.location.geocode.district && (
                                                        <View style={styles.infoRow}>
                                                            <Ionicons name="location" size={20} color="#64748b" />
                                                            <Text style={styles.infoLabel}>İlçe:</Text>
                                                            <Text style={styles.infoValue}>
                                                                {selectedMember.location.geocode.district}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </>
                                            )}
                                            <View style={styles.infoRow}>
                                                <Ionicons name="location" size={20} color="#0EA5E9" />
                                                <Text style={styles.infoLabel}>Koordinat:</Text>
                                                <Text style={styles.infoValue}>
                                                    {selectedMember.location.lat.toFixed(6)}, {selectedMember.location.lng.toFixed(6)}
                                                </Text>
                                            </View>
                                            {selectedMember.location.geocode?.fullAddress && (
                                                <View style={styles.infoRow}>
                                                    <Ionicons name="map-outline" size={20} color="#64748b" />
                                                    <Text style={styles.infoLabel}>Adres:</Text>
                                                    <Text style={[styles.infoValue, { fontSize: 12 }]}>
                                                        {selectedMember.location.geocode.fullAddress}
                                                    </Text>
                                                </View>
                                            )}
                                            {selectedMember.location.accuracy && (
                                                <View style={styles.infoRow}>
                                                    <Ionicons name="radio" size={20} color="#7c3aed" />
                                                    <Text style={styles.infoLabel}>Doğruluk:</Text>
                                                    <Text style={styles.infoValue}>
                                                        ±{Math.round(selectedMember.location.accuracy)}m
                                                    </Text>
                                                </View>
                                            )}
                                            <View style={styles.infoRow}>
                                                <Ionicons name="time" size={20} color="#64748b" />
                                                <Text style={styles.infoLabel}>Son Güncelleme:</Text>
                                                <Text style={styles.infoValue}>
                                                    {new Date(selectedMember.location.timestamp).toLocaleString('tr-TR')}
                                                </Text>
                                            </View>
                                        </>
                                    )}

                                    <View style={styles.infoRow}>
                                        <Ionicons name="calendar" size={20} color="#64748b" />
                                        <Text style={styles.infoLabel}>Katılma:</Text>
                                        <Text style={styles.infoValue}>
                                            {new Date(selectedMember.joinedAt).toLocaleDateString('tr-TR')}
                                        </Text>
                                    </View>
                                </View>

                                {selectedMember.location && (
                                    <Pressable
                                        style={styles.focusButton}
                                        onPress={() => {
                                            focusOnMember(selectedMember);
                                            setShowMemberModal(false);
                                        }}
                                    >
                                        <Ionicons name="navigate" size={20} color="#fff" />
                                        <Text style={styles.focusButtonText}>Haritada Göster</Text>
                                    </Pressable>
                                )}
                            </>
                        )}
                    </View>
                </Pressable>
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

// --- styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { paddingTop: StatusBar.currentHeight ?? 18, paddingHorizontal: 14, paddingBottom: 12, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
    headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backBtn: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.9)' },
    title: { fontSize: 18, fontWeight: '800', color: '#042f35' },
    subtitle: { fontSize: 12, color: 'rgba(4,47,53,0.85)' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

    persistBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.9)', marginRight: 8 },
    persistBtnActive: { backgroundColor: '#042f35' },

    actionButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
    actionButtonActive: { backgroundColor: '#042f35' },

    mapContainer: {
        flex: 1,
        position: 'relative',
        borderRadius: 20,
        overflow: 'hidden',
        margin: 14,
        marginTop: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 16,
    },
    map: { flex: 1 },
    centerMarker: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },

    myMarkerWrap: { alignItems: 'center', justifyContent: 'center' },
    myMarkerDot: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#0EA5E9', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },

    memberMarker: { padding: 8, borderRadius: 12, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#fff' },
    adminMarker: { backgroundColor: '#f59e0b' },
    highlightMarker: { borderColor: '#f59e0b' },

    statusBar: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    statusItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statusText: { fontSize: 12, color: '#666', fontWeight: '600' },
    statusTextActive: { color: '#10b981' },

    statsPanel: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12, gap: 10, backgroundColor: '#0f172a' },
    statCard: { flex: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
    statValue: { fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 4 },
    statLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2, textAlign: 'center' },

    membersContainer: { backgroundColor: '#1e293b', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: 180, borderWidth: 1, borderColor: '#334155' },
    membersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    membersTitle: { fontSize: 16, fontWeight: '900', color: '#fff' },
    statsRow: { flexDirection: 'row', gap: 8 },
    statBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#334155', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statText: { fontSize: 10, fontWeight: '700', color: '#94a3b8' },
    membersList: { flexDirection: 'row' },

    memberCard: { alignItems: 'center', marginRight: 16, minWidth: 80 },
    memberAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center', marginBottom: 8, position: 'relative' },
    memberAvatarOnline: { backgroundColor: '#065f46' },
    memberAvatarText: { fontSize: 14, fontWeight: 'bold', color: '#0EA5E9' },
    onlineIndicator: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#fff' },
    memberName: { fontSize: 12, fontWeight: '700', color: '#fff', marginBottom: 2, textAlign: 'center' },
    memberRole: { fontSize: 10, color: '#94a3b8', marginBottom: 2 },
    memberLocation: { fontSize: 10, color: '#64748b' },
    memberOffline: { fontSize: 9, color: '#ef4444', marginTop: 2 },

    // Modal styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    modalAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center', position: 'relative' },
    modalAvatarOnline: { backgroundColor: '#065f46' },
    modalAvatarText: { fontSize: 24, fontWeight: 'bold', color: '#0EA5E9' },
    onlineIndicatorLarge: { position: 'absolute', bottom: 4, right: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#10b981', borderWidth: 3, borderColor: '#fff' },
    modalClose: { padding: 8 },
    modalName: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 4 },
    modalEmail: { fontSize: 14, color: '#64748b', marginBottom: 24 },
    modalInfo: { gap: 16 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    infoLabel: { fontSize: 14, fontWeight: '700', color: '#94a3b8', width: 120 },
    infoValue: { fontSize: 14, color: '#fff', flex: 1 },
    infoValueOnline: { color: '#10b981', fontWeight: 'bold' },
    focusButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0EA5E9', paddingVertical: 16, borderRadius: 12, marginTop: 24 },
    focusButtonText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
    mapLoaderOverlay: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.55)', zIndex: 40 },
});
