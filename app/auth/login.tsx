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
    TouchableOpacity,
    View
} from 'react-native';
import { BrandLogo } from '../../components/BrandLogo';
import { useMessage } from '../../components/MessageProvider';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import theme from '../../components/ui/theme';
import { getPhpApiBase } from '../../utils/api';
import { saveToken } from '../../utils/auth';
import { mapApiError } from '../../utils/errorMap';

const { width, height } = Dimensions.get('window');

const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function looksLikeEmail(v: string): boolean { return v.includes('@'); }
function isValidEmail(v: string): boolean { return emailRegex.test(String(v).toLowerCase()); }

export default function Login(): React.JSX.Element {
  const [identifier, setIdentifier] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();
  const message = useMessage();
  const scrollRef = React.useRef<ScrollView | null>(null);
  const emailRef = React.useRef<any>(null);
  const passRef = React.useRef<any>(null);

  const [identifierError, setIdentifierError] = React.useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = React.useState<string | undefined>(undefined);

  // Advanced animations
  const fade = React.useRef(new Animated.Value(0)).current;
  const slideUp = React.useRef(new Animated.Value(50)).current;
  const scale = React.useRef(new Animated.Value(0.9)).current;
  const logoScale = React.useRef(new Animated.Value(0.8)).current;
  const logoRotate = React.useRef(new Animated.Value(0)).current;
  const backgroundOpacity = React.useRef(new Animated.Value(0)).current;

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
        Animated.spring(scale, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fade, slideUp, scale, logoScale, logoRotate, backgroundOpacity]);

  // Keep important controls visible when keyboard is open
  const [kbShown, setKbShown] = React.useState(false);
  React.useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKbShown(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbShown(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const scrollToEndLightly = () => {
    // small delay to allow layout to settle
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const validate = () => {
    let ok = true;
    setIdentifierError(undefined);
    setPasswordError(undefined);

    if (!identifier.trim()) {
      setIdentifierError('Email veya kullanıcı adı gerekli.');
      ok = false;
    } else if (looksLikeEmail(identifier) && !isValidEmail(identifier)) {
      setIdentifierError('Geçerli bir e-posta adresi giriniz.');
      ok = false;
    }

    if (!password) {
      setPasswordError('Şifre gerekli.');
      ok = false;
    } else if (password.length < 8) {
      setPasswordError('Şifre en az 8 karakter olmalı.');
      ok = false;
    }

    return ok;
  };

  const onSubmit = async () => {
    if (!validate()) {
      message.show({ type: 'error', title: 'Doğrulama Hatası', description: 'Lütfen formu kontrol edin.' });
      return;
    }

    try {
      setLoading(true);

      // Backend'in beklediği format: önceki kodunla uyumlu olsun diye form-urlencoded kullanıyorum.
      const res = await fetch(`${getPhpApiBase()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: identifier.trim(), password }),
      });

      const text = await res.text();
      // Sunucu JSON döndürüyor mu kontrolü
      let parsed;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }

      if (!res.ok) {
        const rawMsg = parsed?.message || parsed?.error || text || 'Giriş başarısız.';
        if (res.status === 403) {
          const emailId = looksLikeEmail(identifier) ? identifier.trim() : '';
          message.show({ type: 'error', title: '⚠️ E-posta Doğrulanmadı', description: 'Hesabınızı kullanabilmek için önce e-posta adresinizi doğrulamanız gerekiyor.' });
          if (emailId) {
            setTimeout(() => {
              router.push({ pathname: '/auth/verify-email' as any, params: { email: emailId, mode: 'post-register' } } as any);
            }, 1500);
          }
          return;
        }
        if (res.status === 400 || res.status === 401) {
          throw new Error(mapApiError(rawMsg));
        }
        throw new Error(mapApiError(rawMsg));
      }

      const data = parsed || {};
      const token = data.access_token || data.token;
      if (!token) throw new Error('Sunucudan access token alınamadı.');

      // saveToken: senin utils/auth içerisindeki fonksiyon. 
      // Eğer "rememberMe" seçildiyse secure store'a kaydet vs. (aşağıda notlar var)
      await saveToken(token); // <-- proje-özgü: saveToken implementasyonunu kullan

      message.show({ type: 'success', title: 'Giriş Başarılı', description: 'Yönlendiriliyorsunuz...' });

      // yönlendirme: ana sayfa / dashboard veya istenen route
      router.replace('/' as any);
    } catch (err: any) {
      message.show({ type: 'error', title: 'Giriş Hatası', description: mapApiError(err?.message) });
    } finally {
      setLoading(false);
    }
  };

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
            <Text style={styles.title}>Hoş Geldiniz</Text>
            <Text style={styles.subtitle}>Hesabınıza giriş yapın</Text>
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
              <Text style={styles.formTitle}>Giriş Yap</Text>
              <Text style={styles.formSubtitle}>E-posta veya kullanıcı adınızla devam edin</Text>
            </View>

            <View style={styles.inputContainer}>
              <Input
                ref={emailRef}
                label="E-posta veya Kullanıcı Adı"
                autoCapitalize="none"
                autoCorrect={false}
                value={identifier}
                onChangeText={(t) => setIdentifier(t)}
                placeholder="ornek@email.com"
                returnKeyType="next"
                onFocus={() => { /* first field, no-op */ }}
                onSubmitEditing={() => passRef.current?.focus()}
                error={identifierError}
                leftElement={<Ionicons name="person-outline" size={20} color={theme.colors.textMuted} />}
              />

              <Input
                ref={passRef}
                label="Şifre"
                secureTextEntry={!showPassword}
                textContentType="password"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                returnKeyType="go"
                onFocus={scrollToEndLightly}
                onSubmitEditing={() => !loading && onSubmit()}
                error={passwordError}
                leftElement={<Ionicons name="lock-closed-outline" size={20} color={theme.colors.textMuted} />}
                rightElement={
                  <TouchableOpacity 
                    onPress={() => setShowPassword((s) => !s)} 
                    style={styles.passwordToggle}
                    accessibilityLabel={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  >
                    <Ionicons 
                      name={showPassword ? "eye-off-outline" : "eye-outline"} 
                      size={20} 
                      color={theme.colors.primary} 
                    />
                  </TouchableOpacity>
                }
              />
            </View>

            <View style={styles.optionsContainer}>
              <TouchableOpacity 
                style={styles.rememberMeContainer}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                  {rememberMe && <Ionicons name="checkmark" size={16} color={theme.colors.white} />}
                </View>
                <Text style={styles.rememberMeText}>Beni Hatırla</Text>
              </TouchableOpacity>

              <Link href={"/auth/forgot" as any} style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Şifremi Unuttum?</Text>
              </Link>
            </View>

            <Button 
              title="Giriş Yap" 
              onPress={onSubmit} 
              loading={loading} 
              disabled={loading} 
              style={styles.loginButton}
              accessibilityLabel="Giriş yap" 
            />

            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Hesabın yok mu? </Text>
              <Link href={"/auth/register" as any} style={styles.signupLink}>
                <Text style={styles.signupLinkText}>Kayıt Ol</Text>
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
    paddingTop: theme.spacing(8),
    paddingBottom: theme.spacing(4),
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing(8),
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
    marginTop: theme.spacing(-5),
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
  passwordToggle: {
    padding: theme.spacing(2),
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(6),
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: theme.radius.xs,
    borderWidth: 2,
    borderColor: theme.colors.border,
    marginRight: theme.spacing(2),
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  rememberMeText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
  },
  forgotPassword: {
    padding: theme.spacing(1),
  },
  forgotPasswordText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  loginButton: {
    marginBottom: theme.spacing(6),
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  signupLink: {
    padding: theme.spacing(1),
  },
  signupLinkText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
