import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import {
  Animated,
  DeviceEventEmitter,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
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

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmModal({
  visible,
  title,
  description,
  confirmText = 'Sil',
  cancelText = 'İptal',
  destructive = false,
  loading = false,
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
              <Ionicons name={destructive ? 'warning' : 'help-circle'} size={32} color={destructive ? '#ef4444' : '#06b6d4'} />
            </View>
            <Text style={styles.confirmTitle}>{title}</Text>
            {description ? <Text style={styles.confirmDesc}>{description}</Text> : null}
          </LinearGradient>

          <View style={styles.confirmActions}>
            <Pressable 
              onPress={onCancel} 
              disabled={loading}
              style={({ pressed }) => [styles.confirmCancel, pressed && !loading && { opacity: 0.9 }]}
            >
              <Text style={styles.confirmCancelText}>{cancelText}</Text>
            </Pressable>

            <Pressable 
              onPress={() => { 
                if (!loading) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); 
                  onConfirm(); 
                }
              }} 
              disabled={loading}
              style={({ pressed }) => [
                styles.confirmButton, 
                destructive ? styles.confirmButtonDanger : styles.confirmButtonPrimary, 
                (pressed || loading) && { opacity: 0.95 }
              ]}
            >
              {loading ? (
                <Text style={[styles.confirmButtonText, destructive && { color: '#fff' }]}>Siliniyor...</Text>
              ) : (
                <Text style={[styles.confirmButtonText, destructive && { color: '#fff' }]}>{confirmText}</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export default function SettingsScreen() {
  const [userId, setUserId] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [createdAt, setCreatedAt] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);
  const [apiStatus, setApiStatus] = React.useState<'online' | 'offline'>('offline');
  const [confirmState, setConfirmState] = React.useState<{
    visible: boolean;
    title: string;
    description?: string;
    confirmText?: string;
    destructive?: boolean;
    loading?: boolean;
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    description: '',
    confirmText: 'Sil',
    destructive: false,
    loading: false,
  });
  const router = useRouter();
  const { toast, showSuccess, showError, hideToast } = useToast();
  const [subscription, setSubscription] = React.useState<{
    planId: string;
    planName: string;
    renewsAt?: string | null;
  } | null>(null);
  const subscriptionRenewal = React.useMemo(() => {
    if (!subscription?.renewsAt) return '';
    try {
      return new Date(subscription.renewsAt).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  }, [subscription]);

  React.useEffect(() => {
    console.log('[Settings] Component mounted');
    let mounted = true;
    const loadUser = async () => {
      try {
        console.log('[Settings] Loading user data...');
        
        // Timeout ekle (10 saniye)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000)
        );
        
        const [stored, name, storedEmail] = await Promise.race([
          Promise.all([
            SecureStore.getItemAsync('workerId'),
            SecureStore.getItemAsync('displayName'),
            SecureStore.getItemAsync('userEmail')
          ]),
          timeoutPromise
        ]) as [string | null, string | null, string | null];
        
        console.log('[Settings] WorkerId:', stored, 'DisplayName:', name, 'Email:', storedEmail);
        if (!mounted) return;
        if (stored) setUserId(stored);
        if (name) setDisplayName(name);
        if (storedEmail) setEmail(storedEmail);
        
        // Backend health check
        const controller = new AbortController();
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        
        try {
          const healthUrl = `${API_BASE}/api/health`;
          console.log('[Settings] Checking API health:', healthUrl);
          timeoutId = setTimeout(() => {
            if (!controller.signal.aborted) {
              controller.abort();
            }
          }, 8000) as ReturnType<typeof setTimeout>;
          
          const healthResponse = await fetch(healthUrl, { 
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
          });
          
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          console.log('[Settings] Health check response:', healthResponse.status);
          
          if (healthResponse.ok) {
            const healthData = await healthResponse.json().catch(() => ({}));
            console.log('[Settings] API is online', healthData);
            setApiStatus('online');
            
            try {
              console.log('[Settings] Fetching user profile...');
              const response = await authFetch('/users/me');
              console.log('[Settings] Profile response status:', response.status);
              if (response.ok) {
                const data = await response.json();
                console.log('[Settings] User profile data:', data);
                // Backend'den gelen veri { success: true, user: {...} } formatında
                const userData = data.user || data;
                if (userData) {
                  if (userData.displayName) setDisplayName(userData.displayName);
                  else if (userData.name) setDisplayName(userData.name);
                  
                  if (userData.email) setEmail(userData.email);
                  if (userData.phone) setPhone(userData.phone);
                  if (userData.id) setUserId(userData.id);
                  if (userData.createdAt) setCreatedAt(userData.createdAt);
                }
              }
            } catch (err) {
              console.error('[Settings] User info fetch error:', err);
            }

            try {
              console.log('[Settings] Fetching subscription info...');
              const subscriptionResponse = await authFetch('/me/subscription');
              if (subscriptionResponse.ok) {
                const subData = await subscriptionResponse.json();
                if (subData?.subscription) {
                  setSubscription({
                    planId: subData.subscription.planId || 'free',
                    planName: subData.subscription.planName || 'Free',
                    renewsAt: subData.subscription.renewsAt || null
                  });
                }
              }
            } catch (err) {
              console.warn('[Settings] Subscription fetch error:', err);
            }
          } else {
            console.warn('[Settings] API returned non-OK status:', healthResponse.status);
            setApiStatus('offline');
          }
        } catch (err: unknown) {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          if (err instanceof Error && err.name === 'AbortError') {
            console.warn('[Settings] Health check timeout - API may be slow or offline');
          } else if (err instanceof Error) {
            console.warn('[Settings] Health check failed:', err.message);
          }
          setApiStatus('offline');
        }
      } catch (error) {
        console.error('Error loading user info:', error);
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

  const handleClearData = () => {
    setConfirmState({
      visible: true,
      title: 'Verileri Temizle',
      description: 'Tüm yerel verileriniz silinecek:\n\n• Gruplar ve üyelikler\n• Konum geçmişi\n• Önbellek verileri\n• Hesap bilgileri\n\nBu işlem geri alınamaz. Devam etmek istediğinize emin misiniz?',
      confirmText: 'Temizle',
      destructive: true,
      loading: false,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, loading: true }));
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
              console.warn('[Settings] Backend cleanup failed:', e);
              // Continue with local cleanup
            }
          }

          await SecureStore.deleteItemAsync('workerId');
          await SecureStore.deleteItemAsync('displayName');
          await SecureStore.deleteItemAsync('userEmail');
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
          setConfirmState({ visible: false, title: '', description: '' });
          showSuccess('Tüm veriler başarıyla temizlendi!');
        } catch (e) {
          console.error('[Settings] Clear data error:', e);
          setConfirmState(prev => ({ ...prev, loading: false }));
          showError('Veriler temizlenirken hata oluştu.');
        }
      },
    });
  };

  const handleAbout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showSuccess('Bavaxe Konum Takip Sistemi v1.0');
  };

  const handleLogout = async () => {
    await safePress(async () => {
      try {
        const { removeOneSignalExternalUserId } = await import('../../utils/onesignal');
        const { markUserInactive } = await import('../../utils/onesignalSegments');
        removeOneSignalExternalUserId();
        markUserInactive();
        await clearToken?.();
        await SecureStore.deleteItemAsync('workerId');
        await SecureStore.deleteItemAsync('displayName');
        await SecureStore.deleteItemAsync('userEmail');
        await SecureStore.deleteItemAsync('activeGroupId');
        showSuccess('Çıkış yapıldı');
        router.replace('/auth/login');
      } catch (e) {
        showError('Çıkış yapılamadı');
      }
    });
  };

  const handleDeleteAccount = () => {
    setConfirmState({
      visible: true,
      title: 'Hesabı Kalıcı Olarak Sil',
      description: 'Hesabınız ve tüm verileriniz kalıcı olarak silinecek:\n\n• Hesap bilgileri\n• Tüm gruplar ve üyelikler\n• Konum geçmişi\n• Tüm veriler\n\n⚠️ Bu işlem geri alınamaz!\n\nDevam etmek istediğinize emin misiniz?',
      confirmText: 'Hesabı Sil',
      destructive: true,
      loading: false,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, loading: true }));
        try {
          const response = await authFetch('/auth/account', {
            method: 'DELETE',
          });

          if (response.ok) {
            // Clear all local data
            await clearToken?.();
            await SecureStore.deleteItemAsync('workerId');
            await SecureStore.deleteItemAsync('displayName');
            await SecureStore.deleteItemAsync('userEmail');
            await SecureStore.deleteItemAsync('activeGroupId');
            
            // Clear AsyncStorage caches
            try {
              const keys = await AsyncStorage.getAllKeys();
              if (keys.length) await AsyncStorage.multiRemove(keys);
            } catch (e) {
              console.warn('[Settings] AsyncStorage clear failed', e);
            }

            // Notify other screens
            DeviceEventEmitter.emit('clearRecentActivities');
            DeviceEventEmitter.emit('app:dataCleared');

            setConfirmState({ visible: false, title: '', description: '' });
            showSuccess('Hesabınız başarıyla silindi');
            
            setTimeout(() => {
              router.replace('/auth/login');
            }, 1500);
          } else {
            const data = await response.json().catch(() => ({}));
            setConfirmState(prev => ({ ...prev, loading: false }));
            showError(data.error || 'Hesap silinemedi. Lütfen tekrar deneyin.');
          }
        } catch (e) {
          console.error('[Settings] Delete account error:', e);
          setConfirmState(prev => ({ ...prev, loading: false }));
          showError('Hesap silinirken hata oluştu. Lütfen internet bağlantınızı kontrol edin.');
        }
      },
    });
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
          <View style={styles.headerLeft}>
            <View>
              <Text style={styles.brandTitle}>BAVAXE</Text>
              <Text style={styles.title}>Ayarlar</Text>
              <Text style={styles.subtitle}>Hesap ve uygulama ayarları</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={{ paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                const response = await authFetch('/users/me');
                if (response.ok) {
                  const data = await response.json();
                  const userData = data.user || data;
                  if (userData) {
                    if (userData.displayName) setDisplayName(userData.displayName);
                    else if (userData.name) setDisplayName(userData.name);
                    if (userData.email) setEmail(userData.email);
                    if (userData.phone) setPhone(userData.phone);
                    if (userData.id) setUserId(userData.id);
                    if (userData.createdAt) setCreatedAt(userData.createdAt);
                  }
                  showSuccess('Bilgiler güncellendi');
                }
              } catch (error) {
                showError('Yenileme başarısız');
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor="#06b6d4"
            colors={['#06b6d4']}
          />
        }
      >
        {/* Hesap Bilgileri Kartı */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profil Bilgileri</Text>
          <View style={styles.accountCard}>
            <View style={styles.accountHeader}>
              <View style={styles.accountAvatar}>
                {initials ? (
                  <Text style={styles.accountAvatarText}>{initials}</Text>
                ) : (
                  <Ionicons name="person" size={32} color="#06b6d4" />
                )}
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>{displayName || 'Kullanıcı'}</Text>
                <Text style={styles.accountEmail}>{email || 'Email bilgisi yok'}</Text>
                {userId && <Text style={styles.accountId}>ID: {userId}</Text>}
              </View>
            </View>
            
            <View style={styles.accountDivider} />
            
            <View style={styles.accountDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="mail" size={18} color="#06b6d4" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>E-posta</Text>
                  <Text style={styles.detailValue}>{email || 'Belirtilmemiş'}</Text>
                </View>
              </View>
              
              <View style={styles.detailRow}>
                <Ionicons name="person" size={18} color="#06b6d4" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Kullanıcı Adı</Text>
                  <Text style={styles.detailValue}>{displayName || 'Belirtilmemiş'}</Text>
                </View>
              </View>
              
              {phone && (
                <View style={styles.detailRow}>
                  <Ionicons name="call" size={18} color="#06b6d4" />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Telefon</Text>
                    <Text style={styles.detailValue}>{phone}</Text>
                  </View>
                </View>
              )}
              
              {createdAt && (
                <View style={styles.detailRow}>
                  <Ionicons name="calendar" size={18} color="#06b6d4" />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Kayıt Tarihi</Text>
                    <Text style={styles.detailValue}>
                      {new Date(createdAt).toLocaleDateString('tr-TR', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </Text>
                  </View>
                </View>
              )}
              
              <View style={styles.detailRow}>
                <Ionicons name="shield-checkmark" size={18} color="#10b981" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Hesap Durumu</Text>
                  <Text style={[styles.detailValue, { color: '#10b981' }]}>Aktif ve Doğrulanmış</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <LinearGradient 
            colors={subscription?.planId === 'business' ? ['#7c3aed', '#6d28d9'] : subscription?.planId === 'plus' ? ['#10b981', '#059669'] : ['#181826', '#0f0f1a']} 
            style={styles.subscriptionCard}
          >
            <View style={styles.subscriptionBadge}>
              <Ionicons 
                name={subscription?.planId === 'business' ? 'rocket' : subscription?.planId === 'plus' ? 'star' : 'sparkles'} 
                size={16} 
                color={subscription?.planId === 'free' ? '#c084fc' : '#fff'} 
              />
              <Text style={[styles.subscriptionBadgeText, subscription?.planId !== 'free' && { color: '#fff' }]}>
                {subscription?.planId === 'business' ? 'Business' : subscription?.planId === 'plus' ? 'Plus' : 'Pro avantajları'}
              </Text>
            </View>
            <Text style={styles.subscriptionTitle}>
              {subscription?.planName ? `${subscription.planName} planı aktif` : 'Planını yükselt'}
            </Text>
            <Text style={styles.subscriptionSubtitle}>
              {subscriptionRenewal
                ? `Yenileme tarihi: ${subscriptionRenewal}`
                : subscription?.planId === 'free'
                ? 'Limitsiz workspace, gelişmiş raporlar ve öncelikli destekle takımını güçlendir.'
                : 'Premium özellikler aktif. Planınızı yönetmek için tıklayın.'}
            </Text>
            <Pressable
              style={styles.subscriptionButton}
              onPress={() => router.push('/UpgradeScreen' as any)}
              android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
            >
              <Text style={styles.subscriptionButtonText}>
                {subscription?.planId === 'free' ? 'Planları incele' : 'Planı yönet'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#050509" />
            </Pressable>
          </LinearGradient>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hesap Yönetimi</Text>

          <View style={styles.menuCard}>
            <View style={styles.divider} />
            <Pressable 
              style={styles.menuItem} 
              onPress={() => router.push({ pathname: '/auth/reset-password', params: { email: email || '', fromSettings: 'true' } } as any)} 
              android_ripple={{ color: '#e6eef0' }}
            >
              <View style={styles.menuLeft}>
                <Ionicons name="key-outline" size={22} color="#06b6d4" />
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuText}>Şifremi Unuttum</Text>
                  <Text style={styles.menuDescription}>E-posta adresinize gönderilen link ile şifrenizi sıfırlayın</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </Pressable>

            <View style={styles.divider} />
       

            <View style={styles.divider} />
            <Pressable 
              style={styles.menuItem} 
              onPress={() => router.push('/profile/edit' as any)} 
              android_ripple={{ color: '#e6eef0' }}
            >
              <View style={styles.menuLeft}>
                <Ionicons name="create-outline" size={22} color="#06b6d4" />
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuText}>Profili Düzenle</Text>
                  <Text style={styles.menuDescription}>Ad, soyad ve profil bilgilerinizi güncelleyin</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </Pressable>

            <View style={styles.divider} />
            <Pressable 
              style={styles.menuItem} 
              onPress={() => router.push('/profile/edit' as any)} 
              android_ripple={{ color: '#e6eef0' }}
            >
              <View style={styles.menuLeft}>
                <Ionicons name="lock-closed-outline" size={22} color="#f59e0b" />
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuText}>Şifre Değiştir</Text>
                  <Text style={styles.menuDescription}>Mevcut şifrenizle veya Gmail doğrulaması ile şifrenizi değiştirin</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={styles.menuItem} onPress={handleLogout} android_ripple={{ color: '#e6eef0' }}>
              <View style={styles.menuLeft}>
                <Ionicons name="log-out" size={22} color="#06b6d4" />
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuText}>Çıkış Yap</Text>
                  <Text style={styles.menuDescription}>Hesabınızdan güvenli şekilde çıkış yapın</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </Pressable>

            <View style={styles.divider} />

            <Pressable 
              style={styles.menuItem} 
              onPress={() => router.push('/help' as any)} 
              android_ripple={{ color: '#e6eef0' }}
            >
              <View style={styles.menuLeft}>
                <Ionicons name="help-circle-outline" size={22} color="#06b6d4" />
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuText}>Yardım & Destek</Text>
                  <Text style={styles.menuDescription}>Sorularınız için iletişim kanallarımız ve SSS</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={styles.menuItem} onPress={handleAbout} android_ripple={{ color: '#e6eef0' }}>
              <View style={styles.menuLeft}>
                <Ionicons name="information-circle" size={22} color="#06b6d4" />
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuText}>Hakkında</Text>
                  <Text style={styles.menuDescription}>Uygulama versiyonu ve geliştirici bilgileri</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={styles.menuItem} onPress={handleClearData} android_ripple={{ color: '#fdecea' }}>
              <View style={styles.menuLeft}>
                <Ionicons name="trash" size={22} color="#ef4444" />
                <View style={styles.menuTextContainer}>
                  <Text style={[styles.menuText, { color: '#ef4444' }]}>Verileri Temizle</Text>
                  <Text style={[styles.menuDescription, { color: '#fca5a5' }]}>Tüm yerel verileri ve önbelleği temizler</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={styles.menuItem} onPress={handleDeleteAccount} android_ripple={{ color: '#fdecea' }}>
              <View style={styles.menuLeft}>
                <Ionicons name="trash-bin" size={22} color="#dc2626" />
                <View style={styles.menuTextContainer}>
                  <Text style={[styles.menuText, { color: '#dc2626', fontWeight: '900' }]}>Hesabı Sil</Text>
                  <Text style={[styles.menuDescription, { color: '#fca5a5' }]}>Hesabınızı kalıcı olarak siler, bu işlem geri alınamaz</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </Pressable>
            
            <View style={styles.divider} />
            <Pressable 
              style={styles.menuItem} 
              onPress={() => router.push('/(tabs)/admin' as any)} 
              android_ripple={{ color: '#e6eef0' }}
            >
              <View style={styles.menuLeft}>
                <Ionicons name="trash" size={22} color="#dc2626" />
                <View style={styles.menuTextContainer}>
                  <Text style={[styles.menuText, { color: '#dc2626' }]}>Grubu Sil (Admin)</Text>
                  <Text style={[styles.menuDescription, { color: '#fca5a5' }]}>Admin olduğunuz grupları yönetin ve silebilirsiniz</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sistem Bilgileri</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="server" size={18} color="#06b6d4" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>API Durumu</Text>
                <Text style={[styles.infoValue, { color: apiStatus === 'online' ? '#10b981' : '#ef4444' }]}>
                  {apiStatus === 'online' ? '● Çevrimiçi' : '● Çevrimdışı'}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="time" size={18} color="#06b6d4" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Son Güncelleme</Text>
                <Text style={styles.infoValue}>{new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <Ionicons name="phone-portrait" size={18} color="#06b6d4" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Platform</Text>
                <Text style={styles.infoValue}>{Platform.OS === 'ios' ? 'iOS' : 'Android'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer}> 
          <Text style={styles.version}>Bavaxe Konum Takip Sistemi v1.0</Text>
          <Text style={styles.copyright}>© 2024 Bavaxe</Text>
        </View>
      </ScrollView>
      
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={hideToast}
      />

      <ConfirmModal
        visible={confirmState.visible}
        title={confirmState.title}
        description={confirmState.description}
        confirmText={confirmState.confirmText}
        cancelText="İptal"
        destructive={confirmState.destructive}
        loading={confirmState.loading}
        onCancel={() => setConfirmState({ visible: false, title: '', description: '' })}
        onConfirm={() => {
          if (confirmState.onConfirm) {
            confirmState.onConfirm();
          }
        }}
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
  },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  brandTitle: { color: 'rgba(255,255,255,0.9)', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Poppins-SemiBold' },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 0.5, fontFamily: 'Poppins-Bold' },
  subtitle: { color: 'rgba(255,255,255,0.9)', marginTop: 3, fontSize: 14, fontWeight: '600', fontFamily: 'Poppins-SemiBold' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 18, letterSpacing: 0.5, fontFamily: 'Poppins-Bold' },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  content: { flex: 1, paddingHorizontal: 18, marginTop: 12 },
  accountCard: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#06b6d4',
  },
  accountAvatarText: {
    color: '#06b6d4',
    fontWeight: '900',
    fontSize: 24,
    letterSpacing: 0.5,
    fontFamily: 'Poppins-Bold',
  },
  accountInfo: {
    marginLeft: 16,
    flex: 1,
  },
  accountName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
    fontFamily: 'Poppins-Bold',
  },
  accountEmail: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  accountId: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
    fontFamily: 'Poppins-Medium',
  },
  accountDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 16,
  },
  accountDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailContent: {
    marginLeft: 12,
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 2,
    fontFamily: 'Poppins-SemiBold',
  },
  detailValue: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#fff', marginBottom: 12, letterSpacing: 0.3, fontFamily: 'Poppins-Bold' },
  subscriptionCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2c2c3e',
    gap: 14
  },
  subscriptionBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999
  },
  subscriptionBadgeText: {
    color: '#c084fc',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.3
  },
  subscriptionTitle: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '900',
    fontFamily: 'Poppins-Bold'
  },
  subscriptionSubtitle: {
    color: '#cbd5f5',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Poppins-Regular'
  },
  subscriptionButton: {
    marginTop: 4,
    backgroundColor: '#c084fc',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  subscriptionButtonText: {
    color: '#050509',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.2
  },
  menuCard: { 
    backgroundColor: '#1e293b', 
    borderRadius: 16, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: '#334155',
  },
  menuItem: { padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  menuTextContainer: { marginLeft: 14, flex: 1 },
  menuText: { fontSize: 17, fontWeight: '800', color: '#fff', fontFamily: 'Poppins-Bold', letterSpacing: 0.2, marginBottom: 4 },
  menuDescription: { fontSize: 13, color: '#64748b', fontFamily: 'Poppins-Regular', lineHeight: 18 },
  divider: { height: 1, backgroundColor: '#334155' },
  infoCard: { 
    backgroundColor: '#1e293b', 
    borderRadius: 16, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: '#334155',
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  infoContent: { marginLeft: 12, flex: 1 },
  infoLabel: { fontSize: 14, color: '#94a3b8', fontWeight: '600', fontFamily: 'Poppins-SemiBold' },
  infoValue: { fontSize: 16, fontWeight: '800', color: '#fff', marginTop: 2, fontFamily: 'Poppins-ExtraBold' },
  footer: { alignItems: 'center', paddingVertical: 28 },
  version: { fontSize: 14, color: '#94a3b8', fontWeight: '800', fontFamily: 'Poppins-ExtraBold' },
  copyright: { fontSize: 13, color: '#64748b', marginTop: 8, fontWeight: '600', fontFamily: 'Poppins-SemiBold' },
  
  // Confirm Modal Styles
  confirmOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 20 
  },
  confirmCard: { 
    width: '100%', 
    maxWidth: 400, 
    borderRadius: 20, 
    overflow: 'hidden', 
    backgroundColor: '#0f172a', 
    borderWidth: 1, 
    borderColor: '#1e293b',
  },
  confirmHeader: { 
    padding: 24, 
    alignItems: 'center' 
  },
  confirmIconWrap: { 
    marginBottom: 16, 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    padding: 16, 
    borderRadius: 16 
  },
  confirmTitle: { 
    color: '#fff', 
    fontSize: 22, 
    fontWeight: '900', 
    marginBottom: 12, 
    textAlign: 'center', 
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.3,
  },
  confirmDesc: { 
    color: '#94a3b8', 
    fontSize: 15, 
    textAlign: 'center', 
    fontFamily: 'Poppins-Regular',
    lineHeight: 22,
  },
  confirmActions: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    padding: 20, 
    gap: 12 
  },
  confirmCancel: { 
    flex: 1, 
    backgroundColor: 'transparent', 
    borderRadius: 12, 
    paddingVertical: 14, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1.5, 
    borderColor: '#334155' 
  },
  confirmCancelText: { 
    color: '#94a3b8', 
    fontWeight: '800', 
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.3,
  },
  confirmButton: { 
    flex: 1, 
    borderRadius: 12, 
    paddingVertical: 14, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  confirmButtonPrimary: { 
    backgroundColor: '#06b6d4' 
  },
  confirmButtonDanger: { 
    backgroundColor: '#ef4444' 
  },
  confirmButtonText: { 
    color: '#fff', 
    fontWeight: '900', 
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.3,
  },
});
