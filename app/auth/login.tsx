import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { AuthHeader } from '../../components/AuthHeader';
import { PremiumBackground } from '../../components/PremiumBackground';
import { Toast, useToast } from '../../components/Toast';
import { Button } from '../../components/ui/Button/index';
import { Input } from '../../components/ui/Input/index';
import { AnalyticsEvents, logEvent, setUserId } from '../../utils/analytics';
import { getApiBase } from '../../utils/api';
import { saveToken } from '../../utils/auth';
import { setOneSignalExternalUserId } from '../../utils/onesignal';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Google OAuth Configuration from environment
  const googleConfig = {
    expoClientId: Constants.expoConfig?.extra?.googleExpoClientId ||
      '984232035409-7dauhh2jakbrf56abhooq7si1ukdp8t9o.apps.googleusercontent.com',
    iosClientId: Constants.expoConfig?.extra?.googleIosClientId ||
      '984232035409-7dauhh2jakbrf56abhooq7si1ukdp8t9o.apps.googleusercontent.com',
    androidClientId: Constants.expoConfig?.extra?.googleAndroidClientId ||
      '984232035409-qi843tamturicj7po9mn7d4035f5gphd.apps.googleusercontent.com',
    webClientId: Constants.expoConfig?.extra?.googleWebClientId,
  };

  const redirectUri = makeRedirectUri({
    scheme: 'bavaxe',
    path: 'auth/callback',
  });

  console.log('🔍 [Google OAuth] Configuration:', {
    redirectUri,
    platform: Platform.OS,
    expoClientId: googleConfig.expoClientId?.substring(0, 20) + '...',
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    ...googleConfig,
    scopes: ['profile', 'email'],
    responseType: 'id_token',
    redirectUri,
  });

  // Log when request is ready
  useEffect(() => {
    if (request) {
      console.log('✅ [Google OAuth] Request ready');
    }
  }, [request]);

  // Handle OAuth response
  useEffect(() => {
    if (!response) return;

    setGoogleLoading(false);

    console.log('📥 [Google OAuth] Response:', {
      type: response.type,
      hasIdToken: !!response.params?.id_token,
    });

    if (response.type === 'success') {
      const { id_token } = response.params;
      if (id_token) {
        handleGoogleLogin(id_token);
      } else {
        showError('Google token alınamadı. Lütfen tekrar deneyin.');
        console.error('❌ [Google OAuth] No ID token in response:', response);
      }
    } else if (response.type === 'error') {
      const errorMsg = response.error?.message || 'Google girişi başarısız oldu.';
      showError(errorMsg);
      console.error('❌ [Google OAuth] Error:', response.error);
    } else if (response.type === 'cancel') {
      console.log('⚠️ [Google OAuth] User cancelled');
    } else if (response.type === 'dismiss') {
      console.log('⚠️ [Google OAuth] Modal dismissed');
    }
  }, [response]);

  const handleGoogleLogin = async (idToken: string) => {
    if (!idToken) {
      showError('Google giriş token\'ı alınamadı');
      return;
    }

    setLoading(true);

    try {
      console.log('[Google Login] Calling backend API...');
      const apiBase = getApiBase();

      const response = await fetch(`${apiBase}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[Google Login] Backend error:', data);

        if (data.error?.includes('EMAIL_ALREADY_REGISTERED') || data.error?.includes('already registered')) {
          showError('Bu e-posta adresi zaten kayıtlı. Lütfen e-posta ve şifre ile giriş yapın.');
        } else if (data.error?.includes('TOKEN_EXPIRED')) {
          showError('Google token süresi doldu. Lütfen tekrar deneyin.');
        } else if (data.error?.includes('INVALID_TOKEN')) {
          showError('Geçersiz Google token. Lütfen tekrar deneyin.');
        } else {
          showError(data.error || 'Google girişi başarısız oldu');
        }
        return;
      }

      const { user, token } = data.data;

      console.log('[Google Login] Login successful:', { userId: user.id, email: user.email });

      // Save token
      await saveToken(token);

      // Save user data
      await SecureStore.setItemAsync('workerId', user.id);
      await SecureStore.setItemAsync('userEmail', user.email);
      await SecureStore.setItemAsync('displayName', user.displayName || user.name || user.email.split('@')[0]);
      await SecureStore.setItemAsync('loginMethod', 'google');

      if (user.avatar) {
        await SecureStore.setItemAsync('avatarUrl', user.avatar);
      }

      // Set context
      setUserId(user.id);

      // Analytics
      logEvent(AnalyticsEvents.LOGIN, {
        method: 'google',
        user_id: user.id,
      });

      // OneSignal (optional)
      try {
        await setOneSignalExternalUserId(user.id);

        const { updateUserSegments, markUserActive } = await import('../../utils/onesignal');
        updateUserSegments({
          segment: 'active',
          role: user.role || 'user',
          subscription: 'free',
          lastActive: new Date().toISOString(),
        });
        markUserActive();
      } catch (onesignalError) {
        console.warn('[Google Login] OneSignal error (non-critical):', onesignalError);
      }

      showSuccess(`Hoş geldiniz, ${user.displayName || user.name || 'Kullanıcı'}!`);
      console.log('[Google Login] Login complete, redirecting...');
      setTimeout(() => router.replace('/(tabs)'), 500);

    } catch (error: any) {
      console.error('[Google Login] Error:', error);
      if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        showError('Backend bağlantısı kurulamadı. Lütfen backend\'in çalıştığından emin olun.');
      } else {
        showError('Google girişi sırasında bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Smooth animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    // Email format validation
    if (!email.trim() || !password.trim()) {
      showError('Lütfen tüm alanları doldurun');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showError('Geçerli bir e-posta adresi girin');
      return;
    }

    if (password.length < 6) {
      showError('Şifre en az 6 karakter olmalıdır');
      return;
    }

    setLoading(true);
    try {
      const apiBase = getApiBase();
      const url = `${apiBase}/api/auth/login`;

      // Timeout controller (15 saniye)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: any = {};
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        showError('Sunucu yanıtı işlenemedi. Lütfen tekrar deneyin.');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        if (data.requiresVerification) {
          showError('E-posta doğrulanmamış. Lütfen önce e-postanızı doğrulayın.');
          setTimeout(() => {
            router.push(`/auth/verify-email?email=${encodeURIComponent(email.trim())}`);
          }, 1000);
        } else if (data.error && data.error.includes('kayıtlı bir hesap bulunamadı')) {
          showError('Bu e-posta adresi ile kayıtlı bir hesap bulunamadı. Kayıt olmak için "Kayıt Ol" butonunu kullanabilirsiniz.');
          setTimeout(() => {
            router.push('/auth/register');
          }, 2000);
        } else if (data.error && (data.error.includes('Geçersiz e-posta veya şifre') || data.error.includes('INVALID_CREDENTIALS'))) {
          showError('E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.');
        } else if (data.error && data.error.includes('EMAIL_NOT_VERIFIED')) {
          showError('E-posta doğrulanmamış. Lütfen önce e-postanızı doğrulayın.');
        } else {
          showError(data.error || 'Giriş başarısız. Lütfen tekrar deneyin.');
        }
        setLoading(false);
        return;
      }

      const userData = data.data?.user || data.user;
      const tokenData = data.data?.token || data.token;

      if (tokenData && userData) {
        await saveToken(tokenData);

        try {
          if (userData?.id) {
            await SecureStore.setItemAsync('workerId', String(userData.id));
            await setOneSignalExternalUserId(String(userData.id));
            setUserId(String(userData.id));
            logEvent(AnalyticsEvents.LOGIN, {
              method: 'email',
              user_id: userData.id,
            });

            try {
              const { getPlayerId, sendPlayerIdToBackend } = await import('../../utils/onesignalHelpers');
              const playerId = await getPlayerId();
              if (playerId) {
                await sendPlayerIdToBackend(playerId, String(userData.id));
              }
            } catch (onesignalError) {
            }

            const { updateUserSegments } = await import('../../utils/onesignal');
            const { markUserActive, updateSubscriptionSegment } = await import('../../utils/onesignalSegments');

            updateUserSegments({
              segment: 'active',
              role: userData.role || 'user',
              subscription: userData.subscription?.planId || 'free',
              lastActive: new Date().toISOString(),
            });

            markUserActive();
            if (userData.subscription?.planId) {
              updateSubscriptionSegment(userData.subscription.planId as 'free' | 'plus' | 'business');
            }
          }
          if (userData?.displayName || userData?.name) {
            await SecureStore.setItemAsync('displayName', userData.displayName || userData.name);
          }
          if (userData?.email) {
            await SecureStore.setItemAsync('userEmail', userData.email);
          }
        } catch (storeError) {
        }

        showSuccess('Giriş başarılı! Yönlendiriliyorsunuz...');

        setTimeout(() => {
          router.replace('/(tabs)');
        }, 500);
      } else {
        showError('Giriş başarısız. Sunucu yanıtı beklenmedik formatta.');
        setLoading(false);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        showError('İstek zaman aşımına uğradı. Backend çalışıyor mu kontrol edin.');
      } else if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        showError('Backend bağlantısı kurulamadı. PM2 ile backend başlatın: npm run start');
      } else {
        showError('Bağlantı hatası. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#334155']}
        style={styles.gradient}
      >
        <StatusBar barStyle="light-content" />
        <PremiumBackground color="#06B6D4" lineCount={8} circleCount={5} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <AuthHeader
              activeTab="login"
              onTabChange={(tab) => {
                if (tab === 'register') {
                  router.push('/auth/register' as any);
                }
              }}
            />
            <Animated.View
              style={[
                styles.formContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                }
              ]}
            >
              <View style={styles.formCard}>
                <Input
                  label="E-posta Adresi"
                  placeholder="ornek@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  leftElement={
                    <View style={styles.iconCircle}>
                      <Ionicons name="mail-outline" size={16} color="#94a3b8" />
                    </View>
                  }
                  style={styles.input}
                />

                <Input
                  label="Şifre"
                  placeholder="Şifrenizi girin"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  leftElement={
                    <View style={styles.iconCircle}>
                      <Ionicons name="lock-closed-outline" size={16} color="#94a3b8" />
                    </View>
                  }
                  rightElement={
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.iconCircle}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={16}
                        color="#94a3b8"
                      />
                    </TouchableOpacity>
                  }
                  style={styles.input}
                />

                <TouchableOpacity
                  onPress={() => router.push('/auth/reset-password' as any)}
                  style={styles.forgotPasswordButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.forgotPasswordText}>Şifremi Unuttum</Text>
                </TouchableOpacity>

                <Button
                  title="Giriş Yap"
                  onPress={handleLogin}
                  loading={loading}
                  style={styles.loginButton}
                />

                <TouchableOpacity
                  style={[
                    styles.googleButton,
                    (loading || googleLoading || !request) && styles.googleButtonDisabled
                  ]}
                  onPress={() => {
                    console.log('🚀 [Google OAuth] Button pressed');
                    setGoogleLoading(true);
                    promptAsync();
                  }}
                  disabled={loading || googleLoading || !request}
                  activeOpacity={0.7}
                >
                  {googleLoading ? (
                    <View style={styles.googleContent}>
                      <ActivityIndicator size="small" color="#0f172a" style={{ marginRight: 10 }} />
                      <Text style={styles.googleButtonText}>Google'a bağlanılıyor...</Text>
                    </View>
                  ) : !request ? (
                    <View style={styles.googleContent}>
                      <ActivityIndicator size="small" color="#0f172a" style={{ marginRight: 10 }} />
                      <Text style={styles.googleButtonText}>Hazırlanıyor...</Text>
                    </View>
                  ) : (
                    <View style={styles.googleContent}>
                      <Ionicons name="logo-google" size={20} color="#0f172a" style={{ marginRight: 10 }} />
                      <Text style={styles.googleButtonText}>Google ile Giriş Yap</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </ScrollView>
        <Toast
          message={toast.message}
          type={toast.type}
          visible={toast.visible}
          onHide={hideToast}
        />
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    position: 'relative',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 8 : 15,
    paddingHorizontal: 24,
    paddingBottom: 24
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 4
  },
  titleContainer: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 4,
    letterSpacing: 0.5,
    textAlign: 'center',
    fontFamily: 'Poppins-Black',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
    fontWeight: '500',
    fontFamily: 'Poppins-Medium',
  },
  form: {
    width: '100%',
    marginTop: 0,
  },
  input: {
    marginBottom: 8,
  },
  loginButton: {
    marginTop: 2,
    marginBottom: 0,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    flexWrap: 'wrap',
    width: '100%',
  },
  footerText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'Poppins-Medium',
  },
  registerButton: {
    marginTop: 8,
    marginBottom: 0,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: 'rgba(96, 165, 250, 0.6)',
    alignSelf: 'center',
    width: '100%',
    overflow: 'hidden',
  },
  registerButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  registerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  registerButtonText: {
    color: '#60a5fa',
    fontSize: 17,
    fontWeight: '800',
    fontFamily: 'Poppins-ExtraBold',
    letterSpacing: 0.5,
  },
  forgotPasswordButton: {
    marginTop: 8,
    marginBottom: 1,
    paddingVertical: 4,
    paddingHorizontal: 0,
    alignSelf: 'flex-start',
  },
  forgotPasswordContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  forgotPasswordText: {
    color: '#06B6D4',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 0.2,
    textAlign: 'left',
  },
  googleButton: {
    marginTop: 16,
    backgroundColor: '#F8FAFC',
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  googleButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
});

