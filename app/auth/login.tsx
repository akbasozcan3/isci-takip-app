import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { BrandLogo } from '../../components/BrandLogo';
import { Toast, useToast } from '../../components/Toast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { getApiBase } from '../../utils/api';
import { saveToken } from '../../utils/auth';

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
    if (!email.trim() || !password.trim()) {
      showError('Lütfen tüm alanları doldurun');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.requiresVerification) {
          showError('E-posta doğrulanmamış. Lütfen önce e-postanızı doğrulayın.');
          router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`);
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
        // Token'ı kaydet
        await saveToken(data.token);
        
        // Kullanıcı bilgilerini kaydet (kalıcı oturum için)
        if (data.user.id) {
          await SecureStore.setItemAsync('workerId', data.user.id);
        }
        if (data.user.displayName || data.user.name) {
          await SecureStore.setItemAsync('displayName', data.user.displayName || data.user.name);
        }
        if (data.user.email) {
          await SecureStore.setItemAsync('userEmail', data.user.email);
        }
        
        showSuccess('Giriş başarılı!');
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Login error:', error);
      showError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <LinearGradient
        colors={['#0a0f1a', '#1a1f2e', '#2a2f3e']}
        style={styles.gradient}
      >
        {/* Decorative background elements */}
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
              <BrandLogo size={280} withSoftContainer={false} variant="default" />
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
                  <Ionicons name="mail-outline" size={16}  color="#64748b" />
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
                  <Ionicons name="lock-closed-outline" size={16} color="#64748b" />
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
                    color="#64748b"
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
    padding: 20,
    top:-50
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  logoWrapper: {
    top:100,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
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
    width: 30,
    height: 30,
    left: -4,
    marginTop: -12,
    borderRadius: 15,
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '600',
    textDecorationLine: 'underline',
    fontFamily: 'Poppins-SemiBold',
  },
});

