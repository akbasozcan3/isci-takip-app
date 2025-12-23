import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
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

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Google Sign-In Request
  const redirectUri = makeRedirectUri({
    scheme: 'bavaxe',
    useProxy: false  // Development build için proxy kullanma - direkt Google
  });

  console.log('🔍 Google OAuth Redirect URI:', redirectUri);

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: '984232035409-7dauhh2jakbrf56abhooq7si1ukdp8t9o.apps.googleusercontent.com',
    androidClientId: '984232035409-qi843tamturicj7po9mn7d4035f5gphd.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
    responseType: 'id_token', // Important for getting user info
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleLogin(id_token);
    } else if (response?.type === 'error') {
      showError('Google girişi başarısız oldu.');
    }
  }, [response]);

  const handleGoogleLogin = async (idToken: string) => {
    if (!idToken) {
      showError('Google giriş token\'ı alınamadı');
      return;
    }

    setLoading(true);

    try {
      console.log('[Google Login] Frontend-only authentication started...');

      // Decode ID token to get user info (basic JWT decode)
      const base64Url = idToken.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      const payload = JSON.parse(jsonPayload);
      const { email, name, sub: googleId, picture } = payload;

      if (!email) {
        showError('Google hesabından email alınamadı');
        return;
      }

      console.log('[Google Login] User info retrieved:', { email, name, googleId });

      // ✅ CHECK: Email SMTP ile kayıtlı mı?
      try {
        const apiBase = getApiBase();
        console.log('[Google Login] Checking if email is registered with SMTP...');

        const checkResponse = await fetch(`${apiBase}/api/auth/check-email-registration`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.toLowerCase().trim() })
        });

        if (!checkResponse.ok) {
          console.warn('[Google Login] Email check failed, proceeding anyway');
        } else {
          const checkData = await checkResponse.json();

          if (checkData.data?.exists && checkData.data?.registeredWithSMTP) {
            console.log('[Google Login] Email is registered with SMTP, blocking Google login');
            showError('Bu e-posta adresi zaten kayıtlı. Lütfen e-posta ve şifre ile giriş yapın.');
            setLoading(false);
            return;
          }

          console.log('[Google Login] Email check passed:', checkData.data);
        }
      } catch (checkError) {
        console.error('[Google Login] Email check error:', checkError);
        // Non-critical error, continue with login
        console.warn('[Google Login] Proceeding despite email check failure');
      }

      // Create mock user data for development
      const mockUserId = googleId; // Use Google ID as user ID
      const mockToken = idToken; // Use Google ID token as app token

      // Save token
      await saveToken(mockToken);

      // Save user data
      await SecureStore.setItemAsync('workerId', mockUserId);
      await SecureStore.setItemAsync('userEmail', email);
      await SecureStore.setItemAsync('displayName', name || email.split('@')[0]);
      await SecureStore.setItemAsync('loginMethod', 'google'); // Mark as Google user
      await SecureStore.setItemAsync('googleIdToken', idToken); // Save Google ID token

      if (picture) {
        await SecureStore.setItemAsync('avatarUrl', picture);
      }

      // Set context
      setUserId(mockUserId);

      // Analytics
      logEvent(AnalyticsEvents.LOGIN, {
        method: 'google',
        user_id: mockUserId,
      });

      // OneSignal (optional)
      try {
        await setOneSignalExternalUserId(mockUserId);

        const { updateUserSegments, markUserActive } = await import('../../utils/onesignal');
        updateUserSegments({
          segment: 'active',
          role: 'user',
          subscription: 'free',
          lastActive: new Date().toISOString(),
        });
        markUserActive();
      } catch (onesignalError) {
        console.warn('[Google Login] OneSignal error (non-critical):', onesignalError);
      }

      showSuccess(`Hoş geldiniz, ${name || 'Kullanıcı'}!`);
      console.log('[Google Login] Login complete, redirecting...');
      setTimeout(() => router.replace('/(tabs)'), 500);

    } catch (error: any) {
      console.error('[Google Login] Error:', error);
      showError('Google girişi sırasında bir hata oluştu. Lütfen tekrar deneyin.');
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
                  style={styles.googleButton}
                  onPress={() => promptAsync()}
                  disabled={loading}
                >
                  {loading && !password ? (
                    <Text style={styles.googleButtonText}>Yükleniyor...</Text>
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

