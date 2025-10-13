import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { BrandLogo } from '../../components/BrandLogo';
import { useMessage } from '../../components/MessageProvider';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { getApiBase } from '../../utils/api';

export default function ForgotPassword(): React.JSX.Element {
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [devCode, setDevCode] = React.useState<string | null>(null);
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
    if (!email) {
      message.show({ type: 'error', title: 'Eksik Bilgi', description: 'Email zorunludur.' });
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${getApiBase()}/auth/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'İşlem başarısız');
      }
      const data = await res.json();
      if (data.dev_code) {
        setDevCode(String(data.dev_code));
      }
      message.show({ type: 'success', title: 'Kod Gönderildi', description: 'Eğer email kayıtlıysa, kod gönderildi.' });
      router.push({ pathname: '/auth/reset' as any, params: { email } } as any);
    } catch (e: any) {
      message.show({ type: 'error', title: 'Hata', description: e?.message || 'Bilinmeyen hata' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Animated.View style={{ flex: 1, backgroundColor: '#0f172a', padding: 24, justifyContent: 'center', opacity: fade, transform: [{ translateY: translate }] }}>
      <View style={{ position: 'absolute', top: 24, left: 24 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 10, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',top:25 }}>
          <Ionicons name="chevron-back" size={20} color="#e2e8f0" />
        </Pressable>
      </View>
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <BrandLogo size={84} />
      </View>
      <Text style={{ color: 'white', fontSize: 28, fontWeight: '700', marginBottom: 24 }}>Şifremi Unuttum</Text>
      <Input label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="ornek@mail.com" />

      {devCode ? (
        <View style={{ backgroundColor: '#052e2b', borderColor: '#155e75', borderWidth: 1, padding: 12, borderRadius: 10, marginBottom: 16 }}>
          <Text style={{ color: '#67e8f9' }}>Geliştirici Kodu: {devCode}</Text>
        </View>
      ) : null}

      <Button title="Kod Gönder" onPress={onSubmit} loading={loading} />
    </Animated.View>
  );
}
