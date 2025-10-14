import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { BrandLogo } from '../../components/BrandLogo';
import { useMessage } from '../../components/MessageProvider';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { getApiBase } from '../../utils/api';

export default function ResetPassword(): React.JSX.Element {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = React.useState(params.email || '');
  const [code, setCode] = React.useState('');
  const [password, setPassword] = React.useState('');
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
    if (!email || !code || !password) {
      message.show({ type: 'error', title: 'Eksik Bilgi', description: 'Email, kod ve yeni şifre zorunludur.' });
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${getApiBase()}/auth/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, new_password: password }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'İşlem başarısız');
      }
      message.show({ type: 'success', title: '🎉 Şifre Başarıyla Güncellendi!', description: 'Yeni şifrenizle giriş yapabilirsiniz. Giriş sayfasına yönlendiriliyorsunuz...' });
      setTimeout(() => {
        router.replace('/auth/login' as any);
      }, 2000);
    } catch (e: any) {
      let msg = e?.message || 'Bilinmeyen hata';
      try {
        const parsed = JSON.parse(msg);
        msg = parsed?.detail || msg;
      } catch {}
      message.show({ type: 'error', title: 'Hata', description: msg });
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
      <Text style={{ color: 'white', fontSize: 28, fontWeight: '700', marginBottom: 24 }}>Şifre Sıfırla</Text>
      <Input label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="ornek@mail.com" />
      <Input label="Doğrulama Kodu" autoCapitalize="none" keyboardType="number-pad" value={code} onChangeText={setCode} placeholder="6 haneli kod" />
      <Input label="Yeni Şifre" secureTextEntry value={password} onChangeText={setPassword} placeholder="••••••••" />

      <Button title="Şifreyi Güncelle" onPress={onSubmit} loading={loading} />
    </Animated.View>
  );
}
