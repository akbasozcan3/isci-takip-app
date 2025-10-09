import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import {
  DeviceEventEmitter,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Toast, useToast } from '../../components/Toast';
import { getApiBase } from '../../utils/api';
import { authFetch, clearToken } from '../../utils/auth';

const API_BASE = getApiBase();

export default function SettingsScreen() {
  const [userId, setUserId] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [apiStatus, setApiStatus] = React.useState<'online' | 'offline'>('offline');
  const [showClearDialog, setShowClearDialog] = React.useState(false);
  const router = useRouter();
  const { toast, showSuccess, showError, showWarning, hideToast } = useToast();

  React.useEffect(() => {
    console.log('[Settings] Component mounted');
    let mounted = true;
    const loadUser = async () => {
      try {
        console.log('[Settings] Loading user data...');
        setLoading(true);
        const stored = await SecureStore.getItemAsync('workerId');
        const name = await SecureStore.getItemAsync('displayName');
        console.log('[Settings] WorkerId:', stored, 'DisplayName:', name);
        if (!mounted) return;
        if (stored) setUserId(stored);
        if (name) setDisplayName(name);
        
        // Backend health check
        try {
          console.log('[Settings] Checking API health:', `${API_BASE}/health`);
          const healthResponse = await fetch(`${API_BASE}/health`, { 
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          console.log('[Settings] Health check response:', healthResponse.status);
          
          if (healthResponse.ok) {
            console.log('[Settings] API is online');
            setApiStatus('online');
            
            // Eğer kullanıcı varsa bilgilerini çek
            if (stored) {
              try {
                console.log('[Settings] Fetching user profile...');
                const response = await authFetch('/auth/me');
                console.log('[Settings] Profile response status:', response.status);
                if (response.ok) {
                  const { user } = await response.json();
                  console.log('[Settings] User profile:', user);
                  if (user) {
                    if (user.name) setDisplayName(user.name);
                    if (user.email) setEmail(user.email);
                    if (user.phone) setPhone(user.phone);
                  }
                }
              } catch (err) {
                console.error('[Settings] User info fetch error:', err);
              }
            }
          } else {
            console.warn('[Settings] API is offline');
            setApiStatus('offline');
          }
        } catch (err) {
          console.error('[Settings] API health check error:', err);
          setApiStatus('offline');
        }
      } catch (error) {
        console.error('Error loading user info:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadUser();
    return () => { mounted = false; };
  }, [router]);

  const safePress = async (fn: () => Promise<void> | void) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await fn();
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearData = async () => {
    if (!showClearDialog) {
      setShowClearDialog(true);
      showWarning('TÜM VERİLER SİLİNECEK!\n\nGruplar, konum geçmişi ve hesap bilgileri silinecek.\n\nEmİN MİSİNİZ? Tekrar basın onaylayın.');
      setTimeout(() => setShowClearDialog(false), 5000);
      return;
    }
    
    try {
      // Get current user id BEFORE deleting it
      const currentUserId = await SecureStore.getItemAsync('workerId');

      // Proactively leave all groups on backend (and delete groups where user is last admin)
      if (currentUserId) {
        try {
          await fetch(`${API_BASE}/api/groups/user/${currentUserId}/leave-all`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          // Also purge user's location/meta so dashboard stats become zero immediately
          await fetch(`${API_BASE}/api/user/${currentUserId}/purge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e) {
          // ignore; local cleanup will proceed
        }
      }

      await SecureStore.deleteItemAsync('workerId');
      await SecureStore.deleteItemAsync('displayName');
      await SecureStore.deleteItemAsync('activeGroupId');
      await clearToken?.();
      // Clear AsyncStorage caches selectively (preserve onboarding flags)
      try {
        const keys = await AsyncStorage.getAllKeys();
        const preserve = new Set(['onboardingSeen', 'hide_permission_banner']);
        const toRemove = keys.filter((k) => !preserve.has(k));
        if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
      } catch (e) {
        console.warn('[Settings] AsyncStorage selective clear failed', e);
      }
      setUserId('');
      setDisplayName('');
      // Notify other screens (e.g., Home index) to clear their recent activities
      DeviceEventEmitter.emit('clearRecentActivities');
      // Global clear event so all screens reset their state and sockets
      DeviceEventEmitter.emit('app:dataCleared');
      showSuccess('Tüm veriler silindi!');
    } catch (e) {
      showError('Veriler silinemedi.');
    } finally {
      setShowClearDialog(false);
    }
  };

  const handleAbout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showSuccess('Konum Takip Sistemi v1.0 - ELEKS İntegrasyon');
  };

  const initials = React.useMemo(() => {
    if (!displayName) return '';
    return displayName
      .split(' ')
      .map((s) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [displayName]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient colors={["#06b6d4", "#0ea5a4"]} style={styles.header}>
        <View style={styles.headerInner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={styles.headerIcon}>
              <Ionicons name="settings" size={24} color="#06b6d4" />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.title}>Ayarlar</Text>
              <Text style={styles.subtitle}>Hesap ve uygulama ayarları</Text>
            </View>
          </View>

          <View style={styles.avatar}>
            {initials ? (
              <Text style={styles.avatarText}>{initials}</Text>
            ) : (
              <Ionicons name="person" size={26} color="#fff" />
            )}
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uygulama</Text>

          <View style={styles.menuCard}>
            <Pressable style={styles.menuItem} onPress={handleAbout} android_ripple={{ color: '#e6eef0' }}>
              <View style={styles.menuLeft}>
                <Ionicons name="information-circle" size={22} color="#06b6d4" />
                <Text style={styles.menuText}>Hakkında</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={styles.menuItem} onPress={handleClearData} android_ripple={{ color: '#fdecea' }}>
              <View style={styles.menuLeft}>
                <Ionicons name="trash" size={22} color="#ef4444" />
                <Text style={[styles.menuText, { color: '#ef4444' }]}>Verileri Temizle</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sistem</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="server" size={18} color="#06b6d4" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>API Durumu</Text>
                <Text style={[styles.infoValue, { color: apiStatus === 'online' ? '#10b981' : '#ef4444' }]}>
                  {apiStatus === 'online' ? 'Çevrimiçi' : 'Çevrimdışı'}
                </Text>
              </View>
            </View>
            
            {email && (
              <View style={styles.infoRow}>
                <Ionicons name="mail" size={18} color="#06b6d4" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>E-posta</Text>
                  <Text style={styles.infoValue}>{email}</Text>
                </View>
              </View>
            )}
            
            {phone && (
              <View style={styles.infoRow}>
                <Ionicons name="call" size={18} color="#06b6d4" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Telefon</Text>
                  <Text style={styles.infoValue}>{phone}</Text>
                </View>
              </View>
            )}

            <View style={styles.infoRow}>
              <Ionicons name="time" size={18} color="#06b6d4" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Son Güncelleme</Text>
                <Text style={styles.infoValue}>{new Date().toLocaleDateString('tr-TR')}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer}> 
          <Text style={styles.version}>Konum Takip Sistemi v1.0</Text>
          <Text style={styles.copyright}>© 2024 ELEKS İntegrasyon</Text>
        </View>
      </ScrollView>
      
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={hideToast}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 20 : 20,
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerIcon: { 
    width: 52, 
    height: 52, 
    borderRadius: 16, 
    backgroundColor: 'rgba(255,255,255,0.95)', 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 0.5 },
  subtitle: { color: 'rgba(255,255,255,0.9)', marginTop: 3, fontSize: 14, fontWeight: '600' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 18, letterSpacing: 0.5 },
  content: { flex: 1, paddingHorizontal: 18, marginTop: 12 },
  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#fff', marginBottom: 12, letterSpacing: 0.3 },
  menuCard: { 
    backgroundColor: '#1e293b', 
    borderRadius: 16, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: '#334155',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  menuItem: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuText: { marginLeft: 14, fontSize: 16, fontWeight: '700', color: '#fff' },
  divider: { height: 1, backgroundColor: '#334155' },
  infoCard: { 
    backgroundColor: '#1e293b', 
    borderRadius: 16, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: '#334155',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  infoContent: { marginLeft: 12, flex: 1 },
  infoLabel: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },
  infoValue: { fontSize: 16, fontWeight: '800', color: '#fff', marginTop: 2 },
  footer: { alignItems: 'center', paddingVertical: 28 },
  version: { fontSize: 14, color: '#94a3b8', fontWeight: '800' },
  copyright: { fontSize: 13, color: '#64748b', marginTop: 8, fontWeight: '600' },
});
