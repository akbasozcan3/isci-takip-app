import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React from 'react';
import { Animated, Easing, Keyboard, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BrandLogo } from '../../components/BrandLogo';
import { useMessage } from '../../components/MessageProvider';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import theme from '../../components/ui/theme';

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

  const fade = React.useRef(new Animated.Value(0)).current;
  const translate = React.useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [fade, translate]);

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

    // Do not handle email verification here. Redirect to verify-email screen
    // with form data. That screen will send/verify the pre-email code and
    // complete the registration using the pre_token.
    setLoading(true);
    try {
      router.push({
        pathname: '/auth/verify-email' as any,
        params: { email, phone, name, password, username, mode: 'php' },
      } as any);
    } finally {
      setLoading(false);
    }
  };

  // No inline pre-email verification here; handled in verify-email screen.

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
              <Text style={styles.title}>Kayıt Ol</Text>
              <Text style={styles.subtitle}>Hesabınızı oluşturalım</Text>
            </View>
            <Input
              ref={emailRef}
              label="Email"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              placeholder="ornek@mail.com"
              returnKeyType={'next'}
              onFocus={() => { /* first field */ }}
              onSubmitEditing={() => phoneRef.current?.focus()}
              error={emailError}
              leftElement={<Ionicons name="mail-outline" size={18} color={theme.colors.textMuted} />}
            />
            <Input
              ref={phoneRef}
              label="Telefon (opsiyonel)"
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
              leftElement={<Ionicons name="call-outline" size={18} color={theme.colors.textMuted} />}
            />
            <Input
              ref={nameRef}
              label="Ad"
              value={name}
              onChangeText={setName}
              placeholder="Adınız"
              autoCorrect={false}
              returnKeyType="next"
              onFocus={() => { /* mid field */ }}
              onSubmitEditing={() => usernameRef.current?.focus()}
              error={nameError}
              leftElement={<Ionicons name="person-outline" size={18} color={theme.colors.textMuted} />}
            />
            <Input
              ref={usernameRef}
              label="Kullanıcı Adı (opsiyonel)"
              value={username}
              onChangeText={setUsername}
              placeholder="Görünen adınız"
              autoCorrect={false}
              returnKeyType="next"
              onFocus={() => { /* mid field */ }}
              onSubmitEditing={() => passRef.current?.focus()}
              error={usernameError}
              leftElement={<Ionicons name="at-outline" size={18} color={theme.colors.textMuted} />}
            />
            <Input
              ref={passRef}
              label="Şifre"
              secureTextEntry
              textContentType="password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              returnKeyType="go"
              onFocus={scrollToEndLightly}
              onSubmitEditing={() => confirmRef.current?.focus()}
              error={passwordError}
              leftElement={<Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} />}
            />
            <Input
              ref={confirmRef}
              label="Şifre (Tekrar)"
              secureTextEntry
              textContentType="password"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="••••••••"
              returnKeyType="go"
              onFocus={scrollToEndLightly}
              onSubmitEditing={() => !loading && onSubmit()}
              error={confirmError}
              leftElement={<Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} />}
            />

            <Button title="Kayıt Ol" onPress={onSubmit} loading={loading} />

            <View style={{ flexDirection: 'row', marginTop: 10, justifyContent: 'center' }}>
              <Text style={{ color: '#94a3b8' }}>Zaten hesabın var mı? </Text>
              <Link href={"/auth/login" as any} style={{ color: '#06b6d4', fontWeight: '600' }}>Giriş Yap</Link>
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
    padding: 12,
    justifyContent: 'center',
  },
  header: { alignItems: 'center', marginBottom: 16 },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  subtitle: { color: '#94a3b8', marginTop: 6, marginBottom: 12 },
});
