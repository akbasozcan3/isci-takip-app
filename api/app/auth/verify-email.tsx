import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, Text, View } from 'react-native';
import { BrandLogo } from '../../components/BrandLogo';
import { useMessage } from '../../components/MessageProvider';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { getApiBase, getPhpApiBase } from '../../utils/api';

export default function VerifyEmail(): React.JSX.Element {
  const params = useLocalSearchParams<{ email?: string; phone?: string; name?: string; password?: string; username?: string; mode?: string }>();
  const [email, setEmail] = React.useState(params.email || '');
  const [phone] = React.useState(params.phone || '');
  const [name] = React.useState(params.name || '');
  const [password] = React.useState(params.password || '');
  const [username] = React.useState(params.username || '');
  const [mode] = React.useState(params.mode || '');
  const preRegister = String(mode) === 'pre-register';
  const phpMode = String(mode) === 'php';
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const router = useRouter();
  const message = useMessage();

  const fade = React.useRef(new Animated.Value(0)).current;
  const translate = React.useRef(new Animated.Value(20)).current;
  const sentOnce = React.useRef(false);
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [fade, translate]);

  // Auto-send code once when email is available
  React.useEffect(() => {
    if (sentOnce.current) return;
    if (!email) return;
    sentOnce.current = true;
    // fire and forget
    resend().catch(() => {});
  }, [email]);

  const verify = async () => {
    if (!email || !code) {
      message.show({ type: 'error', title: 'Eksik Bilgi', description: 'Email ve kod zorunludur.' });
      return;
    }
    try {
      setLoading(true);
      if (phpMode) {
        const v = await fetch(`${getPhpApiBase()}/api/auth/verify-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code }),
        });
        if (!v.ok) {
          const t = await v.text();
          throw new Error(t || 'Doğrulama başarısız');
        }
        const r = await fetch(`${getPhpApiBase()}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name: name || undefined, phone, username: username || undefined }),
        });
        if (!r.ok) {
          const raw = await r.text();
          throw new Error(raw || 'Kayıt başarısız');
        }
        message.show({ type: 'success', title: 'Email Doğrulandı', description: 'Hesabınız oluşturuldu. Giriş ekranına yönlendiriliyorsunuz.' });
        router.replace('/auth/login' as any);
        return;
      }
      if (preRegister) {
        // Step 1: verify pre-email code to get pre_token
        const v = await fetch(`${getApiBase()}/auth/pre-verify-email/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code }),
        });
        if (!v.ok) {
          const t = await v.text();
          throw new Error(t || 'Doğrulama başarısız');
        }
        const vdata = await v.json();
        const pre_token = String(vdata.pre_token || '');
        if (!pre_token) throw new Error('Geçersiz pre-token');
        // Step 2: complete registration
        const r = await fetch(`${getApiBase()}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name: name || undefined, phone, username: username || undefined, pre_token }),
        });
        if (!r.ok) {
          const raw = await r.text();
          throw new Error(raw || 'Kayıt başarısız');
        }
        message.show({ type: 'success', title: 'Email Doğrulandı', description: 'Hesabınız oluşturuldu. Giriş ekranına yönlendiriliyorsunuz.' });
        router.replace('/auth/login' as any);
        return;
      }
      // Fallback: post-registration email verification
      const res = await fetch(`${getApiBase()}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Doğrulama başarısız');
      }
      message.show({ type: 'success', title: 'Email Doğrulandı', description: 'Giriş ekranına yönlendiriliyorsunuz.' });
      router.replace('/auth/login' as any);
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
      const base = phpMode ? getPhpApiBase() : getApiBase();
      const url = phpMode ? '/api/auth/resend-code' : (preRegister ? '/auth/pre-verify-email' : '/health');
      const res = await fetch(`${base}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
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

      <Button title={preRegister ? 'Kodu Doğrula ve Devam Et' : 'Emaili Doğrula'} onPress={verify} loading={loading} />

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
