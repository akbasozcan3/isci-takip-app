import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
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
  View,
} from 'react-native';
import { AnimatedBubbles } from '../../components/AnimatedBubbles';
import { AuthHeader } from '../../components/AuthHeader';
import { Toast, useToast } from '../../components/Toast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { getApiBase } from '../../utils/api';

export default function RegisterScreen() {
  const router = useRouter();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const [step, setStep] = useState<'email' | 'verify' | 'register'>('email');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  
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

  const handleSendVerificationCode = async () => {
    if (!email.trim()) {
      showError('Lütfen e-posta adresinizi girin');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showError('Geçerli bir e-posta adresi girin');
      return;
    }

    setSendingCode(true);
    try {
      // Backend'e kod isteği gönder
      const apiBase = getApiBase();
      const url = `${apiBase}/api/auth/pre-verify-email`;
      
      // Timeout controller (10 saniye)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const checkResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const rawText = await checkResponse.text();
      let checkData: any = {};
      try { checkData = rawText ? JSON.parse(rawText) : {}; } catch (_) { checkData = { rawText }; }

      if (!checkResponse.ok) {
        // E-posta zaten kayıtlı kontrolü
        if (checkData.error && checkData.error.includes('zaten kayıtlı')) {
          showError('Bu e-posta adresi zaten kayıtlıdır. Giriş yapmak için "Giriş Yap" butonunu kullanabilirsiniz.');
        } else {
          showError(checkData.error || 'E-posta gönderilemedi');
        }
        return;
      }

      // Backend otomatik olarak Python servisi ile email gönderir
      setCodeSent(true);
      setStep('verify');
      showSuccess('Kod gönderildi. Lütfen e-posta gelen kutunu ve Spam klasörünü kontrol et.');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        showError('İstek zaman aşımına uğradı. Backend çalışıyor mu kontrol edin.');
      } else if (error.message?.includes('Network request failed')) {
        showError('Backend bağlantısı kurulamadı. PM2 ile backend başlatın: pm2 start');
      } else {
        showError('Bağlantı hatası: ' + (error.message || 'Bilinmeyen hata'));
      }
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      showError('Lütfen 6 haneli doğrulama kodunu girin');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/api/auth/pre-verify-email/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: verificationCode.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showError(data.error || 'Geçersiz doğrulama kodu');
        return;
      }

      showSuccess('E-posta doğrulandı!');
      setStep('register');
    } catch (error) {
      showError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!password.trim() || !confirmPassword.trim() || !displayName.trim()) {
      showError('Lütfen tüm alanları doldurun');
      return;
    }

    if (displayName.trim().length < 2) {
      showError('Ad Soyad en az 2 karakter olmalıdır');
      return;
    }

    if (password.length < 6) {
      showError('Şifre en az 6 karakter olmalıdır');
      return;
    }

    if (password !== confirmPassword) {
      showError('Şifreler eşleşmiyor');
      return;
    }

    if (!verificationCode.trim() || verificationCode.length !== 6) {
      showError('Lütfen doğrulama kodunu girin');
      return;
    }

    setLoading(true);
    try {
      const apiBase = getApiBase();
      const url = `${apiBase}/api/auth/register`;
      
      // Timeout controller (15 saniye)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
          verificationCode: verificationCode.trim(),
        }),
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
        // E-posta zaten kayıtlı kontrolü
        if (data.error && data.error.includes('zaten kayıtlı')) {
          showError('Bu e-posta adresi zaten kayıtlıdır. Giriş yapmak için "Giriş Yap" sayfasına gidebilirsiniz.');
        } else if (data.error && data.error.includes('doğrulama kodu')) {
          showError('Doğrulama kodu geçersiz veya süresi dolmuş. Lütfen yeni kod alın.');
          setStep('verify');
        } else {
          showError(data.error || 'Kayıt başarısız. Lütfen bilgilerinizi kontrol edin.');
        }
        return;
      }

      // Kayıt başarılı - giriş sayfasına yönlendir
      showSuccess('Kayıt başarılı! Şimdi giriş yapabilirsiniz 🎉');
      
      setTimeout(() => {
        router.replace('/auth/login');
      }, 1500);
    } catch (error: any) {
      console.error('Register error:', error);
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
        <AnimatedBubbles />
        <View style={styles.decorativeCircle1} />
        <View style={styles.decorativeCircle2} />
        <View style={styles.decorativeCircle3} />

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.content}>
            <AuthHeader
              activeTab="register"
              onTabChange={(tab: 'login' | 'register') => {
                if (tab === 'login') {
                  router.push('/auth/login');
                }
              }}
              title={
                step === 'email' ? 'Kayıt Ol' :
                step === 'verify' ? 'E-posta Doğrula' :
                'Hesap Bilgileri'
              }
              subtitle={
                step === 'email' ? 'Bavaxe hesabınızı oluşturmak için e-posta adresinizi girin' :
                step === 'verify' ? 'E-posta adresinize gönderilen 6 haneli kodu girin' :
                'Son adım! Hesap bilgilerinizi tamamlayın'
              }
            />

          <Animated.View 
            style={[
              styles.form,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            {step === 'email' && (
              <>
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

                <Button
                  title={sendingCode ? 'Gönderiliyor...' : 'Doğrulama Kodu Gönder'}
                  onPress={handleSendVerificationCode}
                  loading={sendingCode}
                  style={styles.loginButton}
                />
              </>
            )}

            {step === 'verify' && (
              <>
                <View style={styles.emailInfo}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="mail" size={18} color="#94a3b8" />
                  </View>
                  <Text style={styles.emailText}>{email}</Text>
                </View>
                <Input
                  label="Doğrulama Kodu"
                  placeholder="******"
                  value={verificationCode}
                  onChangeText={(text) => setVerificationCode(text.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={6}
                  leftElement={
                    <View style={styles.iconCircle2}>
                      <Ionicons name="keypad-outline" size={16} color="#94a3b8" />
                    </View>
                  }
                  style={styles.input}
                />

                <Button
                  title="Kodu Doğrula"
                  onPress={handleVerifyCode}
                  loading={loading}
                  style={styles.loginButton}
                />

                <TouchableOpacity
                  onPress={() => {
                    setStep('email');
                    setVerificationCode('');
                    setCodeSent(false);
                  }}
                  style={styles.forgotPasswordButton}
                  activeOpacity={0.7}
                >
                  <View style={styles.forgotPasswordContent}>
                    <Ionicons name="arrow-back" size={16} color="#f59e0b" />
                    <Text style={styles.forgotPasswordText}>E-posta Değiştir</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            {step === 'register' && (
              <>
                <Input
                  label="Ad Soyad"
                  placeholder="Adınız Soyadınız"
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                  leftElement={
                    <View style={styles.iconCircle}>
                      <Ionicons name="person-outline" size={16} color="#94a3b8" />
                    </View>
                  }
                  style={styles.input}
                />

                <Input
                  label="Şifre"
                  placeholder="En az 6 karakter"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password-new"
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

                <Input
                  label="Şifre Tekrar"
                  placeholder="Şifrenizi tekrar girin"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password-new"
                  leftElement={
                    <View style={styles.iconCircle}>
                      <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" />
                    </View>
                  }
                  style={styles.input}
                />

                <Button
                  title="Kayıt Ol"
                  onPress={handleRegister}
                  loading={loading}
                  style={styles.loginButton}
                />

                <TouchableOpacity
                  onPress={() => setStep('verify')}
                  style={styles.forgotPasswordButton}
                  activeOpacity={0.7}
                >
                  <View style={styles.forgotPasswordContent}>
                    <Ionicons name="arrow-back" size={16} color="#f59e0b" />
                    <Text style={styles.forgotPasswordText}>Geri</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 8 : 4,
    paddingHorizontal: 24,
    paddingBottom: 24
  },
  form: {
    width: '100%',
    marginTop: 8,
  },
  input: {
    marginBottom: 16,
  },
  loginButton: {
    marginTop: 8,
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
  iconCircle2: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  forgotPasswordButton: {
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    alignSelf: 'center',
    width: '100%',
  },
  forgotPasswordContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  forgotPasswordText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 0.3,
  },
  emailInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    padding: 8,
    borderRadius: 12,
    marginBottom: 10,
  },
  emailText: {
    color: '#cbd5e1',
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '500',
    fontFamily: 'Poppins-Medium',
  },
});
