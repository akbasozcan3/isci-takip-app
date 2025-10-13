import { Link, useRouter } from 'expo-router';
import React from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { BrandLogo } from '../../components/BrandLogo';
import { useMessage } from '../../components/MessageProvider';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { getApiBase } from '../../utils/api';

export default function Register(): React.JSX.Element {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [preSending, setPreSending] = React.useState(false);
  const [preVerifying, setPreVerifying] = React.useState(false);
  const [preCode, setPreCode] = React.useState('');
  const [preToken, setPreToken] = React.useState<string | null>(null);
  const [devCode, setDevCode] = React.useState<string | null>(null);
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

    // Require pre-verified email token first
    if (!preToken) {
      message.show({ type: 'error', title: 'Email Doğrulaması Gerekli', description: 'Kayıda geçmeden önce emailinizi doğrulayın.' });
      return;
    }

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

    try {
      setLoading(true);
      const res = await fetch(`${getApiBase()}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || undefined, phone, pre_token: preToken || undefined }),
      });
      if (!res.ok) {
        let raw = await res.text();
        let detail = '';
        try { const j = JSON.parse(raw); detail = j?.detail || j?.error || ''; } catch { detail = raw; }
        const lower = String(detail).toLowerCase();
        if (lower.includes('email already')) { setEmailError('Bu email zaten kayıtlı'); }
        if (lower.includes('phone already')) { setPhoneError('Bu telefon zaten kayıtlı'); }
        if (lower.includes('invalid phone')) { setPhoneError('Geçersiz telefon numarası'); }
        if (!detail) detail = 'Kayıt başarısız';
        message.show({ type: 'error', title: 'Kayıt Hatası', description: detail });
        return;
      }
      message.show({ type: 'success', title: 'Kayıt Başarılı', description: 'Lütfen email ve telefon doğrulaması yapın.' });
      router.replace({ pathname: '/auth/verify-email' as any, params: { email, phone } } as any);
    } catch (e: any) {
      message.show({ type: 'error', title: 'Kayıt Hatası', description: e?.message || 'Bilinmeyen hata' });
    } finally {
      setLoading(false);
    }
  };

  const sendPreEmail = async () => {
    setEmailError(undefined);
    if (!email.trim()) { setEmailError('Email zorunludur'); return; }
    const ok = /.+@.+\..+/.test(email);
    if (!ok) { setEmailError('Geçersiz email'); return; }
    try {
      setPreSending(true);
      const r = await fetch(`${getApiBase()}/auth/pre-verify-email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
      });
      const data = await r.json().catch(() => ({}));
      if (data?.dev_code) setDevCode(String(data.dev_code));
      message.show({ type: 'success', title: 'Kod Gönderildi', description: 'Email adresinize doğrulama kodu gönderildi.' });
    } catch (e: any) {
      message.show({ type: 'error', title: 'Gönderim Hatası', description: e?.message || 'Kod gönderilemedi' });
    } finally { setPreSending(false); }
  };

  const verifyPreEmail = async () => {
    setEmailError(undefined);
    if (!email.trim()) { setEmailError('Email zorunludur'); return; }
    if (!preCode.trim()) { message.show({ type: 'error', title: 'Kod Gerekli', description: 'Emailinize gelen kodu girin.' }); return; }
    try {
      setPreVerifying(true);
      const r = await fetch(`${getApiBase()}/auth/pre-verify-email/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code: preCode })
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || 'Kod doğrulanamadı');
      }
      const data = await r.json();
      setPreToken(String(data.pre_token));
      message.show({ type: 'success', title: 'Email Doğrulandı', description: 'Kalan bilgileri doldurun.' });
    } catch (e: any) {
      message.show({ type: 'error', title: 'Doğrulama Hatası', description: e?.message || 'Bilinmeyen hata' });
    } finally { setPreVerifying(false); }
  };

  return (
    <Animated.View style={{ flex: 1, backgroundColor: '#0f172a', padding: 24, justifyContent: 'center', opacity: fade, transform: [{ translateY: translate }] }}>
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <BrandLogo size={84} />
      </View>
      <Text style={{ color: 'white', fontSize: 28, fontWeight: '700', marginBottom: 24 }}>Kayıt Ol</Text>
      {/* Email field always visible */}
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
        returnKeyType={preToken ? 'next' : 'done'}
        onSubmitEditing={() => preToken ? phoneRef.current?.focus() : sendPreEmail()}
        error={emailError}
      />

      {/* Pre-email verification step (shown until verified) */}
      {!preToken && (
        <>
          <Input
            label="Email Doğrulama Kodu"
            value={preCode}
            onChangeText={setPreCode}
            keyboardType="number-pad"
            placeholder="6 haneli kod"
          />
          {devCode ? (
            <View style={{ backgroundColor: '#052e2b', borderColor: '#155e75', borderWidth: 1, padding: 12, borderRadius: 10, marginBottom: 8 }}>
              <Text style={{ color: '#67e8f9' }}>Geliştirici Kodu: {devCode}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Button title={preSending ? 'Gönderiliyor...' : 'Kodu Gönder'} onPress={sendPreEmail} loading={preSending} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={preVerifying ? 'Doğrulanıyor...' : 'Kodu Doğrula'} onPress={verifyPreEmail} loading={preVerifying} />
            </View>
          </View>
        </>
      )}

      {/* Remaining fields (visible after preToken) */}
      {preToken && (
        <>
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
        </>
      )}

      <Button title="Kayıt Ol" onPress={onSubmit} loading={loading} />

      <View style={{ flexDirection: 'row', marginTop: 16 }}>
        <Text style={{ color: '#94a3b8' }}>Zaten hesabın var mı? </Text>
        <Link href={"/auth/login" as any} style={{ color: '#06b6d4', fontWeight: '600' }}>Giriş Yap</Link>
      </View>
    </Animated.View>
  );
}
