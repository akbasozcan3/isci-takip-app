import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { BrandLogo } from '../../components/BrandLogo';
import { useMessage } from '../../components/MessageProvider';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import theme from '../../components/ui/theme';
import { getApiBase } from '../../utils/api';

const { width, height } = Dimensions.get('window');

const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const usernameRegex = /^[a-z0-9._-]{3,24}$/;
function isValidEmail(v: string): boolean { return emailRegex.test(String(v).toLowerCase()); }
function isValidUsername(v: string): boolean { return usernameRegex.test(String(v).toLowerCase()); }

export default function Register(): React.JSX.Element {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [name, setName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();
  const message = useMessage();
  const scrollRef = React.useRef<ScrollView | null>(null);
  const nameRef = React.useRef<any>(null);
  const emailRef = React.useRef<any>(null);
  const phoneRef = React.useRef<any>(null);
  const passRef = React.useRef<any>(null);
  const confirmRef = React.useRef<any>(null);
  const usernameRef = React.useRef<any>(null);
  const [emailError, setEmailError] = React.useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = React.useState<string | undefined>(undefined);
  const [nameError, setNameError] = React.useState<string | undefined>(undefined);
  const [phoneError, setPhoneError] = React.useState<string | undefined>(undefined);
  const [confirmError, setConfirmError] = React.useState<string | undefined>(undefined);
  const [usernameError, setUsernameError] = React.useState<string | undefined>(undefined);

  // Advanced animations
  const fade = React.useRef(new Animated.Value(0)).current;
  const slideUp = React.useRef(new Animated.Value(50)).current;
  const scale = React.useRef(new Animated.Value(0.9)).current;
  const logoScale = React.useRef(new Animated.Value(0.8)).current;
  const logoRotate = React.useRef(new Animated.Value(0)).current;
  const backgroundOpacity = React.useRef(new Animated.Value(0)).current;
  const formSlide = React.useRef(new Animated.Value(30)).current;

  React.useEffect(() => {
    // Staggered entrance animation
    Animated.sequence([
      // Background fade in
      Animated.timing(backgroundOpacity, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // Logo animation
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]),
      // Form elements
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(slideUp, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(formSlide, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fade, slideUp, scale, logoScale, logoRotate, backgroundOpacity, formSlide]);

  const [kbShown, setKbShown] = React.useState(false);
  React.useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKbShown(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbShown(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const scrollToEndLightly = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

  const onSubmit = async () => {
    // reset field errors
    setEmailError(undefined);
    setPasswordError(undefined);
    setNameError(undefined);
    setPhoneError(undefined);
    setConfirmError(undefined);
    setUsernameError(undefined);

    // client-side validations
    let hasError = false;
    if (!name.trim()) { setNameError('Ad zorunludur'); hasError = true; }
    if (!email.trim()) { setEmailError('Email zorunludur'); hasError = true; }
    if (!password.trim()) { setPasswordError('Şifre zorunludur'); hasError = true; }
    // Telefon opsiyoneldir; girilirse kontrol edilecek

    if (email && !isValidEmail(email)) { setEmailError('Geçersiz email adresi'); hasError = true; }

    if (password && password.length < 8) { setPasswordError('Şifre en az 8 karakter olmalı'); hasError = true; }
    // Güçlü şifre önerisi (uyarı amaçlı): büyük/küçük harf + rakam
    if (password && password.length >= 8) {
      const hasUpper = /[A-Z]/.test(password);
      const hasLower = /[a-z]/.test(password);
      const hasDigit = /\d/.test(password);
      if (!(hasUpper && hasLower && hasDigit)) {
        // Uyarı verme: zorunlu değil, kullanıcıyı bilgilendir.
        // message.show({ type: 'info', title: 'Şifre Güç Önerisi', description: 'Daha güçlü bir şifre için büyük/küçük harf ve rakam kullanın.' });
      }
    }

    if (confirm !== password) { setConfirmError('Şifreler eşleşmiyor'); hasError = true; }

    if (username && !isValidUsername(username)) {
      setUsernameError('Geçersiz kullanıcı adı. 3-24 karakter; a-z, 0-9, . _ -');
      hasError = true;
    }

    const digits = phone.replace(/\D/g, '');
    if (phone && !(digits.length === 10 || (digits.length === 11 && digits.startsWith('0')) || digits.length >= 12)) {
      setPhoneError('Geçersiz telefon numarası'); hasError = true;
    }

    if (hasError) {
      message.show({ type: 'error', title: 'Eksik veya Hatalı Bilgi', description: 'Lütfen alanları kontrol edip tekrar deneyin.' });
      return;
    }

    // Pre-register akışı: kullanıcı hemen oluşturulmaz, önce e‑posta kodu gönderilir
    setLoading(true);
    try {
      // Hız: isteği arka planda gönder, kullanıcıyı anında doğrulama ekranına taşı
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 8000); // 8 sn bekle, sonra iptal
      // fire-and-forget: hata olursa logla, kullanıcıyı bekletme
      fetch(`${getApiBase()}/auth/pre-verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      })
        .then(async (res) => {
          const text = await res.text();
          let data: any = {}; try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
          if (!res.ok) throw new Error(data?.error || data?.message || text || 'Gönderim başarısız');
          if (data?.dev_code) console.log('[register] dev_code', data.dev_code);
        })
        .catch((err) => console.log('[register] send-email-code background error:', err?.message || err));

      message.show({ type: 'success', title: '📧 E-posta Kodu Gönderiliyor', description: 'Doğrulama kodunuz e-posta adresinize gönderildi. Doğrulama ekranına yönlendiriliyorsunuz...' });
      router.push({ pathname: '/auth/verify-email' as any, params: { email, name, password, phone, username, mode: 'pre-register' } } as any);
    } catch (e: any) {
      const raw = e?.message || 'Kayıt sırasında beklenmeyen bir hata';
      // Debug log for investigation
      console.log('[register-otp] error', raw);
      message.show({ type: 'error', title: 'Kayıt Hatası', description: raw });
    } finally {
      setLoading(false);
    }
  };

  // No inline pre-email verification here; handled in verify-email screen.

  const logoRotation = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Animated Background */}
      <Animated.View style={[styles.background, { opacity: backgroundOpacity }]}>
        <View style={styles.gradientOverlay} />
        <View style={styles.decorativeCircle1} />
        <View style={styles.decorativeCircle2} />
        <View style={styles.decorativeCircle3} />
      </Animated.View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={(r) => { scrollRef.current = r; }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <Animated.View style={[styles.header, { 
            opacity: fade, 
            transform: [
              { scale: logoScale },
              { rotate: logoRotation }
            ] 
          }]}>
            <View style={styles.logoContainer}>
              <BrandLogo size={80} />
            </View>
            <Text style={styles.title}>Hesap Oluştur</Text>
            <Text style={styles.subtitle}>Yeni hesabınızı oluşturalım</Text>
          </Animated.View>

          {/* Form Card */}
          <Animated.View style={[
            styles.formCard, 
            { 
              opacity: fade, 
              transform: [
                { translateY: slideUp },
                { scale: scale }
              ] 
            }
          ]}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Kayıt Ol</Text>
              <Text style={styles.formSubtitle}>Bilgilerinizi girin ve başlayın</Text>
            </View>

            <Animated.View style={[
              styles.inputContainer,
              { transform: [{ translateY: formSlide }] }
            ]}>
              <Input
                ref={emailRef}
                label="E-posta Adresi"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                value={email}
                onChangeText={setEmail}
                placeholder="ornek@email.com"
                returnKeyType="next"
                onFocus={() => { /* first field */ }}
                onSubmitEditing={() => phoneRef.current?.focus()}
                error={emailError}
                leftElement={<Ionicons name="mail-outline" size={20} color={theme.colors.textMuted} />}
              />

              <Input
                ref={phoneRef}
                label="Telefon (Opsiyonel)"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                value={phone}
                onChangeText={setPhone}
                placeholder="5XX XXX XX XX"
                returnKeyType="next"
                onFocus={() => { /* mid field */ }}
                onSubmitEditing={() => nameRef.current?.focus()}
                error={phoneError}
                leftElement={<Ionicons name="call-outline" size={20} color={theme.colors.textMuted} />}
              />

              <Input
                ref={nameRef}
                label="Ad Soyad"
                value={name}
                onChangeText={setName}
                placeholder="Adınız Soyadınız"
                autoCorrect={false}
                returnKeyType="next"
                onFocus={() => { /* mid field */ }}
                onSubmitEditing={() => usernameRef.current?.focus()}
                error={nameError}
                leftElement={<Ionicons name="person-outline" size={20} color={theme.colors.textMuted} />}
              />

              <Input
                ref={usernameRef}
                label="Kullanıcı Adı (Opsiyonel)"
                value={username}
                onChangeText={setUsername}
                placeholder="kullanici_adi"
                autoCorrect={false}
                returnKeyType="next"
                onFocus={() => { /* mid field */ }}
                onSubmitEditing={() => passRef.current?.focus()}
                error={usernameError}
                leftElement={<Ionicons name="at-outline" size={20} color={theme.colors.textMuted} />}
              />

              <Input
                ref={passRef}
                label="Şifre"
                secureTextEntry
                textContentType="password"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                returnKeyType="next"
                onFocus={scrollToEndLightly}
                onSubmitEditing={() => confirmRef.current?.focus()}
                error={passwordError}
                leftElement={<Ionicons name="lock-closed-outline" size={20} color={theme.colors.textMuted} />}
              />

              <Input
                ref={confirmRef}
                label="Şifre Tekrar"
                secureTextEntry
                textContentType="password"
                value={confirm}
                onChangeText={setConfirm}
                placeholder="••••••••"
                returnKeyType="go"
                onFocus={scrollToEndLightly}
                onSubmitEditing={() => !loading && onSubmit()}
                error={confirmError}
                leftElement={<Ionicons name="lock-closed-outline" size={20} color={theme.colors.textMuted} />}
              />
            </Animated.View>

            <Button 
              title="Hesap Oluştur" 
              onPress={onSubmit} 
              loading={loading} 
              style={styles.registerButton}
            />

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Zaten hesabın var mı? </Text>
              <Link href={"/auth/login" as any} style={styles.loginLink}>
                <Text style={styles.loginLinkText}>Giriş Yap</Text>
              </Link>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.bg,
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: theme.colors.primary,
    opacity: 0.1,
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: -150,
    left: -150,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: theme.colors.accent,
    opacity: 0.08,
  },
  decorativeCircle3: {
    position: 'absolute',
    top: height * 0.3,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: theme.colors.info,
    opacity: 0.06,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing(6),
    paddingTop: theme.spacing(6),
    paddingBottom: theme.spacing(4),
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing(6),
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing(4),
    ...theme.shadow.lg,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing(2),
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing(6),
    ...theme.shadow.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  formHeader: {
    marginBottom: theme.spacing(6),
    alignItems: 'center',
  },
  formTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing(2),
  },
  formSubtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: theme.spacing(6),
  },
  registerButton: {
    marginBottom: theme.spacing(6),
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  loginLink: {
    padding: theme.spacing(1),
  },
  loginLinkText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
