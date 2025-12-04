import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { BrandLogo } from '../../components/BrandLogo';
import { Toast, useToast } from '../../components/Toast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AnalyticsEvents, logEvent, setUserId } from '../../utils/analytics';
import { getApiBase } from '../../utils/api';
import { saveToken } from '../../utils/auth';
import { setOneSignalExternalUserId } from '../../utils/onesignal';

export default function LoginScreen() {
  const router = useRouter();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
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

      // Response parsing with error handling
      let data: any = {};
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error('Response parse error:', parseError);
        showError('Sunucu yanıtı işlenemedi. Lütfen tekrar deneyin.');
        return;
      }

      if (!response.ok) {
        if (data.requiresVerification) {
          showError('E-posta doğrulanmamış. Lütfen önce e-postanızı doğrulayın.');
          setTimeout(() => {
            router.push(`/auth/verify-email?email=${encodeURIComponent(email.trim())}`);
          }, 1000);
        } else {
          // E-posta kayıtlı değil kontrolü
          if (data.error && data.error.includes('kayıtlı bir hesap bulunamadı')) {
            showError('Bu e-posta adresi ile kayıtlı bir hesap bulunamadı. Kayıt olmak için "Kayıt Ol" butonunu kullanabilirsiniz.');
          } else {
            showError(data.error || 'Giriş başarısız. E-posta veya şifrenizi kontrol edin.');
          }
        }
        return;
      }

      if (data.token && data.user) {
        await saveToken(data.token);
        
        try {
          if (data.user.id) {
            await SecureStore.setItemAsync('workerId', String(data.user.id));
            setOneSignalExternalUserId(String(data.user.id));
            setUserId(String(data.user.id));
            logEvent(AnalyticsEvents.LOGIN, {
              method: 'email',
              user_id: data.user.id,
            });
            
            // Set OneSignal segments
            const { updateUserSegments } = await import('../../utils/onesignal');
            const { markUserActive, updateSubscriptionSegment } = await import('../../utils/onesignalSegments');
            
            updateUserSegments({
              segment: 'active',
              role: data.user.role || 'user',
              subscription: data.user.subscription?.planId || 'free',
              lastActive: new Date().toISOString(),
            });
            
            markUserActive();
            if (data.user.subscription?.planId) {
              updateSubscriptionSegment(data.user.subscription.planId as 'free' | 'plus' | 'business');
            }
          }
          if (data.user.displayName || data.user.name) {
            await SecureStore.setItemAsync('displayName', data.user.displayName || data.user.name);
          }
          if (data.user.email) {
            await SecureStore.setItemAsync('userEmail', data.user.email);
          }
        } catch (storeError) {
        }
        
        showSuccess('Giriş başarılı! Yönlendiriliyorsunuz...');
        
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 500);
      } else {
        showError('Giriş başarısız. Lütfen tekrar deneyin.');
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
        <View style={styles.decorativeCircle1} />
        <View style={styles.decorativeCircle2} />
        <View style={styles.decorativeCircle3} />

        <View style={styles.content}>
          <Animated.View 
            style={[
              styles.header,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            <View style={styles.logoWrapper}>
              <BrandLogo size={250} withSoftContainer={false} variant="default" />
            </View>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Hoş Geldiniz</Text>
              <Text style={styles.subtitle}>
                Bavaxe sistemine giriş yapın
              </Text>
            </View>
          </Animated.View>
          <Animated.View 
            style={[
              styles.form,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
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
            <Button
              title="Giriş Yap"
              onPress={handleLogin}
              loading={loading}
              style={styles.loginButton}
            />

            <View style={styles.footer}>
              <Text style={styles.footerText}>Hesabınız yok Mu? </Text>
              <TouchableOpacity onPress={() => router.push('/auth/register')}>
                <Text style={styles.footerLink}>Kayıt Olun</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.footer, { marginTop: 8 }]}> 
              <TouchableOpacity onPress={() => router.push('/auth/reset-password' as any)}>
                <Text style={[styles.footerLink, { color: '#f59e0b' }]}>Şifremi Unuttum</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
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
  decorativeCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    top: -100,
    right: -100,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    bottom: -50,
    left: -50,
  },
  decorativeCircle3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
    top: '40%',
    right: -30,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20
  },
  header: {
    alignItems: 'center',
    marginBottom: 0,
    width: '100%',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 0
  },
  titleContainer: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 4,
    letterSpacing: 0.5,
    textAlign: 'center',
    fontFamily: 'Poppins-Bold',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
    fontWeight: '500',
    fontFamily: 'Poppins-Regular',
  },
  form: {
    width: '100%',
  },
  input: {
    marginBottom: 10,
  },
  loginButton: {
    marginTop: 4,
    marginBottom: 0,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    flexWrap: 'wrap',
    width: '100%',
  },
  footerText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'Poppins-Regular',
  },
  footerLink: {
    color: '#60a5fa',
    fontFamily: 'Poppins-SemiBold',
  },
});

