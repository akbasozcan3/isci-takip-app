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
import MemberDetailModal from '../components/MemberDetailModal';
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
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { io, Socket } from 'socket.io-client';
import { Toast, useToast } from '../components/Toast';
import { getApiBase } from '../utils/api';

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
    console.log('[GroupMap] Component rendering - VERSION CONTROL: ' + new Date().toISOString());
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
    const [region, setRegion] = React.useState<Region | null>(null);

    const [isSharing, setIsSharing] = React.useState(false);
    const [sharingLoading, setSharingLoading] = React.useState(false);
    const [persistShare, setPersistShare] = React.useState(false);

    const [userId, setUserId] = React.useState('');

    // Animasyonlar
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const slideAnim = React.useRef(new Animated.Value(50)).current;
    const pulseAnim = React.useRef(new Animated.Value(1)).current;
    const statsScaleAnim = React.useRef(new Animated.Value(0.95)).current;

    const socketRef = React.useRef<Socket | null>(null);
    const subscriptionRef = React.useRef<Location.LocationSubscription | null>(null);
    const resendIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
    const lastPayloadRef = React.useRef<any | null>(null);
    const mapRef = React.useRef<MapView | null>(null);

    // Türkiye merkez koordinatları - Profesyonel GPS takip için
    const TURKEY_CENTER = { latitude: 39.0, longitude: 35.2433 };
    const TURKEY_REGION = {
        latitude: TURKEY_CENTER.latitude,
        longitude: TURKEY_CENTER.longitude,
        latitudeDelta: 13.0,
        longitudeDelta: 20.0
    };

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

    // Üyeye odaklan
    const focusOnMember = React.useCallback((member: MemberWithLocation) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (member.location) {
            const newRegion: Region = {
                latitude: member.location.lat,
                longitude: member.location.lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005
            };
            mapRef.current?.animateToRegion(newRegion, 1000);
        }
        setSelectedMember(member);
        setShowMemberModal(true);
    }, []);

    const handleOpenChat = React.useCallback(() => {
        if (!selectedMember || !groupId) return;
        router.push({
            pathname: '/groups/[id]/chat',
            params: { id: groupId, name: groupInfo?.name }
        } as any);
    }, [selectedMember, groupId, groupInfo]);

    // Online üye sayısı
    const onlineCount = membersWithLocations.filter(m => m.isOnline).length;
    const adminCount = membersWithLocations.filter(m => m.role === 'admin').length;

    // --- permission request and initial region ---
    React.useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (!mounted) return;

                let initialRegion = TURKEY_REGION;

                if (status === 'granted') {
                    const last = await Location.getLastKnownPositionAsync();
                    if (last) {
                        setMyLocation(last);
                        initialRegion = {
                            latitude: last.coords.latitude,
                            longitude: last.coords.longitude,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01
                        };
                    } else {
                        // try current position if last known is null
                        const curr = await Location.getCurrentPositionAsync({});
                        if (curr) {
                            setMyLocation(curr);
                            initialRegion = {
                                latitude: curr.coords.latitude,
                                longitude: curr.coords.longitude,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01
                            };
                        }
                    }
                }
                setRegion(initialRegion);
            } catch (e) {
                console.warn('perm/location error', e);
                setRegion(TURKEY_REGION);
            }
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

    // Tüm konumları göster (benim + çalışanlar)
    const fitAllLocations = React.useCallback(() => {
        if (!mapRef.current) return;

        const allCoords: Array<{ latitude: number; longitude: number }> = [];

        // Benim konumum
        if (myLocation) {
            allCoords.push({
                latitude: myLocation.coords.latitude,
                longitude: myLocation.coords.longitude
            });
        }

        // Tüm çalışanlar
        membersWithLocations.forEach(m => {
            if (m.location?.lat && m.location?.lng) {
                allCoords.push({ latitude: m.location.lat, longitude: m.location.lng });
            }
        });

        // Grup merkezi
        if (groupInfo?.lat && groupInfo?.lng) {
            allCoords.push({ latitude: groupInfo.lat, longitude: groupInfo.lng });
        }

        if (allCoords.length > 0) {
            mapRef.current.fitToCoordinates(allCoords, {
                edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
                animated: true,
            });
        }
    }, [myLocation, membersWithLocations, groupInfo]);

    React.useEffect(() => {
        // Wait for map to be ready and data to be loaded
        if (!mapLoading && membersWithLocations.length > 0) {
            const timer = setTimeout(() => {
                fitAllLocations();
            }, 1000); // slight delay to ensure map layout
            return () => clearTimeout(timer);
        }
    }, [mapLoading, membersWithLocations, fitAllLocations]);


    // --- Render ---

    if (mapLoading || !region) {
        return (
            <View style={styles.loadingContainer}>
                <StatusBar barStyle="light-content" />
                <LinearGradient
                    colors={['#0f172a', '#1e293b']}
                    style={StyleSheet.absoluteFill}
                />
                <ActivityIndicator size="large" color="#8b5cf6" />
                <Text style={styles.loadingText}>Harita Hazırlanıyor...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />

            {/* Premium Header */}
            <LinearGradient
                colors={['#0f172a', 'rgba(15, 23, 42, 0.95)', 'rgba(15, 23, 42, 0.8)']}
                style={styles.headerOverlay}
            >
                <View style={styles.headerContent}>
                    <Pressable
                        onPress={() => router.back()}
                        style={({ pressed }) => [styles.backButton, pressed && { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </Pressable>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={styles.headerTitle}>{groupInfo?.name || 'Grup Haritası'}</Text>
                        <Text style={styles.headerSubtitle}>
                            {onlineCount} aktif • {membersWithLocations.length} üye
                        </Text>
                    </View>
                    <Pressable
                        onPress={() => {
                            onRefresh();
                            fitAllLocations();
                        }}
                        style={({ pressed }) => [styles.refreshButton, pressed && { opacity: 0.7 }]}
                    >
                        <Ionicons name="refresh" size={20} color="#8b5cf6" />
                    </Pressable>
                </View>
            </LinearGradient>

            <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={StyleSheet.absoluteFill}
                    initialRegion={region}
                    showsUserLocation={true}
                    showsMyLocationButton={false} // Custom button later if needed
                    showsCompass={false}
                    onMapReady={() => setMapLoading(false)}
                    customMapStyle={[
                        {
                            "elementType": "geometry",
                            "stylers": [
                                {
                                    "color": "#242f3e"
                                }
                            ]
                        },
                        {
                            "elementType": "labels.text.fill",
                            "stylers": [
                                {
                                    "color": "#746855"
                                }
                            ]
                        },
                        {
                            "elementType": "labels.text.stroke",
                            "stylers": [
                                {
                                    "color": "#242f3e"
                                }
                            ]
                        },
                        {
                            "featureType": "administrative.locality",
                            "elementType": "labels.text.fill",
                            "stylers": [
                                {
                                    "color": "#d59563"
                                }
                            ]
                        },
                        {
                            "featureType": "poi",
                            "elementType": "labels.text.fill",
                            "stylers": [
                                {
                                    "color": "#d59563"
                                }
                            ]
                        },
                        {
                            "featureType": "poi.park",
                            "elementType": "geometry",
                            "stylers": [
                                {
                                    "color": "#263c3f"
                                }
                            ]
                        },
                        {
                            "featureType": "poi.park",
                            "elementType": "labels.text.fill",
                            "stylers": [
                                {
                                    "color": "#6b9a76"
                                }
                            ]
                        },
                        {
                            "featureType": "road",
                            "elementType": "geometry",
                            "stylers": [
                                {
                                    "color": "#38414e"
                                }
                            ]
                        },
                        {
                            "featureType": "road",
                            "elementType": "geometry.stroke",
                            "stylers": [
                                {
                                    "color": "#212a37"
                                }
                            ]
                        },
                        {
                            "featureType": "road",
                            "elementType": "labels.text.fill",
                            "stylers": [
                                {
                                    "color": "#9ca5b3"
                                }
                            ]
                        },
                        {
                            "featureType": "road.highway",
                            "elementType": "geometry",
                            "stylers": [
                                {
                                    "color": "#746855"
                                }
                            ]
                        },
                        {
                            "featureType": "road.highway",
                            "elementType": "geometry.stroke",
                            "stylers": [
                                {
                                    "color": "#1f2835"
                                }
                            ]
                        },
                        {
                            "featureType": "road.highway",
                            "elementType": "labels.text.fill",
                            "stylers": [
                                {
                                    "color": "#f3d19c"
                                }
                            ]
                        },
                        {
                            "featureType": "transit",
                            "elementType": "geometry",
                            "stylers": [
                                {
                                    "color": "#2f3948"
                                }
                            ]
                        },
                        {
                            "featureType": "transit.station",
                            "elementType": "labels.text.fill",
                            "stylers": [
                                {
                                    "color": "#d59563"
                                }
                            ]
                        },
                        {
                            "featureType": "water",
                            "elementType": "geometry",
                            "stylers": [
                                {
                                    "color": "#17263c"
                                }
                            ]
                        },
                        {
                            "featureType": "water",
                            "elementType": "labels.text.fill",
                            "stylers": [
                                {
                                    "color": "#515c6d"
                                }
                            ]
                        },
                        {
                            "featureType": "water",
                            "elementType": "labels.text.stroke",
                            "stylers": [
                                {
                                    "color": "#17263c"
                                }
                            ]
                        }
                    ]}
                >
                    {membersWithLocations.map(m => {
                        if (!m.location?.lat || !m.location?.lng) return null;
                        return (
                            <Marker
                                key={m.userId}
                                coordinate={{
                                    latitude: m.location.lat,
                                    longitude: m.location.lng
                                }}
                                title={m.displayName}
                                description={m.isOnline ? 'Çevrimiçi' : `Son görülme: ${new Date(m.lastSeen || Date.now()).toLocaleTimeString()}`}
                                onPress={() => focusOnMember(m)}
                            >
                                <View style={[styles.customMarker, m.isOnline ? styles.markerOnline : styles.markerOffline]}>
                                    <Text style={styles.markerText}>
                                        {m.displayName ? m.displayName.charAt(0).toUpperCase() : '?'}
                                    </Text>
                                </View>
                                <View style={styles.markerArrow} />
                            </Marker>
                        );
                    })}
                </MapView>

                {/* Bottom Sheet / Controls */}
                <View style={styles.bottomControls}>
                    <LinearGradient
                        colors={['transparent', 'rgba(15, 23, 42, 0.8)', '#0f172a']}
                        style={StyleSheet.absoluteFill}
                    />

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.memberList}
                    >
                        {membersWithLocations.map(member => (
                            <Pressable
                                key={member.userId}
                                onPress={() => focusOnMember(member)}
                                style={[
                                    styles.memberCard,
                                    selectedMember?.userId === member.userId && styles.selectedMember
                                ]}
                            >
                                <View style={[styles.statusDot, { backgroundColor: member.isOnline ? '#22c55e' : '#64748b' }]} />
                                <View style={styles.avatarPlaceholder}>
                                    <Text style={styles.avatarInitial}>{member.displayName?.charAt(0).toUpperCase() || '?'}</Text>
                                </View>
                                <Text style={styles.memberName} numberOfLines={1}>{member.displayName}</Text>
                                <Text style={styles.memberStatus}>
                                    {member.isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>

                    <Pressable
                        onPress={toggleLocationSharing}
                        style={[styles.shareButton, isSharing && styles.sharingActive]}
                    >
                        <LinearGradient
                            colors={isSharing ? ['#ef4444', '#dc2626'] : ['#22c55e', '#16a34a']}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        />
                        <Ionicons name={isSharing ? "stop-circle" : "navigate"} size={24} color="#fff" />
                        <Text style={styles.shareButtonText}>
                            {isSharing ? 'Konum Paylaşımını Durdur' : 'Konum Paylaşımını Başlat'}
                        </Text>
                        {sharingLoading && <ActivityIndicator color="#fff" style={{ marginLeft: 10 }} />}
                    </Pressable>
                </View>
            </View>

            {/* Member Detail Modal */}
            <MemberDetailModal
                visible={showMemberModal}
                member={selectedMember}
                onClose={() => setShowMemberModal(false)}
                onShowOnMap={() => {
                    if (selectedMember) focusOnMember(selectedMember);
                }}
                onOpenChat={handleOpenChat}
            />
        </SafeAreaView>
    );
}

// --- styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },

    // Header
    headerOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
        paddingTop: (StatusBar.currentHeight || 20) + 10,
        paddingBottom: 20,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8
    },
    headerContent: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
    },
    headerTitle: {
        fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center'
    },
    headerSubtitle: {
        fontSize: 12, color: '#94a3b8', marginTop: 2
    },
    backButton: {
        width: 40, height: 40, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
    },
    refreshButton: {
        width: 40, height: 40, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)'
    },

    // Map Markers
    customMarker: {
        width: 24, height: 24, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: '#fff',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5
    },
    markerOnline: { backgroundColor: '#22c55e' },
    markerOffline: { backgroundColor: '#94a3b8' },
    markerInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
    markerText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    markerArrow: {
        width: 0, height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#fff',
        marginTop: 2,
        alignSelf: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2
    },

    // Bottom Controls
    bottomControls: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: 24, paddingBottom: 34,
        zIndex: 50,
    },
    memberList: {
        paddingVertical: 10, gap: 12, paddingHorizontal: 4
    },
    memberCard: {
        alignItems: 'center', justifyContent: 'center',
        marginRight: 16, width: 70
    },
    selectedMember: {
        opacity: 1, transform: [{ scale: 1.1 }]
    },
    avatarPlaceholder: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: '#1e293b',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: '#334155',
        marginBottom: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5
    },
    avatarInitial: {
        fontSize: 20, fontWeight: 'bold', color: '#94a3b8'
    },
    statusDot: {
        position: 'absolute', top: 2, right: 8, zIndex: 10,
        width: 14, height: 14, borderRadius: 7,
        borderWidth: 2, borderColor: '#0f172a'
    },
    memberName: {
        fontSize: 12, fontWeight: '600', color: '#e2e8f0', textAlign: 'center'
    },
    memberStatus: {
        fontSize: 10, color: '#64748b', textAlign: 'center', marginTop: 2
    },

    // Share Button
    shareButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 16, paddingHorizontal: 24,
        borderRadius: 16, marginTop: 20,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8
    },
    sharingActive: {
        // dynamic style handled in props usually, but here for override if needed
    },
    shareButtonText: {
        color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 10
    },

    // Loading
    loadingContainer: {
        flex: 1, alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#0f172a'
    },
    loadingText: {
        marginTop: 16, fontSize: 16, color: '#94a3b8', fontWeight: '500'
    }
});
