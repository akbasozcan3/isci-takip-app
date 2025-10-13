import React from 'react';
import { View, Text, Pressable, ActivityIndicator, Animated, Easing } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BrandLogo } from '../../components/BrandLogo';
import { getApiBase } from '../../utils/api';
import { useMessage } from '../../components/MessageProvider';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function VerifyEmail(): React.JSX.Element {
  const params = useLocalSearchParams<{ email?: string; phone?: string }>();
  const [email, setEmail] = React.useState(params.email || '');
  const [phone] = React.useState(params.phone || '');
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
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

  const verify = async () => {
    if (!email || !code) {
      message.show({ type: 'error', title: 'Eksik Bilgi', description: 'Email ve kod zorunludur.' });
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${getApiBase()}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Doğrulama başarısız');
      }
      message.show({ type: 'success', title: 'Email Doğrulandı', description: 'Telefon doğrulamasına geçiliyor.' });
      router.replace({ pathname: '/auth/verify-phone' as any, params: { phone } } as any);
    } catch (e: any) {
      let msg = e?.message || 'Bilinmeyen hata';
      try { const p = JSON.parse(msg); msg = p?.detail || msg; } catch {}
      message.show({ type: 'error', title: 'Hata', description: msg });
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!email) return;
    try {
      setResending(true);
      const res = await fetch(`${getApiBase()}/auth/send-email-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data?.dev_code) setDevCode(String(data.dev_code));
      message.show({ type: 'success', title: 'Kod Gönderildi', description: 'Doğrulama kodu gönderildi.' });
    } catch (e: any) {
      message.show({ type: 'error', title: 'Hata', description: e?.message || 'Bilinmeyen hata' });
    } finally {
      setResending(false);
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
      <Text style={{ color: 'white', fontSize: 28, fontWeight: '700', marginBottom: 24 }}>Email Doğrulama</Text>
      <Input label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="ornek@mail.com" />
      <Input label="Doğrulama Kodu" autoCapitalize="none" keyboardType="number-pad" value={code} onChangeText={setCode} placeholder="6 haneli kod" />

      {devCode ? (
        <View style={{ backgroundColor: '#052e2b', borderColor: '#155e75', borderWidth: 1, padding: 12, borderRadius: 10, marginBottom: 16 }}>
          <Text style={{ color: '#67e8f9' }}>Geliştirici Kodu: {devCode}</Text>
        </View>
      ) : null}

      <Button title="Emaili Doğrula" onPress={verify} loading={loading} />

      <Pressable onPress={resend} disabled={resending} style={{ padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
        {resending ? (
          <ActivityIndicator color="#06b6d4" />
        ) : (
          <>
            <Ionicons name="refresh" size={18} color="#06b6d4" />
            <Text style={{ color: '#06b6d4', fontWeight: '600' }}>Kodu Tekrar Gönder</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
