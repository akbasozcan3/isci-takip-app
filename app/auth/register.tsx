import React from 'react';
import { View, Text, Pressable, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { BrandLogo } from '../../components/BrandLogo';
import { getApiBase } from '../../utils/api';
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

  const fade = React.useRef(new Animated.Value(0)).current;
  const translate = React.useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [fade, translate]);

  const onSubmit = async () => {
    if (!email || !password || !phone) {
      message.show({ type: 'error', title: 'Eksik Bilgi', description: 'Email, telefon ve şifre zorunludur.' });
      return;
    }
    const emailOk = /.+@.+\..+/.test(email);
    if (!emailOk) {
      message.show({ type: 'error', title: 'Geçersiz Email', description: 'Lütfen geçerli bir email adresi girin.' });
      return;
    }
    const digits = phone.replace(/\D/g, '');
    if (!(digits.length === 10 || (digits.length === 11 && digits.startsWith('0')) || digits.length >= 12)) {
      message.show({ type: 'error', title: 'Geçersiz Telefon', description: 'Lütfen geçerli bir telefon numarası girin.' });
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${getApiBase()}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || undefined, phone }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Kayıt başarısız');
      }
      message.show({ type: 'success', title: 'Kayıt Başarılı', description: 'Lütfen email ve telefon doğrulaması yapın.' });
      router.replace({ pathname: '/auth/verify-email' as any, params: { email, phone } } as any);
    } catch (e: any) {
      message.show({ type: 'error', title: 'Kayıt Hatası', description: e?.message || 'Bilinmeyen hata' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Animated.View style={{ flex: 1, backgroundColor: '#0f172a', padding: 24, justifyContent: 'center', opacity: fade, transform: [{ translateY: translate }] }}>
      <View style={{ position: 'absolute', top: 24, left: 24 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 6, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
          <Ionicons name="chevron-back" size={20} color="#e2e8f0" />
        </Pressable>
      </View>
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <BrandLogo size={84} />
      </View>
      <Text style={{ color: 'white', fontSize: 28, fontWeight: '700', marginBottom: 24 }}>Kayıt Ol</Text>
      <Input label="Ad" value={name} onChangeText={setName} placeholder="Adınız" />
      <Input label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="ornek@mail.com" />
      <Input label="Telefon" autoCapitalize="none" keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="5XX XXX XX XX" />
      <Input label="Şifre" secureTextEntry value={password} onChangeText={setPassword} placeholder="••••••••" />

      <Button title="Kayıt Ol" onPress={onSubmit} loading={loading} />

      <View style={{ flexDirection: 'row', marginTop: 16 }}>
        <Text style={{ color: '#94a3b8' }}>Zaten hesabın var mı? </Text>
        <Link href={"/auth/login" as any} style={{ color: '#06b6d4', fontWeight: '600' }}>Giriş Yap</Link>
      </View>
    </Animated.View>
  );
}
