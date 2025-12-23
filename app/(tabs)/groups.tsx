// GroupsScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import {
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  Easing,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import Reanimated, { FadeInDown, FadeInUp, Layout, SlideInUp } from 'react-native-reanimated';
import type { Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../../components/EmptyState';
import LeafletMap from '../../components/leaflet-map';
import { NetworkStatusIcon } from '../../components/NetworkStatusIcon';
import ProfileBadge from '../../components/ProfileBadge';
import { UnifiedHeader } from '../../components/UnifiedHeader';
import { useProfile } from '../../contexts/ProfileContext';
import { SkeletonList } from '../../components/SkeletonLoader';
import { authFetch } from '../../utils/auth';

// API_BASE removed - using authFetch which handles base URL

/* ---------- Types ---------- */
interface Group {
  id: string;
  code: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  createdBy?: string;
  createdAt: number;
  visibility?: string;
  memberCount?: number;
  userRole?: 'admin' | 'member';
  isAdmin?: boolean;
}

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmModal({
  visible,
  title,
  description,
  confirmText = 'Evet',
  cancelText = 'İptal',
  destructive = false,
  onCancel,
  onConfirm
}: ConfirmModalProps) {
  const scale = React.useRef(new Animated.Value(0.8)).current;
  React.useEffect(() => {
    if (visible) {
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60 }).start();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Animated.timing(scale, { toValue: 0.8, duration: 120, useNativeDriver: true }).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.confirmOverlay} onPress={onCancel}>
        <Animated.View style={[styles.confirmCard, { transform: [{ scale }] }]}>
          <View style={styles.confirmHeader}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name={destructive ? 'warning' : 'help-circle'} size={28} color={destructive ? '#f97316' : '#0EA5E9'} />
            </View>
            <Text style={styles.confirmTitle}>{title}</Text>
            {description ? <Text style={styles.confirmDesc}>{description}</Text> : null}
          </View>

          <View style={styles.confirmActions}>
            <Pressable onPress={onCancel} style={({ pressed }) => [styles.confirmCancel, pressed && { opacity: 0.9 }]}>
              <Text style={styles.confirmCancelText}>{cancelText}</Text>
            </Pressable>

            <Pressable onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onConfirm(); }} style={({ pressed }) => [styles.confirmButton, destructive ? styles.confirmButtonDanger : styles.confirmButtonPrimary, pressed && { opacity: 0.95 }]}>
              <Text style={[styles.confirmButtonText, destructive && { color: '#fff' }]}>{confirmText}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

/* ---------- CreateGroupModal ---------- */
interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onGroupCreated: (group: Group) => void;
  onMessage: (type: 'success' | 'error' | 'info', text: string) => void;
}

function CreateGroupModal({ visible, onClose, onGroupCreated, onMessage }: CreateGroupModalProps) {
  const [groupName, setGroupName] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [selectedLocation, setSelectedLocation] = React.useState<{ lat: number; lng: number } | null>(null);
  // Start centered on Turkey for instant map render; refine after geolocation
  const [mapRegion, setMapRegion] = React.useState<Region | null>({
    latitude: 38.9637,
    longitude: 35.2433,
    latitudeDelta: 3,
    longitudeDelta: 3,
  });
  const [loading, setLoading] = React.useState(false);
  const [userId, setUserId] = React.useState('');
  const [hasLocationPermission, setHasLocationPermission] = React.useState<boolean>(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<{ name?: string; address?: string; location?: string }>(() => ({}));

  React.useEffect(() => {
    if (!visible) return;

    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!mounted) return;
        setHasLocationPermission(status === 'granted');
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
          if (!mounted) return;
          setMapRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        } else {
          // Keep Turkey defaults
        }
      } catch (error) {
        console.warn('[CreateGroupModal] location init error', error);
        // Keep Turkey defaults on error
      }
    })();

    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('workerId');
        if (stored) setUserId(stored);
        else {
          const newId = `user-${Platform.OS}-${Math.floor(Math.random() * 1e6)}`;
          await SecureStore.setItemAsync('workerId', newId);
          setUserId(newId);
        }
      } catch (err) {
        console.error('[CreateGroupModal] loadUserId error', err);
      }
    })();

    return () => { mounted = false; };
  }, [visible]);

  const handleMapSelect = async (lat: number, lng: number) => {
    console.log('[CreateGroupModal] Map select', lat, lng);
    setSelectedLocation({ lat, lng });
    setMapRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });

    if (hasLocationPermission) {
      try {
        const addresses = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (addresses && addresses.length > 0) {
          const addr = addresses[0] as any;
          const fullAddress = [
            addr.street,
            addr.streetNumber,
            addr.district,
            addr.city,
            addr.country
          ].filter(Boolean).join(', ');
          setAddress(fullAddress);
        }
      } catch (error) {
        console.warn('[CreateGroupModal] reverseGeocode error', error);
      }
    }
  };

  const geocodeAddress = async () => {
    setLocalError(null);
    if (!address.trim()) {
      setLocalError('Lütfen bir adres giriniz veya haritadan seçiniz.');
      return;
    }
    try {
      const results = await Location.geocodeAsync(address);
      if (results.length > 0) {
        const { latitude, longitude } = results[0];
        setSelectedLocation({ lat: latitude, lng: longitude });
        setMapRegion({
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } else {
        setLocalError('Adres bulunamadı. Lütfen daha açık bir adres girin.');
      }
    } catch (error) {
      console.warn('[CreateGroupModal] geocode error', error);
      setLocalError('Adresden konum alınamadı.');
    }
  };

  const createGroup = async () => {
    setLocalError(null);
    setFieldErrors({});
    const name = groupName.trim();
    const addr = address.trim();
    const errors: typeof fieldErrors = {};
    if (!name) errors.name = 'Grup adı gerekli.';
    if (!addr) errors.address = 'Adres gerekli.';
    if (!selectedLocation) errors.location = 'Lütfen haritadan bir konum seçin.';
    if (!userId) {
      setLocalError('Kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
      return;
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setLoading(true);
    try {
      const response = await authFetch(`/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName,
          address: address || 'Konum seçildi',
          lat: selectedLocation.lat,
          lng: selectedLocation.lng,
          createdBy: userId,
          visibility: 'private'
        }),
      });

      if (response.ok) {
        let data = null;
        try { data = await response.json(); } catch (err) { data = null; }
        const group = (data && (data.data || data)) || {};
        onGroupCreated(group);
        onClose();
        setGroupName('');
        setAddress('');
        setSelectedLocation(null);
        setLocalError(null);
        onMessage('success', `Grup başarıyla oluşturuldu. Grup kodunuz: ${group.code || ''}`);
      } else {
        const errBody = await response.json().catch(() => ({} as any));
        // Parse common error shapes: { error: 'msg' } or { errors: { field: ['msg'] } }
        let serverMsg = (errBody && (errBody.error || errBody.message)) || '';
        if (!serverMsg && errBody && errBody.errors && typeof errBody.errors === 'object') {
          // Map field errors
          const fe: any = {};
          Object.entries(errBody.errors).forEach(([k, v]) => {
            fe[k] = Array.isArray(v) ? String(v[0]) : String(v || 'Hatalı alan');
          });
          setFieldErrors(prev => ({ ...prev, ...fe }));
          serverMsg = Object.values(fe)[0] || 'Doğrulama hatası.';
        }
        if (!serverMsg) serverMsg = 'Grup oluşturulamadı.';
        setLocalError(String(serverMsg));
      }
    } catch (error) {
      console.error('[CreateGroupModal] createGroup error', error);
      setLocalError('Sunucuya bağlanılamadı. Lütfen internetinizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderContent}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.modalHeaderIcon}><Ionicons name="add-circle" size={24} color="#0EA5E9" /></View>
              <Text style={styles.modalTitle}>Yeni Grup Oluştur</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}><Ionicons name="close-circle" size={28} color="#fff" /></Pressable>
          </View>
        </View>

        <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Grup Adı <Text style={{ color: '#dc2626' }}>*</Text></Text>
            <TextInput style={styles.input} placeholder="Grup Adını Girin" placeholderTextColor={'#64748b'} value={groupName} onChangeText={setGroupName} maxLength={40} autoFocus />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Adres <Text style={{ color: '#dc2626' }}>*</Text></Text>
            <View style={styles.addressRow}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Adres Girin veya Haritadan Seçin" value={address} placeholderTextColor={'#64748b'} onChangeText={setAddress} maxLength={120} />
              <Pressable onPress={geocodeAddress} style={styles.geocodeButton}><Ionicons name="search" size={20} color="#fff" /></Pressable>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Konum Seçimi <Text style={{ color: '#dc2626' }}>*</Text></Text>
            <Text style={styles.helpText}>Haritaya dokunarak grup konumunu seçin</Text>
            <View style={styles.mapContainer}>
              {mapRegion && <LeafletMap centerLat={mapRegion.latitude} centerLng={mapRegion.longitude} onSelect={handleMapSelect} height={220} />}
            </View>
            {selectedLocation && <Text style={{ color: '#15803d', marginTop: 6, fontSize: 13, textAlign: 'center' }}>Seçilen konum: {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}</Text>}
          </View>

          <Pressable onPress={createGroup} style={({ pressed }) => [styles.createButton, loading && styles.createButtonDisabled, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : (<><Ionicons name="checkmark-circle" size={20} color="#fff" /><Text style={styles.createButtonText}>Grup Oluştur</Text></>)}
          </Pressable>

          {localError ? (<View style={styles.errorCard}><Ionicons name="alert-circle" size={20} color="#dc2626" /><Text style={styles.errorText}>{localError}</Text></View>) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* ---------- JoinGroupModal ---------- */
interface JoinGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onJoined: (groupCode: string) => void;
  onMessage: (type: 'success' | 'error' | 'info', text: string) => void;
}

function JoinGroupModal({ visible, onClose, onJoined, onMessage }: JoinGroupModalProps) {
  const [groupCode, setGroupCode] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [userId, setUserId] = React.useState('');
  const [groupInfo, setGroupInfo] = React.useState<any>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<{ code?: string; name?: string }>(() => ({}));

  React.useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('workerId');
        if (stored) {
          setUserId(stored);
          setDisplayName(stored);
        }
      } catch (error) {
        console.error('[JoinGroupModal] loadUserId error', error);
      }
    })();
  }, []);

  const checkGroupInfo = async () => {
    setLocalError(null);
    setFieldErrors({});
    if (!groupCode.trim()) {
      setFieldErrors({ code: 'Lütfen grup kodunu girin.' });
      return;
    }
    try {
      const response = await authFetch(`/groups/${groupCode}/info`);
      if (response.ok) {
        const data = await response.json();
        const info = data.data || data;
        setGroupInfo(info);
      } else {
        setGroupInfo(null);
        onMessage('error', 'Grup bulunamadı');
      }
    } catch (error) {
      console.error('[JoinGroupModal] checkGroupInfo error', error);
      setGroupInfo(null);
      onMessage('error', 'Grup bilgisi alınamadı');
    }
  };

  const joinGroup = async () => {
    setLocalError(null);
    setFieldErrors({});
    const code = groupCode.trim();
    const name = displayName.trim();
    const errors: any = {};
    if (!code) errors.code = 'Grup kodu gerekli.';
    if (!name) errors.name = 'İsminiz gerekli.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setLoading(true);
    try {
      const response = await authFetch(`/groups/${groupCode}/join-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, displayName }),
      });

      if (response.ok) {
        await response.json();
        onJoined(groupCode);
        onClose();
        setGroupCode('');
        setDisplayName('');
        setGroupInfo(null);
        setLocalError(null);
        onMessage('success', 'Katılma isteğiniz başarıyla gönderildi. Onay bekleniyor.');
      } else {
        const errBody = await response.json().catch(() => ({} as any));
        let serverMsg = (errBody && (errBody.error || errBody.message)) || '';
        if (!serverMsg && errBody && errBody.errors) {
          const fe: any = {};
          Object.entries(errBody.errors).forEach(([k, v]) => { fe[k] = Array.isArray(v) ? String(v[0]) : String(v || 'Hata'); });
          setFieldErrors(prev => ({ ...prev, ...fe }));
          serverMsg = Object.values(fe)[0] || serverMsg;
        }
        const lower = String(serverMsg).toLowerCase();
        if (!serverMsg) serverMsg = 'Gruba katılamadı';
        if (lower.includes('already a member')) serverMsg = 'Zaten bu grubun üyesisiniz.';
        else if (lower.includes('request already pending')) serverMsg = 'Zaten bir katılma isteğiniz var. Lütfen onay bekleyin.';
        else if (lower.includes('group not found')) serverMsg = 'Grup bulunamadı. Lütfen kodu kontrol edin.';
        setLocalError(serverMsg);
      }
    } catch (error) {
      console.error('[JoinGroupModal] joinGroup error', error);
      setLocalError('Bağlantı hatası. Lütfen internetinizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderContent}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.modalHeaderIcon}><Ionicons name="person-add" size={24} color="#7c3aed" /></View>
              <Text style={styles.modalTitle}>Gruba Katıl</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}><Ionicons name="close-circle" size={28} color="#fff" /></Pressable>
          </View>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Grup Kodu *</Text>
            <View style={styles.codeRow}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="ABC123" placeholderTextColor={'#64748b'} value={groupCode} onChangeText={setGroupCode} autoCapitalize="characters" maxLength={6} />
              <Pressable onPress={checkGroupInfo} style={styles.checkButton}><Ionicons name="search" size={20} color="#fff" /></Pressable>
            </View>
            {fieldErrors.code ? <Text style={styles.fieldErrorText}>{fieldErrors.code}</Text> : null}
          </View>

          {groupInfo && (
            <View style={styles.groupInfoCard}>
              <View style={styles.groupInfoHeader}>
                <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                <Text style={styles.groupInfoTitle}>{groupInfo.name}</Text>
              </View>
              <Text style={styles.groupInfoAddress}>{groupInfo.address}</Text>
              <View style={styles.groupInfoFooter}>
                <Text style={styles.groupInfoMembers}>{groupInfo.memberCount} üye</Text>
                <Text style={styles.groupInfoStatus}>✅ Grup bulundu</Text>
              </View>
            </View>
          )}

          <View style={styles.formGroup}>
            <Text style={styles.label}>İsminiz *</Text>
            <TextInput style={styles.input} placeholder="Görünecek isminizi girin" value={displayName} onChangeText={setDisplayName} />
            {fieldErrors.name ? <Text style={styles.fieldErrorText}>{fieldErrors.name}</Text> : null}
          </View>

          <Pressable onPress={joinGroup} style={({ pressed }) => [styles.joinButton, loading && styles.joinButtonDisabled, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]} disabled={loading || !groupCode.trim() || !displayName.trim()}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : (<><Ionicons name="send" size={18} color="#fff" /><Text style={styles.joinButtonText}>Katılma İsteği Gönder</Text></>)}
          </Pressable>

          {loading && (
            <View style={styles.modalLoadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color="#7c3aed" />
            </View>
          )}

          {localError ? (<View style={styles.errorCard}><Ionicons name="alert-circle" size={20} color="#dc2626" /><Text style={styles.errorText}>{localError}</Text></View>) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* ---------- Main Screen ---------- */
export default function GroupsScreen() {
  const [groups, setGroups] = React.useState<any[]>([]);
  const [userId, setUserId] = React.useState<string>('');
  const [profileName, setProfileName] = React.useState<string>(''); // Profil ismi state'i
  const { avatarUrl } = useProfile();
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [showJoinModal, setShowJoinModal] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: 'error' | 'success' | 'info', text: string } | null>(null);
  const messageOpacity = React.useRef(new Animated.Value(0)).current;
  const messageTranslateY = React.useRef(new Animated.Value(-20)).current;
  const [confirmState, setConfirmState] = React.useState<{
    visible: boolean;
    title: string;
    description?: string;
    destructive?: boolean;
    onConfirm?: () => void;
  }>({ visible: false, title: '' });

  // İsim baş harflerini hesapla (diğer sayfalardaki gibi)
  const initials = React.useMemo(() => {
    if (!profileName) return '';
    return profileName
      .split(' ')
      .map((s) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [profileName]);

  // Refs
  const isMounted = React.useRef(true);
  const activeRequestId = React.useRef(0);
  const currentController = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    return () => {
      isMounted.current = false;
      try { currentController.current?.abort(); } catch { }
    };
  }, []);

  const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    Animated.parallel([
      Animated.timing(messageOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(messageTranslateY, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(messageOpacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          Animated.timing(messageTranslateY, { toValue: -16, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        ]).start(() => setMessage(null));
      }, 2500);
    });
  };

  React.useEffect(() => {
    const loadUserId = async () => {
      try {
        const stored = await SecureStore.getItemAsync('workerId');

        // ÖNCE SecureStore'dan displayName oku (index.tsx'deki gibi)
        const storedDisplayName = await SecureStore.getItemAsync('displayName');
        if (storedDisplayName) {
          console.log('[GroupsScreen] Loaded from SecureStore:', storedDisplayName);
          setProfileName(storedDisplayName);
        }

        if (stored) {
          setUserId(stored);
          try {
            const r = await authFetch('/users/me');
            console.log('[GroupsScreen] /users/me response status:', r.status);
            if (r.ok) {
              const { user } = await r.json();
              console.log('[GroupsScreen] user data:', user);
              if (user) {
                // displayName öncelikli, yoksa name, yoksa email kullan
                const profileDisplayName = user.displayName || user.name || user.email || '';
                console.log('[GroupsScreen] profileDisplayName:', profileDisplayName);
                if (profileDisplayName) {
                  setProfileName(profileDisplayName);
                  console.log('[GroupsScreen] setProfileName called with:', profileDisplayName);
                  // SecureStore'a da kaydet (index.tsx'deki gibi)
                  await SecureStore.setItemAsync('displayName', profileDisplayName);
                  console.log('[GroupsScreen] SecureStore updated');
                }
              }
            }
          } catch (err) {
            console.error('[GroupsScreen] authFetch error:', err);
          }
        } else {
          // No auth in app: create and persist a stable anonymous id once
          const anonId = `anon-${Platform.OS}-${Math.floor(Math.random() * 1e9)}`;
          await SecureStore.setItemAsync('workerId', anonId);
          setUserId(anonId);
        }
      } catch (error) {
        console.error('[GroupsScreen] loadUserId error', error);
        // As a last resort, generate an in-memory id (not persisted if SecureStore fails)
        const fallbackId = `anon-${Platform.OS}-${Date.now()}`;
        setUserId(fallbackId);
      }
    };
    loadUserId(); // Fonksiyonu çağır
  }, []);

  // Global app data clear handler
  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('app:dataCleared', () => {
      try {
        setGroups([]);
        setUserId('');
        setProfileName('');
        setShowCreateModal(false);
        setShowJoinModal(false);
        setRefreshing(false);
      } catch { }
    });
    return () => { sub.remove?.(); };
  }, []);

  React.useEffect(() => {
    if (userId) {
      console.log('[GroupsScreen] userId updated, loading groups:', userId);
      loadGroups();
    } else {
      console.log('[GroupsScreen] userId is empty');
      setGroups([]); // Clear groups when no userId
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Ekran odaklandığında (tab'a geri dönüldüğünde) grupları yenile
  useFocusEffect(
    React.useCallback(() => {
      if (userId) {
        console.log('[GroupsScreen] Screen focused, reloading groups');
        loadGroups();
      }
      // no cleanup necessary
      return undefined;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId])
  );

  const loadGroups = React.useCallback(async () => {
    if (!userId) {
      console.log('[GroupsScreen] userId is empty, skipping group load');
      setGroups([]);
      setLoading(false);
      return;
    }

    const requestId = ++activeRequestId.current;
    console.log('[GroupsScreen] Loading groups for userId:', userId, 'requestId:', requestId);

    // Abort any previous request
    try { currentController.current?.abort(); } catch { }
    const controller = new AbortController();
    currentController.current = controller;

    setLoading(true);
    try {
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduced to 5s
      const response = await authFetch(`/groups/user/${userId}`, { signal: controller.signal });
      clearTimeout(timeoutId);

      // If a newer request started after this one, ignore this response
      if (requestId !== activeRequestId.current) {
        console.log('[GroupsScreen] Ignoring stale response for requestId:', requestId);
        return;
      }

      console.log('[GroupsScreen] Groups response status:', response.status);

      // Handle 404 - endpoint doesn't exist yet
      if (response.status === 404) {
        console.log('[GroupsScreen] Groups endpoint not yet implemented, showing empty state');
        if (isMounted.current && requestId === activeRequestId.current) {
          setGroups([]);
          setLoading(false);
        }
        return;
      }

      if (response.ok) {
        const data = await response.json().catch(() => null);
        console.log('[GroupsScreen] Groups response data:', data);
        const userGroups = Array.isArray(data) ? data : (data && (data.data || data.groups) ? (data.data || data.groups) : []);
        console.log('[GroupsScreen] Parsed groups:', userGroups);
        if (isMounted.current && requestId === activeRequestId.current) setGroups(Array.isArray(userGroups) ? userGroups : []);
      } else {
        console.warn('[GroupsScreen] Groups fetch failed with status:', response.status);
        if (isMounted.current && requestId === activeRequestId.current) setGroups([]);
      }
    } catch (error: any) {
      if (error && error.name === 'AbortError') {
        console.log('[GroupsScreen] loadGroups aborted (timeout or requestId):', requestId);
      } else {
        console.error('[GroupsScreen] loadGroups error:', error);
      }
      // Show empty state instead of keeping loading
      if (isMounted.current && requestId === activeRequestId.current) setGroups([]);
    } finally {
      if (isMounted.current && requestId === activeRequestId.current) setLoading(false);
      if (currentController.current === controller) currentController.current = null;
    }
  }, [userId]);

  const loadActivities = React.useCallback(async () => {
    if (!userId) return;

    try {
      const response = await authFetch(`/groups/user/${userId}/activities?limit=10`);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('[Groups] Activities endpoint not implemented');
          setActivities([]);
          return;
        }
        throw new Error('Failed to load activities');
      }

      const data = await response.json();
      const activitiesData: ActivityItem[] = Array.isArray(data)
        ? data
        : (data.data || data.activities || []);

      setActivities(activitiesData);
    } catch (error) {
      console.error('[Groups] Load activities error:', error);
      setActivities([]);
    }
  }, [userId]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await loadGroups(); // Only load groups for now
      // await loadActivities(); // Temporarily disabled
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  }, [loadGroups]);

  // doLeave/doDelete perform the network calls (used by ConfirmModal onConfirm)
  const doLeave = async (group: Group) => {
    try {
      if (!userId) {
        showMessage('error', 'Kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }

      const res = await authFetch(`/groups/${group.id}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        setGroups(prev => prev.filter(g => g.id !== group.id));
        showMessage('success', 'Gruptan ayrıldınız');
      } else {
        let serverMsg = '';
        try {
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const err = await res.json();
            serverMsg = (err as any)?.error || '';
          } else {
            serverMsg = await res.text();
          }
        } catch (_) {
          // ignore parse errors
        }

        const lower = serverMsg.toLowerCase();
        let msg = serverMsg || 'Ayrılma işlemi başarısız oldu';
        if (lower.includes('last admin')) {
          // Try to automatically transfer admin to another member, then retry leave
          try {
            const memRes = await authFetch(`/groups/${group.id}/members`);
            if (memRes.ok) {
              const memData = await memRes.json();
              const members: { userId: string; role: string }[] = memData.data || memData;
              const candidate = members.find(m => m.userId !== userId);
              if (!candidate) {
                showMessage('error', 'Bu grupta başka üye yok. Ayrılmadan önce başka bir üye ekleyin.');
                return;
              }
              const trRes = await authFetch(`/groups/${group.id}/transfer-admin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentAdminId: userId, newAdminId: candidate.userId })
              });
              if (trRes.ok) {
                const retry = await authFetch(`/groups/${group.id}/leave`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId }),
                });
                if (retry.ok) {
                  setGroups(prev => prev.filter(g => g.id !== group.id));
                  showMessage('success', 'Adminlik devredildi ve gruptan ayrıldınız');
                  return;
                }
              } else {
                const trErr = await trRes.json().catch(() => ({} as any));
                const trMsg = (trErr as any).error || 'Adminlik devredilemedi';
                showMessage('error', trMsg);
                return;
              }
            }
          } catch (autoErr) {
            console.warn('[GroupsScreen] auto transfer admin failed', autoErr);
          }
          msg = 'Son admin gruptan ayrılamaz. Önce adminliği devredin.';
        } else if (lower.includes('userId required'.toLowerCase())) msg = 'Kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapın.';
        else if (lower.includes('not a member')) msg = 'Bu gruba üye değilsiniz.';
        else if (lower.includes('group not found')) msg = 'Grup bulunamadı.';

        console.warn('[GroupsScreen] doLeave failed', { status: res.status, msg: serverMsg });
        showMessage('error', msg);
      }
    } catch (e) {
      console.error('[GroupsScreen] doLeave error', e);
      showMessage('error', 'Ağ hatası: Ayrılma başarısız');
    }
  };

  // open confirm modal wrappers
  const leaveGroup = (group: Group) => {
    setConfirmState({
      visible: true,
      title: `"${group.name}" grubundan ayrıl?`,
      description: 'Bu işlem geri alınamaz. Onaylıyor musunuz?',
      destructive: true,
      onConfirm: async () => {
        setConfirmState(s => ({ ...s, visible: false }));
        await doLeave(group);
      }
    });
  };

  // deleteGroup removed - not used (doDelete is called directly)

  const handleGroupCreated = (group: Group) => {
    console.log('[Groups] Group created:', group);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setGroups(prev => [...prev, group]);
    setLoading(false); // Ensure loading is false
    showMessage('success', `Grup oluşturuldu. Kodunuz: ${group.code}`);
  };

  const handleJoined = (groupCode: string) => {
    console.log('[Groups] Joined group with code:', groupCode);
    setTimeout(() => loadGroups(), 1000);
  };

  const renderGroupItem = ({ item, index }: { item: any; index: number }) => (
    <Reanimated.View
      entering={FadeInDown.delay(index * 100).springify()}
      layout={Layout.springify()}
      style={styles.groupCardWrapper}
    >
      <Pressable
        style={({ pressed }) => [styles.groupCard, pressed && styles.groupCardPressed]}
        onPress={() => router.push(`/groups/${item.code}/chat`)}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
          style={styles.groupCardGradient}
        >
          <View style={styles.groupCardHeader}>
            <View style={styles.groupIconWrapper}>
              <LinearGradient
                colors={['#0EA5E9', '#6366f1']}
                style={styles.groupIconGradient}
              >
                <Text style={styles.groupIconText}>
                  {item.name ? item.name.slice(0, 2).toUpperCase() : '??'}
                </Text>
              </LinearGradient>
            </View>
            <View style={styles.groupCardInfo}>
              <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
              <View style={styles.groupMetaRow}>
                <Ionicons name="location-sharp" size={12} color="#94a3b8" />
                <Text style={styles.groupAddress} numberOfLines={1}>
                  {item.address || 'Konum belirtilmemiş'}
                </Text>
              </View>
            </View>
            <View style={styles.groupArrow}>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
            </View>
          </View>

          <View style={styles.groupCardFooter}>
            <View style={styles.groupMemberBadge}>
              <Ionicons name="people" size={14} color="#0EA5E9" />
              <Text style={styles.groupMemberText}>
                {item.memberCount || 1} Üye
              </Text>
            </View>
            {!item.isAdmin && (
              <Pressable
                onPress={(e) => { e.stopPropagation(); leaveGroup(item); }}
                style={styles.leaveButton}
              >
                <Text style={styles.leaveButtonText}>Ayrıl</Text>
              </Pressable>
            )}
          </View>
        </LinearGradient>
      </Pressable>
    </Reanimated.View>
  );

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#020617', '#0f172a', '#1e293b']}
        locations={[0, 0.5, 1]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={styles.container} edges={["top"]}>
          <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

          {/* DEBUG: profileName değerini göster */}
          {console.log('[GroupsScreen] Rendering with profileName:', profileName)}

          <UnifiedHeader
            title="Gruplarım"
            subtitle={`${groups.length} aktif grup`}
            brandLabel="BAVAXE"
            gradientColors={['#14b8a6', '#06b6d4', '#0891b2']} // Premium cyan/turquoise gradient
            profileName={profileName}
            avatarUrl={avatarUrl}
            onProfilePress={() => router.push('/(tabs)/profile')}
            showNetwork
            actions={
              <Pressable
                style={({ pressed }) => [
                  styles.headerAddButton,
                  pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }
                ]}
                onPress={() => setShowCreateModal(true)}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.15)']}
                  style={styles.headerAddGradient}
                >
                  <Ionicons name="add" size={24} color="#fff" />
                </LinearGradient>
              </Pressable>
            }
          />

          <Reanimated.FlatList
            data={groups}
            keyExtractor={(item) => item.id}
            renderItem={renderGroupItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />
            }
            ListEmptyComponent={
              !loading ? (
                <EmptyState
                  icon="people"
                  title="Henüz Bir Grupta Değilsiniz"
                  message="Yeni bir ekip oluşturun veya mevcut bir ekibe katılın."
                  actionLabel="Grup Oluştur"
                  onAction={() => setShowCreateModal(true)}
                  secondaryActionLabel="Kodu ile Katıl"
                  onSecondaryAction={() => setShowJoinModal(true)}
                />
              ) : null
            }
            ListHeaderComponent={
              <View style={styles.listHeaderActions}>
                <Pressable
                  style={({ pressed }) => [styles.joinActionCard, pressed && { opacity: 0.9 }]}
                  onPress={() => setShowJoinModal(true)}
                >
                  <LinearGradient
                    colors={['rgba(99, 102, 241, 0.1)', 'rgba(99, 102, 241, 0.05)']}
                    style={styles.joinActionGradient}
                  >
                    <View style={styles.joinActionIcon}>
                      <Ionicons name="qr-code-outline" size={24} color="#8b5cf6" />
                    </View>
                    <View style={styles.joinActionContent}>
                      <Text style={styles.joinActionTitle}>Kod ile Katıl</Text>
                      <Text style={styles.joinActionDesc}>Size verilen davet kodunu kullanın</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={20} color="#8b5cf6" />
                  </LinearGradient>
                </Pressable>
              </View>
            }
          />
        </SafeAreaView>

        {/* Mesaj Toast Animasyonu */}
        {message && (
          <Animated.View style={[styles.toastMessage, { opacity: messageOpacity, transform: [{ translateY: messageTranslateY }] }]}>
            <LinearGradient
              colors={message.type === 'error' ? ['#ef4444', '#dc2626'] : ['#10b981', '#059669']}
              style={styles.toastGradient}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Ionicons name={message.type === 'error' ? 'alert-circle' : 'checkmark-circle'} size={20} color="#fff" />
              <Text style={styles.toastText}>{message.text}</Text>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Modals */}
        <CreateGroupModal
          visible={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onGroupCreated={(group) => {
            setGroups(prev => [group, ...prev]);
            // showMessage handled inside modal via prop usually, ensuring it bubbles up
          }}
          onMessage={showMessage}
        />

        <JoinGroupModal
          visible={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          onJoined={(code) => {
            loadGroups();
          }}
          onMessage={showMessage}
        />

        <ConfirmModal
          visible={confirmState.visible}
          title={confirmState.title}
          description={confirmState.description}
          destructive={confirmState.destructive}
          onConfirm={() => {
            confirmState.onConfirm?.();
            setConfirmState(prev => ({ ...prev, visible: false }));
          }}
          onCancel={() => setConfirmState(prev => ({ ...prev, visible: false }))}
        />

      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  listContent: {
    padding: 20,
    paddingTop: 8,
  },
  listHeaderActions: {
    marginBottom: 24,
  },
  headerAddButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  headerAddGradient: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinActionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  joinActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  joinActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  joinActionContent: {
    flex: 1,
  },
  joinActionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
  joinActionDesc: {
    fontSize: 13,
    color: '#cbd5e1',
    fontFamily: 'Poppins-Regular',
    marginTop: 2,
  },

  // Group Card Styles
  groupCardWrapper: {
    marginBottom: 12,
  },
  groupCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  groupCardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  groupCardGradient: {
    padding: 16,
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  groupIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  groupIconGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupIconText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
  groupCardInfo: {
    flex: 1,
    gap: 4,
  },
  groupName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
  groupMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupAddress: {
    fontSize: 13,
    color: '#94a3b8',
    flex: 1,
    fontFamily: 'Poppins-Regular',
  },
  groupArrow: {
    padding: 4,
  },
  groupCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  groupMemberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.2)',
  },
  groupMemberText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0EA5E9',
    fontFamily: 'Poppins-SemiBold',
  },

  // Toast
  toastMessage: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 9999,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  toastGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    fontFamily: 'Poppins-Medium',
  },

  // Modal & Form Styles (kept but improved colors where applicable)
  modalContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 8,
    fontFamily: 'Poppins-Medium',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
  },
  addressRow: {
    flexDirection: 'row',
    gap: 8,
  },
  geocodeButton: {
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  mapContainer: { height: 220, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },

  createButton: {
    backgroundColor: '#0EA5E9',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6
  },
  createButtonDisabled: { opacity: 0.5 },
  createButtonText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.5, fontFamily: 'Poppins-Bold' },

  errorCard: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderColor: 'rgba(220, 38, 38, 0.2)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  errorText: { color: '#ef4444', fontWeight: '700', flex: 1, fontSize: 14, textAlign: 'center', fontFamily: 'Poppins-Bold' },

  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkButton: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },

  groupInfoCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)'
  },
  groupInfoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  groupInfoTitle: { fontSize: 18, fontWeight: '800', color: '#10b981', marginLeft: 10, fontFamily: 'Poppins-Bold' },
  groupInfoAddress: { fontSize: 14, color: '#94a3b8', marginBottom: 12, fontFamily: 'Poppins-Regular' },
  groupInfoMembers: { fontSize: 13, color: '#e2e8f0', fontFamily: 'Poppins-Medium' },
  groupInfoStatus: { fontSize: 13, color: '#10b981', fontWeight: '700', fontFamily: 'Poppins-Bold' },

  joinButton: {
    backgroundColor: '#7c3aed',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6
  },
  joinButtonDisabled: { opacity: 0.5 },
  joinButtonText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.5, fontFamily: 'Poppins-ExtraBold' },
  fieldErrorText: { color: '#ef4444', marginTop: 8, fontSize: 13, textAlign: 'left', fontFamily: 'Poppins-SemiBold' },

  /* Confirm modal styles */
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    // backdropFilter removed for native compatibility
  },
  confirmCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  confirmHeader: { padding: 24, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)' },
  confirmIconWrap: {
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  confirmTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 8, textAlign: 'center', fontFamily: 'Poppins-Bold' },
  confirmDesc: { color: '#94a3b8', fontSize: 14, textAlign: 'center', fontFamily: 'Poppins-Regular', lineHeight: 22 },
  confirmActions: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, gap: 16 },
  confirmCancel: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  confirmCancelText: { color: '#e2e8f0', fontWeight: '700', fontFamily: 'Poppins-Bold', fontSize: 15 },
  confirmButton: { flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  confirmButtonPrimary: { backgroundColor: '#0EA5E9' },
  confirmButtonDanger: { backgroundColor: '#dc2626' },
  confirmButtonText: { color: '#fff', fontWeight: '900', fontFamily: 'Poppins-ExtraBold', fontSize: 15 },
  modalLoadingOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(2,6,23,0.7)', alignItems: 'center', justifyContent: 'center', borderRadius: 0 },
});
