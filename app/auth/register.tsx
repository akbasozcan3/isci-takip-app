import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BrandLogo } from '../../components/BrandLogo';
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
      console.log('[Register] API_BASE =', apiBase);
      console.log('[Register] POST', url);
      
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
      console.log('[Register] Response', checkResponse.status, checkData);

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
      console.error('Send code error:', error);
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
      console.error('Verify error:', error);
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

    if (password.length < 6) {
      showError('Şifre en az 6 karakter olmalıdır');
      return;
    }

    if (password !== confirmPassword) {
      showError('Şifreler eşleşmiyor');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
          verificationCode: verificationCode.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // E-posta zaten kayıtlı kontrolü
        if (data.error && data.error.includes('zaten kayıtlı')) {
          showError('Bu e-posta adresi zaten kayıtlıdır. Giriş yapmak için "Giriş Yap" sayfasına gidebilirsiniz.');
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
    } catch (error) {
      console.error('Register error:', error);
      showError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const getStepNumber = () => {
    switch (step) {
      case 'email': return 1;
      case 'verify': return 2;
      case 'register': return 3;
      default: return 1;
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
              <Text style={styles.title}>
                {step === 'email' && 'Kayıt Ol'}
                {step === 'verify' && 'E-posta Doğrula'}
                {step === 'register' && 'Hesap Bilgileri'}
              </Text>
              <Text style={styles.subtitle}>
                {step === 'email' && 'Bavaxe hesabınızı oluşturmak için e-posta adresinizi girin'}
                {step === 'verify' && 'E-posta adresinize gönderilen 6 haneli kodu girin'}
                {step === 'register' && 'Son adım! Hesap bilgilerinizi tamamlayın'}
              </Text>
            </View>

            {/* Progress Indicator */}
            <View style={styles.progressContainer}>
              {[1, 2, 3].map((num) => (
                <View key={num} style={styles.progressStep}>
                  <View
                    style={[
                      styles.progressCircle,
                      num <= getStepNumber() && styles.progressCircleActive,
                    ]}
                  >
                    {num < getStepNumber() ? (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    ) : (
                      <Text style={styles.progressNumber}>{num}</Text>
                    )}
                  </View>
                  {num < 3 && (
                    <View
                      style={[
                        styles.progressLine,
                        num < getStepNumber() && styles.progressLineActive,
                      ]}
                    />
                  )}
                </View>
              ))}
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
                      <Ionicons name="mail-outline" size={16}  color="#64748b" />
                    </View>
                  }
                  style={styles.input}
                />

                <Button
                  title={sendingCode ? 'Gönderiliyor...' : 'Doğrulama Kodu Gönder'}
                  onPress={handleSendVerificationCode}
                  loading={sendingCode}
                  style={styles.button}
                />
              </>
            )}

            {step === 'verify' && (
              <>
                <View style={styles.emailInfo}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="mail" size={16} color="#64748b" />
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
                      <Ionicons name="keypad-outline" size={16} color="#64748b" />
                    </View>
                  }
                  style={styles.input}
                />

                <Button
                  title="Kodu Doğrula"
                  onPress={handleVerifyCode}
                  loading={loading}
                  style={styles.button}
                />

                <TouchableOpacity
                  onPress={() => {
                    setStep('email');
                    setVerificationCode('');
                    setCodeSent(false);
                  }}
                  style={styles.backButton}
                >
                  <Text style={styles.backText}><Ionicons name="arrow-back" size={16} color="#94a3b8" /> E-posta değiştir</Text>
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
                      <Ionicons name="person-outline" size={16} color="#64748b" />
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
                      <Ionicons name="lock-closed-outline" size={16} color="#64748b" />
                    </View>
                  }
                  style={styles.input}
                />

                <Button
                  title="Kayıt Ol"
                  onPress={handleRegister}
                  loading={loading}
                  style={styles.button}
                />

                <TouchableOpacity
                  onPress={() => setStep('verify')}
                  style={styles.backButton}
                >
                  <Text style={styles.backText}><Ionicons name="arrow-back" size={16} color="#94a3b8" /> Geri</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {step === 'email' && 'Zaten hesabınız var mı? '}
                {(step === 'verify' || step === 'register') && ''}
              </Text>
              {step === 'email' && (
                <TouchableOpacity onPress={() => router.push('/auth/login')}>
                  <Text style={styles.footerLink}>Giriş Yap</Text>
                </TouchableOpacity>
              )}
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
    marginBottom: 14,
    width: '100%',
  },
  logoWrapper: {
    top:70,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  titleContainer: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
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
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 6,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#475569',
  },
  progressCircleActive: {
    backgroundColor: '#06b6d4',
    borderColor: '#06b6d4',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  progressNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Poppins-Bold',
  },
  progressLine: {
    width: 50,
    height: 2,
    backgroundColor: '#334155',
    marginHorizontal: 6,
    borderRadius: 2,
  },
  progressLineActive: {
    backgroundColor: '#06b6d4',
  },
  form: {
    width: '100%',
  },
  input: {
    marginBottom: 10,
  },
  button: {
    marginTop: 4,
    marginBottom: 0,
  },
  iconCircle2: {
    width: 30,
    height: 30,
    left: -4,
    marginTop: -10,
    borderRadius: 12,
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 30,
    height: 30,
    left: -4,
    marginTop: -10,
    borderRadius: 15,
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
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
  backButton: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 6,
  },
  backText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Poppins-Medium',
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
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
    textDecorationLine: 'underline',
    fontFamily: 'Poppins-SemiBold',
  },
});
