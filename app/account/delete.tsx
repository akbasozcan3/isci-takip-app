import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Toast, useToast } from '../../components/Toast';
import { authFetch, clearToken } from '../../utils/auth';

export default function DeleteAccountScreen(): React.JSX.Element {
  const router = useRouter();
  const { toast, showError, showSuccess, hideToast } = useToast();
  
  const [step, setStep] = React.useState<'warning' | 'verification'>('warning');
  const [loading, setLoading] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [countdown, setCountdown] = React.useState(0);
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;

  React.useEffect(() => {
    loadUserInfo();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  React.useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [countdown]);

  const loadUserInfo = async (): Promise<void> => {
    try {
      const res = await authFetch('/api/auth/profile');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setEmail(data.data.email || '');
          setPhone(data.data.phone || '');
        }
      }
    } catch (error) {
      console.warn('[DeleteAccount] Failed to load user info:', error);
    }
  };

  const handleRequestCode = async () => {
    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const res = await authFetch('/api/auth/account/delete/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCountdown(60);
          setStep('verification');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showSuccess('Doğrulama kodu e-posta adresinize gönderildi');
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          showError(data.message || 'Kod gönderilemedi');
        }
      } else {
        const error = await res.json().catch(() => ({ message: 'Kod gönderilemedi' }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        
        if (error.code === 'EMAIL_SEND_ERROR') {
          showError('E-posta gönderilemedi. Lütfen SMTP ayarlarını kontrol edin veya daha sonra tekrar deneyin.');
        } else {
          showError(error.message || 'Kod gönderilemedi');
        }
      }
    } catch (error: any) {
      console.error('[DeleteAccount] Request code error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        showError('İnternet bağlantınızı kontrol edin ve tekrar deneyin.');
      } else {
        showError('Bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;
    await handleRequestCode();
  };

  const handleDeleteAccount = async () => {
    if (!code || code.length !== 6) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError('Lütfen 6 haneli doğrulama kodunu girin');
      return;
    }

    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      const res = await authFetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          // Clear all local data comprehensively
          try {
            await clearToken();
            await SecureStore.deleteItemAsync('auth_token');
            await SecureStore.deleteItemAsync('refresh_token');
            await SecureStore.deleteItemAsync('workerId');
            await SecureStore.deleteItemAsync('displayName');
            await SecureStore.deleteItemAsync('userEmail');
            await SecureStore.deleteItemAsync('activeGroupId');
            
            // Clear AsyncStorage as well
            const keys = await AsyncStorage.getAllKeys();
            if (keys.length > 0) {
              await AsyncStorage.multiRemove(keys);
            }
          } catch (clearError) {
            console.warn('[DeleteAccount] Error clearing local data:', clearError);
          }
          
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showSuccess('Hesabınız başarıyla silindi');
          
          // Navigate to login after delay
          setTimeout(() => {
            router.replace('/auth/login');
          }, 2000);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          showError(data.message || 'Hesap silinemedi');
        }
      } else {
        const error = await res.json().catch(() => ({ message: 'Hesap silinemedi' }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        
        // Handle specific error codes
        if (error.code === 'INVALID_CODE') {
          showError('Geçersiz veya süresi dolmuş doğrulama kodu. Lütfen yeni bir kod isteyin.');
        } else {
          showError(error.message || 'Hesap silinemedi. Lütfen tekrar deneyin.');
        }
      }
    } catch (error: any) {
      console.error('[DeleteAccount] Delete error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        showError('İnternet bağlantınızı kontrol edin ve tekrar deneyin.');
      } else {
        showError('Bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'verification') {
      setStep('warning');
      setCode('');
      setCountdown(0);
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <LinearGradient
          colors={['#0f172a', '#1e293b', '#334155']}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={handleBack}
              style={styles.backButton}
              android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <Text style={styles.headerTitle}>Hesabı Sil</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={[
                styles.content,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {step === 'warning' ? (
                <>
                  {/* Warning Icon */}
                  <View style={styles.iconContainer}>
                    <View style={styles.iconCircle}>
                      <Ionicons name="warning" size={64} color="#ef4444" />
                    </View>
                  </View>

                  {/* Warning Title */}
                  <Text style={styles.title}>Hesabınızı Silmek İstediğinize Emin misiniz?</Text>

                  {/* Warning Message */}
                  <View style={styles.warningBox}>
                    <View style={styles.warningTitleRow}>
                      <Ionicons name="warning" size={18} color="#ef4444" />
                      <Text style={styles.warningTitle}>ÖNEMLİ UYARI</Text>
                    </View>
                    <Text style={styles.warningText}>
                      Hesabın ve tüm verilerin KALICI olarak silinecek
                    </Text>
                  </View>

                  {/* Details List */}
                  <View style={styles.detailsContainer}>
                    <View style={styles.detailItem}>
                      <Ionicons name="close-circle" size={20} color="#ef4444" />
                      <Text style={styles.detailText}>Tüm kişisel bilgileriniz</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="close-circle" size={20} color="#ef4444" />
                      <Text style={styles.detailText}>Konum geçmişi ve rotalar</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="close-circle" size={20} color="#ef4444" />
                      <Text style={styles.detailText}>Adım sayısı verileri</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="close-circle" size={20} color="#ef4444" />
                      <Text style={styles.detailText}>Gruplar ve paylaşımlar</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="close-circle" size={20} color="#ef4444" />
                      <Text style={styles.detailText}>Abonelik ve ödeme bilgileri</Text>
                    </View>
                  </View>

                  <Text style={styles.noteText}>
                    Bu işlem geri alınamaz. Hesabınızı silmeden önce önemli verilerinizi yedeklediğinizden emin olun.
                  </Text>

                  {/* Action Buttons */}
                  <View style={styles.buttonContainer}>
                    <Pressable
                      style={[styles.button, styles.cancelButton]}
                      onPress={handleBack}
                      android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
                    >
                      <Ionicons name="close" size={18} color="#fff" style={styles.buttonIcon} />
                      <Text style={styles.cancelButtonText}>İptal</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.button, styles.deleteButton]}
                      onPress={handleRequestCode}
                      disabled={loading}
                      android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="trash" size={18} color="#fff" style={styles.buttonIcon} />
                          <Text style={styles.deleteButtonText}>Emin Misin</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  {/* Verification Icon */}
                  <View style={styles.iconContainer}>
                    <View style={[styles.iconCircle, styles.verifyIconCircle]}>
                      <Ionicons name="shield-checkmark" size={48} color="#0EA5E9" />
                    </View>
                  </View>

                  {/* Verification Title */}
                  <Text style={styles.title}>Doğrulama Kodu</Text>
                  <Text style={styles.subtitle}>
                    {email ? `${email} adresine` : phone ? `${phone} numarasına` : 'E-posta adresinize'} gönderilen 6 haneli doğrulama kodunu girin
                  </Text>

                  {/* Code Input */}
                  <View style={styles.codeContainer}>
                    <TextInput
                      style={styles.codeInput}
                      value={code}
                      onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
                      placeholder="000000"
                      placeholderTextColor="#64748b"
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                      selectTextOnFocus
                    />
                  </View>

                  {/* Resend Code */}
                  {countdown > 0 ? (
                    <Text style={styles.resendText}>
                      Yeni kod göndermek için {countdown} saniye bekleyin
                    </Text>
                  ) : (
                    <Pressable onPress={handleResendCode} style={styles.resendButton}>
                      <Text style={styles.resendButtonText}>Kodu Tekrar Gönder</Text>
                    </Pressable>
                  )}

                  {/* Final Warning */}
                  <View style={styles.finalWarningBox}>
                    <Ionicons name="alert-circle" size={20} color="#f59e0b" />
                    <Text style={styles.finalWarningText}>
                      Kod onaylandığında hesabınız ve tüm verileriniz kalıcı olarak silinecektir.
                    </Text>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.buttonContainer}>
                    <Pressable
                      style={[styles.button, styles.cancelButton]}
                      onPress={handleBack}
                      android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
                    >
                      <Ionicons name="arrow-back" size={16} color="#fff" style={styles.buttonIcon} />
                      <Text style={styles.cancelButtonText}>Geri</Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.button,
                        styles.deleteButton,
                        (!code || code.length !== 6) && styles.deleteButtonDisabled,
                      ]}
                      onPress={handleDeleteAccount}
                      disabled={loading || !code || code.length !== 6}
                      android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="trash" size={18} color="#fff" style={styles.buttonIcon} />
                          <Text style={styles.deleteButtonText} numberOfLines={2}>Hesabı Kalıcı Olarak Sil</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </>
              )}
            </Animated.View>
          </ScrollView>

          <Toast
            message={toast.message}
            type={toast.type}
            visible={toast.visible}
            onHide={hideToast}
          />
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 32,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 60,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  verifyIconCircle: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  warningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 8,
    textAlign: 'center',
  },
  warningText: {
    fontSize: 14,
    fontFamily:'Poppins_600SemiBold',
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  detailsContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingRight: 10,
  },
  detailText: {
    fontSize: 14,
    color: '#cbd5e1',
    marginLeft: 10,
    flex: 1,
  },
  noteText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
  warningTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 },
  buttonIcon: { marginRight: 8 },
  codeContainer: {
    marginBottom: 24,
  },
  codeInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    borderRadius: 16,
    padding: 20,
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 8,
  },
  resendText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  resendButton: {
    paddingVertical: 12,
    marginBottom: 24,
  },
  resendButtonText: {
    fontSize: 15,
    color: '#0EA5E9',
    textAlign: 'center',
    fontWeight: '600',
  },
  finalWarningBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  finalWarningText: {
    fontSize: 14,
    color: '#fbbf24',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
    paddingBottom: 20,
  },
  button: {
    flex: 1,
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    flexShrink: 1,
  },
});

