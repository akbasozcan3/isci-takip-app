import { Link, useRouter } from 'expo-router';
import React from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { BrandLogo } from '../../components/BrandLogo';
import { useMessage } from '../../components/MessageProvider';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function Register(): React.JSX.Element {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();
  const message = useMessage();
  const nameRef = React.useRef<any>(null);
  const emailRef = React.useRef<any>(null);
  const phoneRef = React.useRef<any>(null);
  const passRef = React.useRef<any>(null);
  const [emailError, setEmailError] = React.useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = React.useState<string | undefined>(undefined);
  const [nameError, setNameError] = React.useState<string | undefined>(undefined);
  const [phoneError, setPhoneError] = React.useState<string | undefined>(undefined);

  const fade = React.useRef(new Animated.Value(0)).current;
  const translate = React.useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [fade, translate]);

  const onSubmit = async () => {
    // reset field errors
    setEmailError(undefined);
    setPasswordError(undefined);
    setNameError(undefined);
    setPhoneError(undefined);

    // client-side validations
    let hasError = false;
    if (!name.trim()) { setNameError('Ad zorunludur'); hasError = true; }
    if (!email.trim()) { setEmailError('Email zorunludur'); hasError = true; }
    if (!password.trim()) { setPasswordError('Şifre zorunludur'); hasError = true; }
    if (!phone.trim()) { setPhoneError('Telefon zorunludur'); hasError = true; }

    const emailOk = /.+@.+\..+/.test(email);
    if (email && !emailOk) { setEmailError('Geçersiz email adresi'); hasError = true; }

    if (password && password.length < 6) { setPasswordError('Şifre en az 6 karakter olmalı'); hasError = true; }

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
        params: { email, phone, name, password, mode: 'pre-register' },
      } as any);
    } finally {
      setLoading(false);
    }
  };

  // No inline pre-email verification here; handled in verify-email screen.

  return (
    <Animated.View style={{ flex: 1, backgroundColor: '#0f172a', padding: 24, justifyContent: 'center', opacity: fade, transform: [{ translateY: translate }] }}>
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <BrandLogo size={84} />
      </View>
      <Text style={{ color: 'white', fontSize: 28, fontWeight: '700', marginBottom: 24 }}>Kayıt Ol</Text>
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
        onSubmitEditing={() => phoneRef.current?.focus()}
        error={emailError}
      />
      <Input
        ref={phoneRef}
        label="Telefon"
        maxLength={10}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        value={phone}
        onChangeText={setPhone}
        placeholder="5XX XXX XX XX"
        returnKeyType="next"
        onSubmitEditing={() => nameRef.current?.focus()}
        error={phoneError}
      />
      <Input
        ref={nameRef}
        label="Ad"
        value={name}
        onChangeText={setName}
        placeholder="Adınız"
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={() => passRef.current?.focus()}
        error={nameError}
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
        onSubmitEditing={() => !loading && onSubmit()}
        error={passwordError}
      />

      <Button title="Kayıt Ol" onPress={onSubmit} loading={loading} />

      <View style={{ flexDirection: 'row', marginTop: 16 }}>
        <Text style={{ color: '#94a3b8' }}>Zaten hesabın var mı? </Text>
        <Link href={"/auth/login" as any} style={{ color: '#06b6d4', fontWeight: '600' }}>Giriş Yap</Link>
      </View>
    </Animated.View>
  );
}
