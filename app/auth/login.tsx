import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BrandLogo } from '../../components/BrandLogo';
import { useMessage } from '../../components/MessageProvider';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import theme from '../../components/ui/theme';
import { getApiBase } from '../../utils/api';
import { saveToken } from '../../utils/auth'; // senin util'in zaten varsa bırak
import { mapApiError } from '../../utils/errorMap';

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

  const fade = React.useRef(new Animated.Value(0)).current;
  const translate = React.useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [fade, translate]);

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
      const form = new URLSearchParams();
      // Backend login endpoint'in username parametresi bekliyorsa bırak; e-posta yazıldıysa de aynısı çalışır.
      form.append('username', identifier.trim());
      form.append('password', password);

      const res = await fetch(`${getApiBase()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
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
          message.show({ type: 'warning', title: '⚠️ E-posta Doğrulanmadı', description: 'Hesabınızı kullanabilmek için önce e-posta adresinizi doğrulamanız gerekiyor.' });
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={(r) => { scrollRef.current = r; }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: kbShown ? 32 : 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.container, { opacity: fade, transform: [{ translateY: translate }] }]}> 
            <View style={styles.header}>
              <BrandLogo size={72} />
              <Text style={styles.title}>Giriş Yap</Text>
              <Text style={styles.subtitle}>Email veya Kullanıcı Adı ile giriş yapın</Text>
            </View>

            <Input
              ref={emailRef}
              label="Email veya Kullanıcı Adı"
              autoCapitalize="none"
              autoCorrect={false}
              value={identifier}
              onChangeText={(t) => setIdentifier(t)}
              placeholder="E-posta veya Kullanıcı Adı"
              returnKeyType="next"
              onFocus={() => { /* first field, no-op */ }}
              onSubmitEditing={() => passRef.current?.focus()}
              error={identifierError}
              leftElement={<Ionicons name="person-outline" size={18} color={theme.colors.textMuted} />}
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
              leftElement={<Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} />}
              rightElement={
                <TouchableOpacity onPress={() => setShowPassword((s) => !s)} accessibilityLabel={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}>
                  <Text style={{ color: '#06b6d4', fontWeight: '600', marginRight: 8 }}>{showPassword ? 'Gizle' : 'Göster'}</Text>
                </TouchableOpacity>
              }
            />

            <View style={styles.rowBetween}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Switch
                  value={rememberMe}
                  onValueChange={setRememberMe}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor={rememberMe ? theme.colors.primaryDark : theme.colors.white}
                  ios_backgroundColor={theme.colors.border}
                />
                <Text style={{ color: '#94a3b8', marginLeft: 8 }}>Beni Hatırla</Text>
              </View>

              <Link href={"/auth/forgot" as any} style={{ color: '#06b6d4', fontWeight: '600' }}>
                Şifremi Unuttum?
              </Link>
            </View>

            <Button title="Giriş" onPress={onSubmit} loading={loading} disabled={loading} accessibilityLabel="Giriş yap" />

            <View style={{ flexDirection: 'row', marginTop: 10, justifyContent: 'center' }}>
              <Text style={{ color: '#94a3b8' }}>Hesabın yok mu? </Text>
              <Link href={"/auth/register" as any} style={{ color: '#06b6d4', fontWeight: '600' }}>
                Kayıt Ol
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
    padding: 24,
    justifyContent: 'center',
  },
  header: { alignItems: 'center', marginBottom: 16 },
  title: { color: 'white', fontSize: 28, fontWeight: '800', marginTop: 8 },
  subtitle: { color: '#94a3b8', marginTop: 6, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
});
