import { Link, useRouter } from 'expo-router';
import React from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { BrandLogo } from '../../components/BrandLogo';
import { useMessage } from '../../components/MessageProvider';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { getApiBase } from '../../utils/api';
import { saveToken } from '../../utils/auth';

export default function Login(): React.JSX.Element {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();
  const message = useMessage();
  const emailRef = React.useRef<any>(null);
  const passRef = React.useRef<any>(null);
  const [emailError, setEmailError] = React.useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = React.useState<string | undefined>(undefined);

  const fade = React.useRef(new Animated.Value(0)).current;
  const translate = React.useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [fade, translate]);

  const onSubmit = async () => {
    if (!email || !password) {
      message.show({ type: 'error', title: 'Eksik Bilgi', description: 'Email ve şifre zorunludur.' });
      return;
    }
    const emailOk = /.+@.+\..+/.test(email);
    if (!emailOk) {
      message.show({ type: 'error', title: 'Geçersiz Email', description: 'Lütfen geçerli bir email adresi girin.' });
      return;
    }
    try {
      setLoading(true);
      const form = new URLSearchParams();
      form.append('username', email);
      form.append('password', password);
      const res = await fetch(`${getApiBase()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Giriş başarısız');
      }
      const data = await res.json();
      await saveToken(data.access_token);
      message.show({ type: 'success', title: 'Giriş Başarılı' });
      router.replace('/' as any);
    } catch (e: any) {
      message.show({ type: 'error', title: 'Giriş Hatası', description: e?.message || 'Bilinmeyen hata' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Animated.View style={{ flex: 1, backgroundColor: '#0f172a', padding: 24, justifyContent: 'center', opacity: fade, transform: [{ translateY: translate }] }}>
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <BrandLogo size={84} />
      </View>
      <Text style={{ color: 'white', fontSize: 28, fontWeight: '700', marginBottom: 24 }}>Giriş Yap</Text>
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
        returnKeyType="next"
        onSubmitEditing={() => passRef.current?.focus()}
        error={emailError}
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

      <View style={{ alignItems: 'flex-end', marginBottom: 8 }}>
        <Link href={"/auth/forgot" as any} style={{ color: '#06b6d4', fontWeight: '600' }}>Şifremi Unuttum?</Link>
      </View>

      <Button title="Giriş" onPress={onSubmit} loading={loading} />

      <View style={{ flexDirection: 'row', marginTop: 16 }}>
        <Text style={{ color: '#94a3b8' }}>Hesabın yok mu? </Text>
        <Link href={"/auth/register" as any} style={{ color: '#06b6d4', fontWeight: '600' }}>Kayıt Ol</Link>
      </View>
    </Animated.View>
  );
}
