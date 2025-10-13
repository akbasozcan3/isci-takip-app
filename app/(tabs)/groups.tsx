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
import { Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../../components/EmptyState';
import LeafletMap from '../../components/leaflet-map';
import { SkeletonList } from '../../components/SkeletonLoader';
import { getApiBase } from '../../utils/api';
import { authFetch } from '../../utils/auth';
import ProfileBadge from '../../components/ProfileBadge';

const API_BASE = getApiBase();

/**
 * Cloud-only fetch helper. Always uses API_BASE (Render domain).
 */
async function fetchWithFallback(path: string, init?: RequestInit) {
  const base = API_BASE.replace(/\/$/, '');
  const url = `${base}${path}`;
  console.log('[Network] request:', url);
  return fetch(url, init);
}

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
          <LinearGradient colors={['#111827', '#0b1220']} style={styles.confirmHeader}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name={destructive ? 'warning' : 'help-circle'} size={28} color={destructive ? '#f97316' : '#06b6d4'} />
            </View>
            <Text style={styles.confirmTitle}>{title}</Text>
            {description ? <Text style={styles.confirmDesc}>{description}</Text> : null}
          </LinearGradient>

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
  const [mapRegion, setMapRegion] = React.useState<Region | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [userId, setUserId] = React.useState('');
  const [hasLocationPermission, setHasLocationPermission] = React.useState<boolean>(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

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
          setMapRegion({
            latitude: 39.9208,
            longitude: 32.8541,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          });
        }
      } catch (error) {
        console.warn('[CreateGroupModal] location init error', error);
        setMapRegion({
          latitude: 39.9208,
          longitude: 32.8541,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        });
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
    if (!groupName.trim() || !address.trim() || !selectedLocation || !userId) {
      setLocalError('Lütfen tüm alanları doldurun.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetchWithFallback(`/api/groups`, {
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
        const group = await response.json();
        onGroupCreated(group);
        onClose();
        setGroupName('');
        setAddress('');
        setSelectedLocation(null);
        setLocalError(null);
        onMessage('success', `Grup başarıyla oluşturuldu. Grup kodunuz: ${group.code}`);
      } else {
        const err = await response.json().catch(() => ({ error: 'Grup oluşturulamadı.' }));
        let msg = err.error || 'Grup oluşturulamadı.';
        msg = String(msg);
        if (msg.toLowerCase().includes('name') && msg.toLowerCase().includes('required')) msg = 'Grup adı ve kullanıcı bilgisi zorunludur.';
        setLocalError(msg);
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
        <LinearGradient colors={["#06b6d4", "#0ea5a4"]} style={styles.modalHeader}>
          <View style={styles.modalHeaderContent}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.modalHeaderIcon}><Ionicons name="add-circle" size={24} color="#06b6d4" /></View>
              <Text style={styles.modalTitle}>Yeni Grup Oluştur</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}><Ionicons name="close-circle" size={28} color="#fff" /></Pressable>
          </View>
        </LinearGradient>

        <ScrollView style={styles.modalContent}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Grup Adı <Text style={{color:'#dc2626'}}>*</Text></Text>
            <TextInput style={styles.input} placeholder="Grup adını girin" value={groupName} onChangeText={setGroupName} maxLength={40} autoFocus />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Adres <Text style={{color:'#dc2626'}}>*</Text></Text>
            <View style={styles.addressRow}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Adres girin veya haritadan seçin" value={address} onChangeText={setAddress} maxLength={120} />
              <Pressable onPress={geocodeAddress} style={styles.geocodeButton}><Ionicons name="search" size={20} color="#fff" /></Pressable>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Konum Seçimi <Text style={{color:'#dc2626'}}>*</Text></Text>
            <Text style={styles.helpText}>Haritaya dokunarak grup konumunu seçin</Text>
            <View style={styles.mapContainer}>
              {mapRegion && <LeafletMap centerLat={mapRegion.latitude} centerLng={mapRegion.longitude} onSelect={handleMapSelect} height={220} />}
            </View>
            {selectedLocation && <Text style={{color:'#15803d', marginTop:6, fontSize:13, textAlign:'center'}}>Seçilen konum: {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}</Text>}
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
    if (!groupCode.trim()) return;
    try {
      const response = await fetchWithFallback(`/api/groups/${groupCode}/info`);
      if (response.ok) {
        const info = await response.json();
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
    if (!groupCode.trim() || !displayName.trim()) {
      setLocalError('Lütfen tüm alanları doldurun.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetchWithFallback(`/api/groups/${groupCode}/join-request`, {
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
        const error = await response.json().catch(() => ({ error: 'Gruba katılamadı' }));
        let msg = error.error || 'Gruba katılamadı';
        const lower = String(msg).toLowerCase();
        if (lower.includes('eksik bilgi') || lower.includes('user') || lower.includes('displayname')) msg = 'Lütfen grup kodunu ve isminizi eksiksiz giriniz.';
        else if (lower.includes('already a member')) msg = 'Zaten bu grubun üyesisiniz.';
        else if (lower.includes('request already pending')) msg = 'Zaten bir katılma isteğiniz var. Lütfen onay bekleyin.';
        else if (lower.includes('group not found')) msg = 'Grup bulunamadı. Lütfen kodu kontrol edin.';
        setLocalError(msg);
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
        <LinearGradient colors={["#7c3aed", "#6d28d9"]} style={styles.modalHeader}>
          <View style={styles.modalHeaderContent}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.modalHeaderIcon}><Ionicons name="person-add" size={24} color="#7c3aed" /></View>
              <Text style={styles.modalTitle}>Gruba Katıl</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}><Ionicons name="close-circle" size={28} color="#fff" /></Pressable>
          </View>
        </LinearGradient>

        <ScrollView style={styles.modalContent}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Grup Kodu *</Text>
            <View style={styles.codeRow}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="ABC123" value={groupCode} onChangeText={setGroupCode} autoCapitalize="characters" maxLength={6} />
              <Pressable onPress={checkGroupInfo} style={styles.checkButton}><Ionicons name="search" size={20} color="#fff" /></Pressable>
            </View>
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
          </View>

          <Pressable onPress={joinGroup} style={({ pressed }) => [styles.joinButton, loading && styles.joinButtonDisabled, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]} disabled={loading || !groupCode.trim() || !displayName.trim()}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : (<><Ionicons name="send" size={18} color="#fff" /><Text style={styles.joinButtonText}>Katılma İsteği Gönder</Text></>)}
          </Pressable>

          {localError ? (<View style={styles.errorCard}><Ionicons name="alert-circle" size={20} color="#dc2626" /><Text style={styles.errorText}>{localError}</Text></View>) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* ---------- Main Screen ---------- */
export default function GroupsScreen() {
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [showJoinModal, setShowJoinModal] = React.useState(false);
  const [userId, setUserId] = React.useState('');
  const [profileName, setProfileName] = React.useState<string>('');
  const [message, setMessage] = React.useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [confirmState, setConfirmState] = React.useState<{ visible: boolean; title: string; description?: string; destructive?: boolean; onConfirm?: () => Promise<void> }>({ visible: false, title: '', description: '', destructive: false });
  const messageOpacity = React.useRef(new Animated.Value(0)).current;
  const messageTranslateY = React.useRef(new Animated.Value(-16)).current;

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
        if (stored) {
          setUserId(stored);
          try {
            const r = await authFetch('/auth/me');
            if (r.ok) {
              const { user } = await r.json();
              if (user && user.name) setProfileName(user.name);
            }
          } catch (err) { /* ignore */ }
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
    loadUserId();
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
      } catch {}
    });
    return () => { sub.remove?.(); };
  }, []);

  React.useEffect(() => {
    if (userId) loadGroups();
    else setLoading(false);
  }, [userId]);

  // Ekran odaklandığında (tab'a geri dönüldüğünde) grupları yenile
  useFocusEffect(
    React.useCallback(() => {
      if (userId) {
        loadGroups();
      }
      // no cleanup necessary
      return undefined;
    }, [userId])
  );

  const loadGroups = async () => {
    if (!userId) return setLoading(false);
    setLoading(true);
    try {
      const response = await fetchWithFallback(`/api/groups/user/${userId}/active`);
      if (response.ok) {
        const userGroups = await response.json();
        setGroups(userGroups);
      } else {
        setGroups([]);
        showMessage('error', 'Gruplar alınamadı');
      }
    } catch (error) {
      console.error('[GroupsScreen] loadGroups error', error);
      setGroups([]);
      showMessage('error', 'Ağ hatası: Gruplar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await loadGroups();
    } catch (e) {
      // ignore
    } finally {
      setRefreshing(false);
    }
  }, [userId]);

  // doLeave/doDelete perform the network calls (used by ConfirmModal onConfirm)
  const doLeave = async (group: Group) => {
    try {
      if (!userId) {
        showMessage('error', 'Kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }

      const res = await fetchWithFallback(`/api/groups/${group.id}/leave`, {
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
            const memRes = await fetchWithFallback(`/api/groups/${group.id}/members`);
            if (memRes.ok) {
              const members: Array<{ userId: string; role: string }> = await memRes.json();
              const candidate = members.find(m => m.userId !== userId);
              if (!candidate) {
                showMessage('error', 'Bu grupta başka üye yok. Ayrılmadan önce başka bir üye ekleyin.');
                return;
              }
              const trRes = await fetchWithFallback(`/api/groups/${group.id}/transfer-admin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentAdminId: userId, newAdminId: candidate.userId })
              });
              if (trRes.ok) {
                // Retry leave after successful transfer
                const retry = await fetchWithFallback(`/api/groups/${group.id}/leave`, {
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

  const doDelete = async (group: Group) => {
    try {
      const res = await fetchWithFallback(`/api/groups/${group.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminUserId: userId }),
      });
      if (res.ok) {
        setGroups(prev => prev.filter(g => g.id !== group.id));
        showMessage('success', 'Grup silindi');
      } else {
        const err = await res.json().catch(() => ({} as any));
        let msg = (err as any).error || 'Silme işlemi başarısız oldu';
        if (String(msg).toLowerCase().includes('admin access')) msg = 'Bu işlemi yalnızca yöneticiler yapabilir.';
        showMessage('error', msg);
      }
    } catch (e) {
      console.error('[GroupsScreen] doDelete error', e);
      showMessage('error', 'Ağ hatası: Silinemedi');
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

  const deleteGroup = (group: Group) => {
    setConfirmState({
      visible: true,
      title: `"${group.name}" grubunu sil?`,
      description: 'Grubu kalıcı olarak silmek istiyor musunuz? Tüm üyeler çıkarılacak.',
      destructive: true,
      onConfirm: async () => {
        setConfirmState(s => ({ ...s, visible: false }));
        await doDelete(group);
      }
    });
  };

  const handleGroupCreated = (group: Group) => {
    console.log('[Groups] Group created:', group);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setGroups(prev => [...prev, group]);
    showMessage('success', `Grup oluşturuldu. Kodunuz: ${group.code}`);
  };

  const handleJoined = (groupCode: string) => {
    console.log('[Groups] Joined group with code:', groupCode);
    setTimeout(() => loadGroups(), 1000);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient colors={["#06b6d4", "#0ea5a4"]} style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>Gruplarım</Text>
            <Text style={styles.subtitle}>Konum paylaşım gruplarını yönetin</Text>
          </View>
          <View style={styles.headerButtons}>
            {profileName ? (<ProfileBadge name={profileName} size={48} />) : null}
            <Pressable onPress={() => setShowJoinModal(true)} style={[styles.headerButton, styles.headerJoinButton]}><Ionicons name="person-add" size={20} color="#fff" /></Pressable>
            <Pressable onPress={() => setShowCreateModal(true)} style={[styles.headerButton, styles.headerCreateButton]}><Ionicons name="add" size={24} color="#fff" /></Pressable>
          </View>
        </View>
      </LinearGradient>

      {message && (
        <Animated.View pointerEvents="none" style={[styles.messageBar, message.type === 'success' ? styles.messageSuccess : message.type === 'error' ? styles.messageError : styles.messageInfo, { opacity: messageOpacity, transform: [{ translateY: messageTranslateY }] }]}>
          <Text style={styles.messageText}>{message.text}</Text>
        </Animated.View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? <SkeletonList count={3} /> : groups.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="Henüz grup yok"
            description="Yeni bir grup oluşturarak konum paylaşımına başlayın veya mevcut bir gruba katılın"
            actionText="Grup Oluştur"
            onAction={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowCreateModal(true); }}
            secondaryActionText="Gruba Katıl"
            onSecondaryAction={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowJoinModal(true); }}
          />
        ) : (
          groups.map((group) => (
            <View key={group.id} style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupName}>{group.name}</Text>
                <View style={styles.groupCode}><Text style={styles.groupCodeText}>{group.code}</Text></View>
              </View>

              <Text style={styles.groupAddress}>{group.address}</Text>
              <Text style={styles.groupDate}>{new Date(group.createdAt).toLocaleDateString('tr-TR')}</Text>

              <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push({ pathname: '/group-map', params: { groupId: group.id, groupCode: group.code } }); }} style={({ pressed }) => [styles.mapButton, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]} android_ripple={{ color: 'rgba(255,255,255,0.2)' }}>
                <Ionicons name="map" size={16} color="#fff" /><Text style={styles.mapButtonText}>Haritayı Aç</Text>
              </Pressable>

              <View style={styles.groupActionsRow}>
                <Pressable onPress={() => leaveGroup(group)} style={({ pressed }) => [styles.leaveButton, pressed && { opacity: 0.9 }]}><Ionicons name="log-out-outline" size={16} color="#ef4444" /><Text style={styles.leaveButtonText}>Ayrıl</Text></Pressable>
                {group.isAdmin ? (<Pressable onPress={() => deleteGroup(group)} style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.9 }]}><Ionicons name="trash" size={16} color="#fff" /><Text style={styles.deleteButtonText}>Grubu Sil</Text></Pressable>) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <CreateGroupModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} onGroupCreated={handleGroupCreated} onMessage={showMessage} />
      <JoinGroupModal visible={showJoinModal} onClose={() => setShowJoinModal(false)} onJoined={handleJoined} onMessage={showMessage} />

      <ConfirmModal
        visible={confirmState.visible}
        title={confirmState.title}
        description={confirmState.description}
        destructive={confirmState.destructive}
        onCancel={() => setConfirmState(s => ({ ...s, visible: false }))}
        onConfirm={() => { if (confirmState.onConfirm) confirmState.onConfirm(); }}
      />
    </SafeAreaView>
  );
}

/* ---------- Styles (kept polished) ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 18 : 18, paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#06b6d4', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 10 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 3, fontWeight: '600' },

  messageBar: { position: 'absolute', top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 80 : 100, left: 16, right: 16, zIndex: 999, elevation: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  messageText: { color: '#fff', fontWeight: '600', textAlign: 'center' },
  messageSuccess: { backgroundColor: '#16a34a' },
  messageError: { backgroundColor: '#dc2626' },
  messageInfo: { backgroundColor: '#2563eb' },

  headerButtons: { flexDirection: 'row', gap: 8 },
  profileBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  profileBadgeText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  headerButton: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  headerCreateButton: { backgroundColor: 'rgba(255,255,255,0.2)' }, headerJoinButton: { backgroundColor: 'rgba(255,255,255,0.15)' },

  content: { flex: 1, padding: 16, backgroundColor: '#0f172a' },

  emptyState: { alignItems: 'center', marginTop: 100, paddingHorizontal: 32 },

  groupCard: { backgroundColor: '#1e293b', borderRadius: 20, padding: 22, marginBottom: 18, shadowColor: '#06b6d4', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 12, borderWidth: 1, borderColor: '#334155' },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  groupName: { fontSize: 20, fontWeight: '900', color: '#fff', flex: 1, letterSpacing: 0.5 },
  groupCode: { backgroundColor: '#e6f5f4', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, shadowColor: '#06b6d4', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  groupCodeText: { fontSize: 13, fontWeight: '900', color: '#06b6d4', letterSpacing: 0.5 },
  groupAddress: { fontSize: 15, color: '#94a3b8', marginBottom: 6, fontWeight: '500' },
  groupDate: { fontSize: 13, color: '#64748b', fontWeight: '600' },

  mapButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#06b6d4', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, marginTop: 14, gap: 8, shadowColor: '#06b6d4', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  mapButtonText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },

  groupActionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  leaveButton: { backgroundColor: 'transparent', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#ef4444', flexDirection: 'row', alignItems: 'center', gap: 6 },
  leaveButtonText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  deleteButton: { backgroundColor: '#dc2626', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  deleteButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  modalContainer: { flex: 1, backgroundColor: '#0f172a' },
  modalHeader: { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 20 : 20, paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  modalHeaderContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalHeaderIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  closeButton: { padding: 4 },
  modalContent: { flex: 1, padding: 16 },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 8 },
  helpText: { fontSize: 12, color: '#94a3b8', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#334155', borderRadius: 14, padding: 16, fontSize: 16, backgroundColor: '#1e293b', color: '#fff', fontWeight: '600' },
  addressRow: { flexDirection: 'row', alignItems: 'center' },
  geocodeButton: { backgroundColor: '#06b6d4', padding: 12, borderRadius: 8, marginLeft: 8 },
  mapContainer: { height: 200, borderRadius: 8, overflow: 'hidden' },
  createButton: { backgroundColor: '#06b6d4', padding: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, marginTop: 24, shadowColor: '#06b6d4', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  createButtonDisabled: { opacity: 0.6 },
  createButtonText: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
  errorCard: { backgroundColor: '#fee2e2', borderColor: '#fca5a5', borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  errorText: { color: '#b91c1c', fontWeight: '800', flex: 1, fontSize: 14, textAlign: 'center' },

  codeRow: { flexDirection: 'row', alignItems: 'center' },
  checkButton: { backgroundColor: '#06b6d4', padding: 12, borderRadius: 8, marginLeft: 8 },
  groupInfoCard: { backgroundColor: '#f0fdf4', borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#bbf7d0' },
  groupInfoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  groupInfoTitle: { fontSize: 16, fontWeight: 'bold', color: '#15803d', marginLeft: 8 },
  groupInfoAddress: { fontSize: 14, color: '#64748b', marginBottom: 8 },
  groupInfoFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupInfoMembers: { fontSize: 12, color: '#64748b' },
  groupInfoStatus: { fontSize: 12, color: '#16a34a', fontWeight: '600' },
  joinButton: { backgroundColor: '#7c3aed', padding: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, marginTop: 24, shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  joinButtonDisabled: { opacity: 0.6 },
  joinButtonText: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },

  /* Confirm modal styles */
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  confirmCard: { width: '100%', maxWidth: 520, borderRadius: 14, overflow: 'hidden', backgroundColor: '#071028', borderWidth: 1, borderColor: '#182033' },
  confirmHeader: { padding: 18, alignItems: 'center' },
  confirmIconWrap: { marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 12 },
  confirmTitle: { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 6, textAlign: 'center' },
  confirmDesc: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
  confirmActions: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, gap: 12 },
  confirmCancel: { flex: 1, backgroundColor: 'transparent', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155' },
  confirmCancelText: { color: '#fff', fontWeight: '800' },
  confirmButton: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  confirmButtonPrimary: { backgroundColor: '#06b6d4' },
  confirmButtonDanger: { backgroundColor: '#dc2626' },
  confirmButtonText: { color: '#fff', fontWeight: '900' },
});
