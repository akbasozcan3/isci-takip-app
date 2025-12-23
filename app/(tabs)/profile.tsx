import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
// Conditional import - won't crash if native module not available
let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.warn('[Profile] expo-image-picker not available, camera/gallery disabled');
}
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import {
  DeviceEventEmitter,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
  ActivityIndicator
} from 'react-native';
import Reanimated, { FadeInDown, Layout } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NetworkStatusIcon } from '../../components/NetworkStatusIcon';
import { UnifiedHeader } from '../../components/UnifiedHeader';
import { Toast, useToast } from '../../components/Toast';
import { getApiBase } from '../../utils/api';
import { authFetch, clearToken } from '../../utils/auth';
import { useProfile } from '../../contexts/ProfileContext';
import { EmailVerificationModal } from '../../components/EmailVerificationModal';
import { ChangePasswordModal } from '../../components/ChangePasswordModal';
import { StatsCard } from '../../components/profile/StatsCard';
import { NotificationSettings } from '../../components/profile/NotificationSettings';
import { HelpSupport } from '../../components/profile/HelpSupport';
import { EditProfileModal } from '../../components/profile/EditProfileModal';

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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.confirmOverlay} onPress={onCancel}>
        <Reanimated.View
          entering={FadeInDown.springify()}
          style={styles.confirmCard}
        >
          <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.confirmGradient}>
            <View style={styles.confirmHeader}>
              <View style={[styles.confirmIconWrap, destructive ? { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' } : {}]}>
                <Ionicons name={destructive ? 'warning' : 'help-circle'} size={32} color={destructive ? '#ef4444' : '#0EA5E9'} />
              </View>
              <Text style={styles.confirmTitle}>{title}</Text>
              {description ? <Text style={styles.confirmDesc}>{description}</Text> : null}
            </View>

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
                  <Text style={[styles.confirmButtonText, destructive && { color: '#fff' }]}>İşlem Yapılıyor...</Text>
                ) : (
                  <Text style={[styles.confirmButtonText, destructive && { color: '#fff' }]}>{confirmText}</Text>
                )}
              </Pressable>
            </View>
          </LinearGradient>
        </Reanimated.View>
      </Pressable>
    </Modal>
  );
}

// Photo Selection Modal Component
interface PhotoModalProps {
  visible: boolean;
  onGallery: () => void;
  onCamera: () => void;
  onCancel: () => void;
}

function PhotoModal({ visible, onGallery, onCamera, onCancel }: PhotoModalProps) {
  const handlePress = async (action: () => void) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    action();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.photoModalOverlay} onPress={onCancel}>
        <Reanimated.View entering={FadeInDown.springify()} style={styles.photoModalContent}>
          <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.photoModalGradient}>
            <Text style={styles.photoModalTitle}>Profil Fotoğrafı</Text>
            <Text style={styles.photoModalSubtitle}>Fotoğrafınızı nasıl eklemek istersiniz?</Text>

            <View style={styles.photoOptionsContainer}>
              <Pressable
                style={({ pressed }) => [
                  styles.photoOption,
                  pressed && styles.photoOptionPressed
                ]}
                onPress={() => handlePress(onGallery)}
              >
                <LinearGradient colors={['#0EA5E9', '#0891b2']} style={styles.photoOptionGradient}>
                  <Ionicons name="images" size={28} color="#fff" />
                  <Text style={styles.photoOptionText}>Galeriden Seç</Text>
                  <Text style={styles.photoOptionDesc}>Mevcut fotoğraflarınızdan seçin</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.photoOption,
                  pressed && styles.photoOptionPressed
                ]}
                onPress={() => handlePress(onCamera)}
              >
                <LinearGradient colors={['#8b5cf6', '#7c3aed']} style={styles.photoOptionGradient}>
                  <Ionicons name="camera" size={28} color="#fff" />
                  <Text style={styles.photoOptionText}>Kameradan Çek</Text>
                  <Text style={styles.photoOptionDesc}>Yeni fotoğraf çekin</Text>
                </LinearGradient>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.photoCancelButton,
                pressed && { opacity: 0.7 }
              ]}
              onPress={onCancel}
            >
              <Text style={styles.photoCancelText}>İptal</Text>
            </Pressable>
          </LinearGradient>
        </Reanimated.View>
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
  const { avatarUrl, setAvatarUrl, loadAvatar: loadAvatarFromContext, deleteAvatar: deleteAvatarContext } = useProfile();
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [apiStatus, setApiStatus] = React.useState<'online' | 'offline'>('offline');
  const [photoModalVisible, setPhotoModalVisible] = React.useState(false);
  const [emailVerificationVisible, setEmailVerificationVisible] = React.useState(false);
  const [verificationEmail, setVerificationEmail] = React.useState('');
  const [changePasswordVisible, setChangePasswordVisible] = React.useState(false);
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

  // New features state
  const [stats, setStats] = React.useState({
    totalLocations: 0,
    totalSteps: 0,
    activeDays: 0,
    lastActive: null as string | null,
  });
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [emailNotifications, setEmailNotifications] = React.useState(true);
  const [editProfileVisible, setEditProfileVisible] = React.useState(false);

  React.useEffect(() => {
    console.log('[Settings] Component mounted');
    let mounted = true;
    const loadUser = async () => {
      try {
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

        if (!mounted) return;
        if (stored) setUserId(stored);
        if (name) setDisplayName(name);
        if (storedEmail) setEmail(storedEmail);

        // Backend health check (simplified for UI focus, but logically sound)
        setApiStatus('online'); // Assume online if we reach here for UI purposes, real check runs in background

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
          }

          // Load statistics
          try {
            const statsResponse = await authFetch('/api/profile/stats');
            if (statsResponse.ok) {
              const statsData = await statsResponse.json();
              if (statsData.success && statsData.data) {
                setStats({
                  totalLocations: statsData.data.totalLocations || 0,
                  totalSteps: statsData.data.totalSteps || 0,
                  activeDays: statsData.data.activeDays || 0,
                  lastActive: statsData.data.lastActive || null,
                });
              }
            }
          } catch (err) {
            console.log('[Profile] Stats fetch error:', err);
          }

          // Load notification settings
          try {
            const notifEnabled = await AsyncStorage.getItem('notificationsEnabled');
            const emailNotif = await AsyncStorage.getItem('emailNotifications');
            if (notifEnabled !== null) setNotificationsEnabled(JSON.parse(notifEnabled));
            if (emailNotif !== null) setEmailNotifications(JSON.parse(emailNotif));
          } catch (err) {
            console.log('[Profile] Notification settings load error:', err);
          }
        } catch (err) {
          console.error('[Settings] User info fetch error:', err);
        }

        try {
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
          const currentUserId = await SecureStore.getItemAsync('workerId');
          if (currentUserId) {
            try {
              await fetch(`${API_BASE}/api/groups/user/${currentUserId}/leave-all`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              });
              await fetch(`${API_BASE}/api/user/${currentUserId}/purge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              });
            } catch (e) {
              console.warn('[Settings] Backend cleanup failed:', e);
            }
          }

          await SecureStore.deleteItemAsync('workerId');
          await SecureStore.deleteItemAsync('displayName');
          await SecureStore.deleteItemAsync('userEmail');
          await SecureStore.deleteItemAsync('activeGroupId');
          await clearToken?.();

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
          DeviceEventEmitter.emit('clearRecentActivities');
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/about');
  };

  const handleLogout = () => {
    setConfirmState({
      visible: true,
      title: 'Çıkış Yap',
      description: 'Hesabınızdan çıkış yapmak istediğinize emin misiniz?',
      confirmText: 'Çıkış Yap',
      destructive: false,
      loading: false,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, loading: true }));

        try {
          console.log('[Logout] Starting logout process...');

          // 1. Check if Google user and revoke session
          try {
            const { isGoogleUser, revokeGoogleSession } = await import('../../utils/googleAuth');
            const isGoogle = await isGoogleUser();

            if (isGoogle) {
              console.log('[Logout] Google user detected, revoking Google session...');
              await revokeGoogleSession();
            }
          } catch (googleError) {
            console.warn('[Logout] Google session revoke failed (non-critical):', googleError);
            // Continue with logout even if Google revoke fails
          }

          // 2. Backend logout request
          try {
            await authFetch('/auth/logout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            console.log('[Logout] Backend logout successful');
          } catch (backendError) {
            console.warn('[Logout] Backend logout failed (non-critical):', backendError);
            // Continue with local cleanup even if backend fails
          }

          // 3. OneSignal cleanup
          try {
            const { removeOneSignalExternalUserId } = await import('../../utils/onesignal');
            const { markUserInactive } = await import('../../utils/onesignalSegments');
            removeOneSignalExternalUserId();
            markUserInactive();
            console.log('[Logout] OneSignal cleanup successful');
          } catch (onesignalError) {
            console.warn('[Logout] OneSignal cleanup failed (non-critical):', onesignalError);
          }

          // 4. Clear all local storage
          await clearToken?.();
          await SecureStore.deleteItemAsync('workerId');
          await SecureStore.deleteItemAsync('displayName');
          await SecureStore.deleteItemAsync('userEmail');
          await SecureStore.deleteItemAsync('activeGroupId');
          await SecureStore.deleteItemAsync('loginMethod');
          await SecureStore.deleteItemAsync('googleIdToken');
          await SecureStore.deleteItemAsync('googleAccessToken');
          await SecureStore.deleteItemAsync('avatarUrl');

          console.log('[Logout] Local storage cleared');

          // 5. Clear user state
          setUserId('');
          setDisplayName('');
          setEmail('');
          setAvatarUrl(null);

          setConfirmState({ visible: false, title: '', description: '' });
          showSuccess('Çıkış yapıldı');

          // 6. Navigate to login
          setTimeout(() => {
            router.replace('/auth/login');
          }, 500);

        } catch (error) {
          console.error('[Logout] Logout error:', error);
          setConfirmState(prev => ({ ...prev, loading: false }));
          showError('Çıkış yapılamadı. Lütfen tekrar deneyin.');
        }
      },
    });
  };

  const handleDeleteAccount = async () => {
    try {
      // Check if user is logged in with Google
      const { isGoogleUser } = await import('../../utils/googleAuth');
      const isGoogle = await isGoogleUser();

      if (isGoogle) {
        // Google users: Direct deletion without email verification
        setConfirmState({
          visible: true,
          title: 'Google Hesabını Kalıcı Olarak Sil',
          description: 'Google ile giriş yaptığınız için hesabınız doğrudan silinecek.\\n\\n⚠️ Silinecek veriler:\\n\\n• Hesap bilgileri\\n• Tüm gruplar ve üyelikler\\n• Konum geçmişi\\n• Tüm veriler\\n\\n⚠️ Bu işlem geri alınamaz!\\n\\nDevam etmek istediğinize emin misiniz?',
          confirmText: 'Hesabı Sil',
          destructive: true,
          loading: false,
          onConfirm: async () => {
            setConfirmState(prev => ({ ...prev, loading: true }));
            try {
              // Direct deletion for Google users
              const response = await authFetch('/auth/account/delete-google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });

              if (response.ok) {
                // Revoke Google session
                try {
                  const { revokeGoogleSession } = await import('../../utils/googleAuth');
                  await revokeGoogleSession();
                } catch (googleError) {
                  console.warn('[Delete] Google session revoke failed:', googleError);
                }

                // Clear all local data
                await clearToken?.();
                await SecureStore.deleteItemAsync('workerId');
                await SecureStore.deleteItemAsync('displayName');
                await SecureStore.deleteItemAsync('userEmail');
                await SecureStore.deleteItemAsync('activeGroupId');
                await SecureStore.deleteItemAsync('loginMethod');
                await SecureStore.deleteItemAsync('googleIdToken');
                await SecureStore.deleteItemAsync('googleAccessToken');
                await SecureStore.deleteItemAsync('avatarUrl');

                try {
                  const keys = await AsyncStorage.getAllKeys();
                  if (keys.length) await AsyncStorage.multiRemove(keys);
                } catch (e) { console.warn('AsyncStorage clear failed', e); }

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
                showError(data.error || 'Hesap silinemedi');
              }
            } catch (e) {
              console.error('[Delete] Google account deletion error:', e);
              setConfirmState(prev => ({ ...prev, loading: false }));
              showError('Hesap silinemedi');
            }
          },
        });
        return;
      }
    } catch (error) {
      console.error('[Delete] Error checking login method:', error);
    }

    // Email/Password users: Email verification required
    setConfirmState({
      visible: true,
      title: 'Hesabı Kalıcı Olarak Sil',
      description: 'Hesabınız ve tüm verileriniz kalıcı olarak silinecek:\n\n• Hesap bilgileri\n• Tüm gruplar ve üyelikler\n• Konum geçmişi\n• Tüm veriler\n\n⚠️ Bu işlem geri alınamaz!\n\nDevam etmek istediğinize emin misiniz?',
      confirmText: 'Doğrulama Kodu Gönder',
      destructive: true,
      loading: false,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, loading: true }));
        try {
          // Request deletion code
          const response = await authFetch('/auth/account/delete-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });

          if (response.ok) {
            setConfirmState({ visible: false, title: '', description: '' });
            setVerificationEmail(email);
            setEmailVerificationVisible(true);
            showSuccess('Doğrulama kodu e-postanıza gönderildi');
          } else {
            const data = await response.json().catch(() => ({}));
            setConfirmState(prev => ({ ...prev, loading: false }));
            showError(data.error || 'Doğrulama kodu gönderilemedi');
          }
        } catch (e) {
          console.error('[Settings] Request deletion code error:', e);
          setConfirmState(prev => ({ ...prev, loading: false }));
          showError('Doğrulama kodu gönderilemedi');
        }
      },
    });
  };

  const handleVerifyAndDelete = async (code: string) => {
    try {
      const response = await authFetch('/auth/account/delete-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });

      if (response.ok) {
        setEmailVerificationVisible(false);

        // Clear all local data
        await clearToken?.();
        await SecureStore.deleteItemAsync('workerId');
        await SecureStore.deleteItemAsync('displayName');
        await SecureStore.deleteItemAsync('userEmail');
        await SecureStore.deleteItemAsync('activeGroupId');

        try {
          const keys = await AsyncStorage.getAllKeys();
          if (keys.length) await AsyncStorage.multiRemove(keys);
        } catch (e) { console.warn('AsyncStorage clear failed', e); }

        DeviceEventEmitter.emit('clearRecentActivities');
        DeviceEventEmitter.emit('app:dataCleared');

        showSuccess('Hesabınız başarıyla silindi');

        setTimeout(() => {
          router.replace('/auth/login');
        }, 1500);
      } else {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Geçersiz doğrulama kodu');
      }
    } catch (e: any) {
      console.error('[Settings] Verify and delete error:', e);
      throw e;
    }
  };

  const handleResendDeletionCode = async () => {
    try {
      const response = await authFetch('/auth/account/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Kod gönderilemedi');
      }
    } catch (e: any) {
      console.error('[Settings] Resend deletion code error:', e);
      throw e;
    }
  };

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const response = await authFetch('/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (response.ok) {
        showSuccess('Şifreniz başarıyla değiştirildi');
      } else {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Şifre değiştirilemedi');
      }
    } catch (e: any) {
      console.error('[Settings] Change password error:', e);
      throw e;
    }
  };

  const initials = React.useMemo(() => {
    if (!displayName) return '';
    return displayName.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  }, [displayName]);

  const handleAvatarPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhotoModalVisible(true);
  };

  const handleAvatarLongPress = () => {
    if (!avatarUrl) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConfirmState({
      visible: true,
      title: 'Profil Fotoğrafını Sil',
      description: 'Profil fotoğrafınızı silmek istediğinize emin misiniz?',
      confirmText: 'Sil',
      destructive: true,
      loading: false,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, loading: true }));
        const result = await deleteAvatarContext();
        setConfirmState({ visible: false, title: '', description: '' });
        if (result.success) {
          showSuccess('Profil fotoğrafı silindi');
        } else {
          showError(result.error || 'Silme başarısız');
        }
      },
    });
  };

  const pickImageFromGallery = async () => {
    setPhotoModalVisible(false);
    if (!ImagePicker) {
      console.error('[Profile] ❌ ImagePicker not available');
      showError('Galeri modülü eksik');
      return;
    }
    try {
      console.log('[Profile] 📸 Requesting gallery permissions...');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[Profile] ⚠️ Gallery permission denied');
        showError('Galeri izni gerekli');
        return;
      }

      console.log('[Profile] 🖼️ Opening image library with crop enabled...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8
      });

      console.log('[Profile] 📋 Picker result:', {
        canceled: result.canceled,
        hasAssets: !!result.assets?.[0],
        uri: result.assets?.[0]?.uri?.substring(0, 50) + '...'
      });

      if (!result.canceled && result.assets[0]) {
        console.log('[Profile] ✅ Image selected, URI:', result.assets[0].uri);
        await uploadAvatar(result.assets[0].uri);
      } else {
        console.log('[Profile] ℹ️ Image selection canceled by user');
      }
    } catch (error) {
      console.error('[Profile] ❌ Gallery picker error:', error);
      showError('Fotoğraf seçilemedi');
    }
  };

  const takePhoto = async () => {
    setPhotoModalVisible(false);
    if (!ImagePicker) { showError('Kamera modülü eksik'); return; }
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { showError('Kamera izni gerekli'); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0]) await uploadAvatar(result.assets[0].uri);
    } catch (error) { showError('Fotoğraf çekilemedi'); }
  };

  const uploadAvatar = async (uri: string) => {
    console.log('[Profile] 🚀 Starting avatar upload...');
    console.log('[Profile] 📸 Image URI:', uri);

    if (!uri || uri.trim() === '') {
      console.error('[Profile] ❌ Invalid URI provided');
      showError('Geçersiz fotoğraf');
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();

      // Extract filename
      const filename = uri.split('/').pop() || `avatar_${Date.now()}.jpg`;
      console.log('[Profile] 📝 Filename:', filename);

      // Detect file type
      const match = /\.(\w+)$/.exec(filename);
      let type = 'image/jpeg'; // Default

      if (match) {
        const ext = match[1].toLowerCase();
        if (ext === 'png') type = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') type = 'image/jpeg';
        else if (ext === 'heic' || ext === 'heif') type = 'image/jpeg';
      }

      console.log('[Profile] 📦 File type:', type);

      formData.append('avatar', {
        uri,
        name: filename,
        type
      } as any);

      console.log('[Profile] 📤 Sending upload request to /users/me/avatar...');
      const response = await authFetch('/users/me/avatar', {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('[Profile] 📥 Response status:', response.status, response.ok ? '✅' : '❌');

      if (response.ok) {
        const data = await response.json();
        console.log('[Profile] ✅ Upload successful, response:', data);

        // Reload avatar from backend
        await loadAvatarFromContext();
        showSuccess('Profil fotoğrafı başarıyla yüklendi!');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Profile] ❌ Upload failed:', response.status, errorData);
        showError(errorData.error || 'Fotoğraf yüklenemedi');
      }
    } catch (error) {
      console.error('[Profile] 💥 Upload error:', error);
      showError('Fotoğraf yüklenirken hata oluştu');
    } finally {
      setUploadingAvatar(false);
      console.log('[Profile] 🏁 Upload process finished');
    }
  };


  // New feature handlers
  const handleEditProfile = async (name: string, phone: string) => {
    try {
      const response = await authFetch('/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name, phone })
      });

      if (response.ok) {
        setDisplayName(name);
        setPhone(phone);
        await SecureStore.setItemAsync('displayName', name);
        showSuccess('Profil başarıyla güncellendi');
      } else {
        throw new Error('Profil güncellenemedi');
      }
    } catch (error: any) {
      console.error('[Profile] Edit error:', error);
      throw error;
    }
  };

  const handleFAQ = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/faq');
  };

  const handleContact = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/contact');
  };

  const handleFeedback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/feedback');
  };

  const handleNotificationToggle = async (value: boolean) => {
    setNotificationsEnabled(value);
    try {
      await AsyncStorage.setItem('notificationsEnabled', JSON.stringify(value));
      showSuccess(value ? 'Bildirimler açıldı' : 'Bildirimler kapatıldı');
    } catch (error) {
      console.error('[Profile] Notification toggle error:', error);
    }
  };

  const handleEmailNotificationToggle = async (value: boolean) => {
    setEmailNotifications(value);
    try {
      await AsyncStorage.setItem('emailNotifications', JSON.stringify(value));
      showSuccess(value ? 'E-posta bildirimleri açıldı' : 'E-posta bildirimleri kapatıldı');
    } catch (error) {
      console.error('[Profile] Email notification toggle error:', error);
    }
  };


  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <UnifiedHeader
        title="Hesabım"
        subtitle="Kişisel ayarlarınız"
        brandLabel="BAVAXE"
        gradientColors={['#0f172a', '#1e293b']}
        showProfile={false}
        showNetwork={true}
      />

      <Reanimated.ScrollView
        entering={FadeInDown.duration(300)}
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true);
            // Re-fetch user logic here if needed
            setRefreshing(false);
          }} tintColor="#0EA5E9" />
        }
      >
        <Reanimated.View entering={FadeInDown.delay(100).springify()} style={styles.section}>
          <LinearGradient
            colors={['#1e293b', 'rgba(30, 41, 59, 0.5)']}
            style={styles.profileCard}
          >
            <View style={styles.profileHeader}>
              <Pressable
                onPress={handleAvatarPress}
                onLongPress={handleAvatarLongPress}
                style={({ pressed }) => [styles.avatarContainer, pressed && { opacity: 0.9 }]}
              >
                <LinearGradient
                  colors={['#0EA5E9', '#6366F1']}
                  style={styles.avatarGradient}
                >
                  {uploadingAvatar ? (
                    <ActivityIndicator color="#fff" />
                  ) : avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitial}>{initials}</Text>
                  )}
                </LinearGradient>
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={12} color="#fff" />
                </View>
              </Pressable>

              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{displayName || 'Kullanıcı'}</Text>
                <Text style={styles.profileEmail}>{email || 'user@example.com'}</Text>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#4ade80" />
                  <Text style={styles.verifiedText}>Doğrulanmış Hesap</Text>
                </View>
              </View>
            </View>

            {subscription && (
              <View style={styles.subInfo}>
                <LinearGradient colors={['rgba(16, 185, 129, 0.1)', 'rgba(16, 185, 129, 0.05)']} style={styles.subBadge}>
                  <Ionicons name="star" size={14} color="#10b981" />
                  <Text style={styles.subText}>{subscription.planName} Plan</Text>
                </LinearGradient>
                {subscription.renewsAt && (
                  <Text style={styles.subDate}>Yenilenme: {new Date(subscription.renewsAt).toLocaleDateString()}</Text>
                )}
              </View>
            )}
          </LinearGradient>
        </Reanimated.View>

        {/* Profile Edit Button */}
        <Reanimated.View entering={FadeInDown.delay(150).springify()} style={styles.section}>
          <Pressable
            style={({ pressed }) => [
              styles.editProfileButton,
              pressed && { opacity: 0.9 }
            ]}
            onPress={() => router.push('/profile/edit')}
          >
            <LinearGradient
              colors={['rgba(14, 165, 233, 0.15)', 'rgba(99, 102, 241, 0.15)']}
              style={styles.editProfileGradient}
            >
              <Ionicons name="create-outline" size={20} color="#0EA5E9" />
              <Text style={styles.editProfileText}>Profil Bilgilerini Düzenle</Text>
              <Ionicons name="chevron-forward" size={20} color="#0EA5E9" />
            </LinearGradient>
          </Pressable>
        </Reanimated.View>

        {/* Statistics Card */}
        <StatsCard
          totalLocations={stats.totalLocations}
          totalSteps={stats.totalSteps}
          activeDays={stats.activeDays}
          lastActive={stats.lastActive}
        />

        {/* Notification Settings */}
        <NotificationSettings
          pushEnabled={notificationsEnabled}
          emailEnabled={emailNotifications}
          onPushToggle={handleNotificationToggle}
          onEmailToggle={handleEmailNotificationToggle}
        />

        {/* Help & Support */}
        <HelpSupport
          onFAQPress={handleFAQ}
          onContactPress={handleContact}
          onFeedbackPress={handleFeedback}
        />

        <Reanimated.View entering={FadeInDown.delay(200).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Uygulama Ayarları</Text>

          <View style={styles.settingsGroup}>
            <Pressable style={styles.settingItem} onPress={handleAbout}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(14, 165, 233, 0.1)' }]}>
                <Ionicons name="information-circle-outline" size={20} color="#0EA5E9" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Hakkında</Text>
                <Text style={styles.settingDesc}>Uygulama sürümü ve bilgileri</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#475569" />
            </Pressable>
          </View>
        </Reanimated.View>

        <Reanimated.View entering={FadeInDown.delay(250).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Güvenlik</Text>

          <View style={styles.settingsGroup}>
            <Pressable style={styles.settingItem} onPress={() => setChangePasswordVisible(true)}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                <Ionicons name="key-outline" size={20} color="#8b5cf6" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Şifre Değiştir</Text>
                <Text style={styles.settingDesc}>Hesap güvenliğinizi koruyun</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#475569" />
            </Pressable>
          </View>
        </Reanimated.View>

        <Reanimated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
          <View style={styles.settingsGroup}>
            <Pressable style={styles.settingItem} onPress={handleLogout}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                <Ionicons name="log-out-outline" size={20} color="#6366f1" />
              </View>
              <Text style={[styles.settingLabel, { flex: 1 }]}>Çıkış Yap</Text>
              <Ionicons name="chevron-forward" size={20} color="#475569" />
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={styles.settingItem} onPress={handleDeleteAccount}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <Ionicons name="person-remove-outline" size={20} color="#ef4444" />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingLabel, { color: '#ef4444' }]}>Hesabı Sil</Text>
                <Text style={styles.settingDesc}>Kalıcı olarak hesabı kapat</Text>
              </View>
            </Pressable>
          </View>
        </Reanimated.View>

        <Text style={styles.versionText}>v1.0.0 • Bavaxe Inc.</Text>
      </Reanimated.ScrollView>

      <ConfirmModal
        visible={confirmState.visible}
        title={confirmState.title}
        description={confirmState.description}
        confirmText={confirmState.confirmText}
        destructive={confirmState.destructive}
        loading={confirmState.loading}
        onCancel={() => setConfirmState(prev => ({ ...prev, visible: false }))}
        onConfirm={() => confirmState.onConfirm && confirmState.onConfirm()}
      />

      <PhotoModal
        visible={photoModalVisible}
        onGallery={pickImageFromGallery}
        onCamera={takePhoto}
        onCancel={() => setPhotoModalVisible(false)}
      />

      <EmailVerificationModal
        visible={emailVerificationVisible}
        email={verificationEmail}
        onVerify={handleVerifyAndDelete}
        onCancel={() => setEmailVerificationVisible(false)}
        onResend={handleResendDeletionCode}
        title="Hesap Silme Doğrulama"
        description="Hesabınızı silmek için e-posta adresinize gönderilen 6 haneli doğrulama kodunu girin"
      />

      <ChangePasswordModal
        visible={changePasswordVisible}
        onClose={() => setChangePasswordVisible(false)}
        onChangePassword={handleChangePassword}
      />

      <EditProfileModal
        visible={editProfileVisible}
        currentName={displayName}
        currentPhone={phone}
        onClose={() => setEditProfileVisible(false)}
        onSave={handleEditProfile}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Poppins-Bold' },

  profileCard: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarGradient: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#0f172a',
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#0EA5E9',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1e293b',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
    fontFamily: 'Poppins-Regular',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 11,
    color: '#4ade80',
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  subInfo: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  subText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  subDate: {
    fontSize: 12,
    color: '#64748b',
  },

  settingsGroup: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
  },
  settingDesc: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Poppins-Regular',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginLeft: 68,
  },

  versionText: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 12,
    marginTop: 20,
    fontFamily: 'Poppins-Regular',
  },

  // Modal Styles
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  confirmCard: { width: '100%', maxWidth: 360, borderRadius: 24, overflow: 'hidden' },
  confirmGradient: { padding: 0 },
  confirmHeader: { padding: 24, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  confirmIconWrap: { width: 56, height: 56, borderRadius: 20, backgroundColor: 'rgba(14, 165, 233, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(14, 165, 233, 0.2)' },
  confirmTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 8, fontFamily: 'Poppins-Bold' },
  confirmDesc: { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 22, fontFamily: 'Poppins-Regular' },
  confirmActions: { flexDirection: 'row', gap: 12, padding: 20 },
  confirmCancel: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  confirmCancelText: { color: '#cbd5e1', fontWeight: '600', fontFamily: 'Poppins-SemiBold' },
  confirmButton: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  confirmButtonPrimary: { backgroundColor: '#0EA5E9' },
  confirmButtonDanger: { backgroundColor: '#ef4444' },
  confirmButtonText: { color: '#fff', fontWeight: 'bold', fontFamily: 'Poppins-Bold' },

  photoModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  photoModalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' },
  photoModalGradient: { padding: 24, paddingBottom: 40 },
  photoModalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 8, fontFamily: 'Poppins-Bold' },
  photoModalSubtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 32, fontFamily: 'Poppins-Regular' },
  photoOptionsContainer: { flexDirection: 'row', gap: 16, marginBottom: 32 },
  photoOption: { flex: 1, borderRadius: 20, overflow: 'hidden', height: 140 },
  photoOptionPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  photoOptionGradient: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  photoOptionText: { color: '#fff', fontWeight: 'bold', fontSize: 15, marginTop: 12, marginBottom: 4, fontFamily: 'Poppins-Bold' },
  photoOptionDesc: { color: 'rgba(255,255,255,0.7)', fontSize: 11, textAlign: 'center', fontFamily: 'Poppins-Regular' },
  photoCancelButton: { padding: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  photoCancelText: { color: '#fff', fontWeight: 'bold', fontSize: 16, fontFamily: 'Poppins-SemiBold' },

  // New styles for profile edit button
  editProfileButton: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.3)',
  },
  editProfileGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
  },
  editProfileText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0EA5E9',
    fontFamily: 'Poppins-Bold',
  },
});
