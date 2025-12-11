import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { BrandLogo } from '../../components/BrandLogo';
import { Toast, useToast } from '../../components/Toast';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card/index';
import { Input } from '../../components/ui/Input';
import { useTheme } from '../../components/ui/theme/ThemeContext';
import { getApiBase } from '../../utils/api';

function calcPasswordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; email?: string; fromSettings?: string }>();
  const theme = useTheme();
  const { toast, showError, showSuccess, hideToast } = useToast();

  const isFromSettings = params.fromSettings === 'true';
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [email, setEmail] = useState(params.email || '');
  const [token, setToken] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordScore, setPasswordScore] = useState(0);
  const [isManualTokenMode, setIsManualTokenMode] = useState(false);
  const [manualTokenValue, setManualTokenValue] = useState('');
  const [clipboardSuggestion, setClipboardSuggestion] = useState('');
  const hasVerifiedToken = useRef(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      (async () => {
        try {
          const clipboardContent = await Clipboard.getStringAsync();
          if (
            active &&
            clipboardContent &&
            clipboardContent.trim().length > 20 &&
            /^[a-f0-9]+$/i.test(clipboardContent.trim())
          ) {
            setClipboardSuggestion(clipboardContent.trim());
          }
        } catch (_) {}
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  React.useEffect(() => {
    if (!manualTokenValue && clipboardSuggestion) {
      setManualTokenValue(clipboardSuggestion);
    }
  }, [clipboardSuggestion, manualTokenValue]);

  React.useEffect(() => {
    if (step !== 2) {
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
    }
  }, [step]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true
      })
    ]).start();
  }, []);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: step / 3,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false
    }).start();
  }, [step]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (resendTimer > 0) {
      t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [resendTimer]);

  useEffect(() => {
    setPasswordScore(calcPasswordStrength(newPassword));
  }, [newPassword]);

  const verifyToken = React.useCallback(async (tokenToVerify: string) => {
    if (hasVerifiedToken.current) {
      return;
    }

    if (!tokenToVerify || !tokenToVerify.trim()) {
      showError('Token gereklidir. Lütfen e-postanızdaki token\'ı girin.');
      setStep(1);
      return;
    }

    if (tokenToVerify.trim().length < 10) {
      showError('Geçersiz token formatı. Lütfen e-postanızdaki token\'ı tam olarak kopyalayın.');
      setStep(1);
      return;
    }

    hasVerifiedToken.current = true;
    setVerifying(true);
    try {
      const apiBase = getApiBase();
      const url = `${apiBase}/api/auth/reset/verify?token=${encodeURIComponent(tokenToVerify)}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok && res.status === 0) {
        hasVerifiedToken.current = false;
        showError('Backend sunucusuna bağlanılamıyor. Lütfen backend\'in çalıştığından emin olun.');
        setStep(1);
        setVerifying(false);
        return;
      }

      const d = await res.json().catch(() => ({} as any));
      if (res.ok && d.success) {
        setEmail(d.email || '');
        setToken(tokenToVerify);
        setStep(2);
        showSuccess('Link doğrulandı. Yeni şifrenizi belirleyebilirsiniz.');
      } else {
        hasVerifiedToken.current = false;
        const errorMsg = d?.error || 'Token geçersiz veya süresi dolmuş. Lütfen yeni bir şifre sıfırlama isteği gönderin.';
        showError(errorMsg);
        setStep(1);
        setToken('');
        setManualTokenValue('');
      }
    } catch (error: any) {
      hasVerifiedToken.current = false;
      if (error.name === 'AbortError') {
        showError('İstek zaman aşımına uğradı. Backend çalışıyor mu kontrol edin.');
      } else {
        showError('Link doğrulanamadı. Lütfen tekrar deneyin.');
      }
      setStep(1);
      setToken('');
    } finally {
      setVerifying(false);
    }
  }, [showError, showSuccess]);

  const tokenPreview = React.useMemo(() => {
    if (!token) return '';
    if (token.length <= 10) return token;
    return `${token.slice(0, 6)}...${token.slice(-4)}`;
  }, [token]);

  const handleManualTokenVerify = React.useCallback(() => {
    const clean = manualTokenValue.trim();
    if (!clean) {
      showError('Token girin veya panodan yapıştırın.');
      return;
    }
    if (clean.length < 10) {
      showError('Geçersiz token formatı. Lütfen e-postanızdaki token\'ı tam olarak kopyalayın.');
      return;
    }
    setToken(clean);
    verifyToken(clean);
  }, [manualTokenValue, verifyToken, showError]);

  const openGmailInbox = React.useCallback(() => {
    Linking.openURL('https://mail.google.com').catch(() => {
      showError('Gmail açılamadı.');
    });
  }, [showError]);

  useEffect(() => {
    const tokenParam = params.token;
    if (tokenParam && typeof tokenParam === 'string' && tokenParam.trim() && !hasVerifiedToken.current) {
      setToken(tokenParam);
      verifyToken(tokenParam);
    }
  }, [params.token, verifyToken]);

  React.useEffect(() => {
    if (params.email && typeof params.email === 'string' && params.email.trim()) {
      setEmail(params.email.trim());
    }
  }, [params.email]);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const startResendTimer = (seconds = 60) => setResendTimer(seconds);

  const handleBackPress = React.useCallback(() => {
    if (step === 2) {
      setStep(1);
      setToken('');
      setNewPassword('');
      return true;
    }
    if (step === 3) {
      router.back();
      return true;
    }
    router.back();
    return true;
  }, [router, step]);

  useFocusEffect(
    React.useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      return () => subscription.remove();
    }, [handleBackPress])
  );

  const requestResetLink = async () => {
    const clean = email.trim();
    if (!clean) {
      showError('E-posta giriniz');
      return;
    }
    if (!isValidEmail(clean)) {
      showError('Geçerli bir e-posta adresi girin');
      return;
    }
    if (resendTimer > 0) return;

    setLoading(true);
    try {
      const apiBase = getApiBase();
      const url = `${apiBase}/api/auth/reset/request`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok && res.status === 0) {
        showError('Backend sunucusuna bağlanılamıyor. Lütfen backend\'in çalıştığından emin olun.');
        setLoading(false);
        return;
      }

      const d = await res.json().catch(() => ({} as any));
      if (res.ok && d.success) {
        showSuccess(d.message || 'Şifre sıfırlama bilgileri e-postanıza gönderildi. Mobil uygulamadan şifrenizi sıfırlayabilirsiniz.');
        startResendTimer(60);
      } else {
        const errorMsg = d?.error || 'Şifre sıfırlama isteği gönderilemedi. Lütfen tekrar deneyin.';
        if (res.status === 429 || errorMsg.includes('429') || errorMsg.includes('çok fazla')) {
          const retryAfter = d?.retryAfter || 900;
          const minutes = Math.ceil(retryAfter / 60);
          showError(`Çok fazla istek. Lütfen ${minutes} dakika sonra tekrar deneyin.`);
          startResendTimer(Math.min(retryAfter, 900));
        } else if (res.status === 404 || errorMsg.includes('bulunamadı')) {
          showError('Bu e-posta adresi ile kayıtlı bir hesap bulunamadı. Lütfen e-posta adresinizi kontrol edin.');
        } else {
          showError(errorMsg);
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        showError('İstek zaman aşımına uğradı. Backend çalışıyor mu kontrol edin.');
      } else if (error?.message?.includes('Network request failed') || error?.message?.includes('Failed to fetch')) {
        showError('Backend sunucusuna bağlanılamıyor. PM2 ile backend başlatın.');
      } else {
        showError('Ağ hatası. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async (): Promise<boolean> => {
    const cleanPw = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!token || !token.trim()) {
      showError('Geçersiz link.');
      return false;
    }

    if (!cleanPw) {
      showError('Yeni şifrenizi girin');
      return false;
    }

    if (!cleanConfirm) {
      showError('Yeni şifrenizi tekrar girin');
      return false;
    }

    if (cleanPw !== cleanConfirm) {
      showError('Şifreler eşleşmiyor');
      return false;
    }

    if (cleanPw.length < 6) {
      showError('Şifre en az 6 karakter olmalıdır');
      return false;
    }

    setLoading(true);
    try {
      const apiBase = getApiBase();
      const url = `${apiBase}/api/auth/reset/confirm`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          newPassword: cleanPw
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok && res.status === 0) {
        showError('Backend sunucusuna bağlanılamıyor. Lütfen backend\'in çalıştığından emin olun.');
        setLoading(false);
        return false;
      }

      const d = await res.json().catch(() => ({} as any));
      if (res.ok && d.success) {
        showSuccess('Şifreniz güncellendi. Giriş yapabilirsiniz.');
        setToken('');
        setNewPassword('');
        setConfirmPassword('');
        return true;
      } else {
        const errorMsg = d?.error || 'Şifre sıfırlanamadı. Lütfen tekrar deneyin.';
        showError(errorMsg);
        if (errorMsg.includes('geçersiz') || errorMsg.includes('süresi dolmuş')) {
          setStep(1);
          setToken('');
          setManualTokenValue('');
        }
        return false;
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        showError('İstek zaman aşımına uğradı. Backend çalışıyor mu kontrol edin.');
      } else if (error?.message?.includes('Network request failed') || error?.message?.includes('Failed to fetch')) {
        showError('Backend sunucusuna bağlanılamıyor. PM2 ile backend başlatın.');
      } else {
        showError('Ağ hatası. Lütfen tekrar deneyin.');
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const maskedEmail = useMemo(() => {
    const e = email.trim();
    if (!e || !e.includes('@')) return e;
    const [user, domain] = e.split('@');
    const vis = user.slice(0, Math.min(2, user.length));
    const stars = '*'.repeat(Math.max(2, user.length - vis.length));
    return `${vis}${stars}@${domain}`;
  }, [email]);

  const pwLabel = passwordScore >= 3 ? 'Güçlü' : passwordScore >= 2 ? 'Orta' : passwordScore >= 1 ? 'Zayıf' : '';
  const pwColor = passwordScore >= 3 ? theme.colors.semantic.success : passwordScore >= 2 ? theme.colors.semantic.warning : passwordScore >= 1 ? theme.colors.semantic.danger : theme.colors.text.disabled;

  if (verifying) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <LinearGradient colors={[theme.colors.bg.secondary, theme.colors.bg.tertiary, theme.colors.bg.elevated]} style={styles.gradient}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.loadingContainer}>
              <Animated.View
                style={[
                  styles.loadingIconContainer,
                  {
                    opacity: fadeAnim,
                    transform: [{ scale: fadeAnim }]
                  }
                ]}
              >
                <LinearGradient colors={theme.colors.gradient.primary as [string, string]} style={styles.loadingIconGradient}>
                  <Ionicons name="lock-closed" size={48} color={theme.colors.text.primary} />
                </LinearGradient>
              </Animated.View>
              <Text style={[styles.loadingText, { color: theme.colors.text.primary }]}>Link doğrulanıyor...</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      style={styles.container}
    >
      <LinearGradient colors={[theme.colors.bg.secondary, theme.colors.bg.tertiary, theme.colors.bg.elevated]} style={styles.gradient}>
        <StatusBar barStyle="light-content" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable onPress={handleBackPress} style={styles.backButton}>
              <View style={[styles.backButtonInner, { backgroundColor: theme.colors.surface.default + 'CC', borderColor: theme.colors.border.subtle }]}>
                <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
                <Text style={[styles.backText, { color: theme.colors.text.primary }]}>Geri</Text>
              </View>
            </Pressable>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: theme.colors.border.subtle }]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%']
                  })
                }
              ]}
            >
              <LinearGradient 
                colors={[theme.colors.primary.main, theme.colors.accent.main]} 
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 0 }} 
                style={styles.progressGradient} 
              />
            </Animated.View>
          </View>

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.contentContainer}>
              <Animated.View
                style={[
                  styles.headerContent,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }]
                  }
                ]}
              >
                <View style={styles.logoWrapper}>
                  <BrandLogo size={200} withSoftContainer={false} variant="default" />
                </View>
                <View style={styles.titleContainer}>
                  <Text style={[styles.title, { color: theme.colors.text.primary }]}>
                    {step === 1 && 'Şifre Sıfırlama'}
                    {step === 2 && 'Yeni Şifre Belirle'}
                    {step === 3 && 'Şifre Güncellendi'}
                  </Text>
                  <Text style={[styles.subtitle, { color: theme.colors.text.tertiary }]}>
                    {step === 1 && 'E-posta adresinize gönderilen token ile şifrenizi sıfırlayın'}
                    {step === 2 && `Doğrulanan hesap: ${maskedEmail || '—'}`}
                    {step === 3 && 'Yeni şifrenle giriş yapabilirsin'}
                  </Text>
                </View>
              </Animated.View>

              <Animated.View
                style={[
                  styles.form,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }]
                  }
                ]}
              >
              {step === 1 && (
                <Card variant="elevated" padding="md" style={styles.mainCard}>
                  <Input
                    label="E-posta Adresi"
                    placeholder="ornek@email.com"
                    value={email}
                    onChangeText={isFromSettings ? undefined : setEmail}
                    editable={!isFromSettings}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    leftElement={
                      <View style={styles.iconWrapper}>
                        <Ionicons 
                          name={isFromSettings ? "lock-closed-outline" : "mail-outline"} 
                          size={20} 
                          color={isFromSettings ? theme.colors.primary.main : theme.colors.text.tertiary} 
                        />
                      </View>
                    }
                    style={[
                      styles.input,
                      isFromSettings && styles.inputLocked
                    ]}
                    containerStyle={isFromSettings ? {
                      backgroundColor: theme.colors.primary.main + '08',
                      borderColor: theme.colors.primary.main + '30',
                    } : undefined}
                  />
                  {isFromSettings && (
                    <View style={[styles.lockedInfo, { backgroundColor: theme.colors.primary.main + '12', borderColor: theme.colors.primary.main + '30' }]}>
                      <View style={[styles.lockedIconWrapper, { backgroundColor: theme.colors.primary.main + '20' }]}>
                        <Ionicons name="shield-checkmark" size={14} color={theme.colors.primary.main} />
                      </View>
                      <Text style={[styles.lockedInfoText, { color: theme.colors.text.primary }]}>
                        <Text style={{ fontWeight: '700', fontFamily: 'Poppins-Bold' }}>Korumalı:</Text> E-posta adresiniz ayarlardan alındı ve güvenli şekilde korunuyor
                      </Text>
                    </View>
                  )}

                  <View style={[styles.infoRow, { backgroundColor: theme.colors.primary.main + '14', borderColor: theme.colors.primary.main + '25' }]}>
                    <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary.main} />
                    <Text style={[styles.infoRowText, { color: theme.colors.text.secondary }]}>Token 1 saat geçerlidir</Text>
                  </View>

                  <View style={styles.quickActions}>
                    <Pressable 
                      style={[styles.actionButton, { backgroundColor: theme.colors.primary.main + '1A', borderColor: theme.colors.primary.main + '40' }]}
                      onPress={openGmailInbox}
                    >
                      <LinearGradient
                        colors={[theme.colors.primary.main + '33', theme.colors.primary.light + '33']}
                        style={styles.actionButtonGradient}
                      >
                        <Ionicons name="logo-google" size={18} color={theme.colors.primary.main} />
                        <Text style={[styles.actionButtonText, { color: theme.colors.primary.main }]}>Gmail Aç</Text>
                      </LinearGradient>
                    </Pressable>
                    <Pressable 
                      style={[styles.actionButton, { backgroundColor: theme.colors.accent.main + '1A', borderColor: theme.colors.accent.main + '40' }]}
                      onPress={() => setIsManualTokenMode((p) => !p)}
                    >
                      <LinearGradient
                        colors={[theme.colors.accent.main + '33', theme.colors.accent.light + '33']}
                        style={styles.actionButtonGradient}
                      >
                        <Ionicons name="key-outline" size={18} color={theme.colors.accent.main} />
                        <Text style={[styles.actionButtonText, { color: theme.colors.accent.main }]}>Token Gir</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>

                  {isManualTokenMode && (
                    <Card variant="default" padding="sm" style={styles.manualTokenCard}>
                      <Input
                        label="Token"
                        placeholder="E-postadaki uzun kodu yapıştır"
                        value={manualTokenValue}
                        onChangeText={setManualTokenValue}
                        autoCapitalize="none"
                        style={styles.tokenInput}
                      />
                      <Button
                        title="Token'ı Doğrula"
                        onPress={handleManualTokenVerify}
                        disabled={!manualTokenValue.trim()}
                        style={styles.submitButton}
                      />
                      {!!clipboardSuggestion && (
                        <Pressable
                          style={[styles.clipboardPill, { backgroundColor: theme.colors.primary.main + '1A', borderColor: theme.colors.primary.main + '33' }]}
                          onPress={() => setManualTokenValue(clipboardSuggestion)}
                        >
                          <Ionicons name="clipboard-outline" size={14} color={theme.colors.primary.main} />
                          <Text style={[styles.clipboardPillText, { color: theme.colors.primary.light }]}>Panodan yapıştır ({clipboardSuggestion.slice(0, 6)}...)</Text>
                        </Pressable>
                      )}
                    </Card>
                  )}

                  <Button
                    title={resendTimer > 0 ? `Tekrar gönder (${resendTimer}s)` : 'Link Gönder'}
                    onPress={requestResetLink}
                    loading={loading}
                    disabled={loading || resendTimer > 0 || !email.trim()}
                    style={styles.submitButton}
                  />
                </Card>
              )}

              {step === 2 && (
                <Card variant="elevated" padding="lg" style={styles.mainCard}>
                  {tokenPreview && (
                    <View style={[styles.tokenBadge, { backgroundColor: theme.colors.semantic.success + '1A', borderColor: theme.colors.semantic.success + '33' }]}>
                      <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.semantic.success} />
                      <Text style={[styles.tokenBadgeText, { color: theme.colors.semantic.success }]}>{tokenPreview}</Text>
                    </View>
                  )}

                  <Input
                    label="Yeni Şifre"
                    placeholder="En az 6 karakter"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="password-new"
                    leftElement={
                      <View style={styles.iconWrapper}>
                        <Ionicons name="lock-closed-outline" size={20} color={theme.colors.text.tertiary} />
                      </View>
                    }
                    rightElement={
                      <Pressable onPress={() => setShowPassword((s) => !s)} style={styles.iconWrapper}>
                        <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.text.tertiary} />
                      </Pressable>
                    }
                    style={styles.input}
                  />

                  <Input
                    label="Yeni Şifre (Tekrar)"
                    placeholder="Şifrenizi tekrar girin"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="password-new"
                    leftElement={
                      <View style={styles.iconWrapper}>
                        <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.text.tertiary} />
                      </View>
                    }
                    style={styles.input}
                  />

                  {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                    <Text style={[styles.mismatchText, { color: theme.colors.semantic.danger }]}>Şifreler eşleşmiyor</Text>
                  )}

                  {newPassword.length > 0 && (
                    <View style={[styles.passwordStrength, { backgroundColor: theme.colors.surface.default, borderColor: theme.colors.border.subtle }]}>
                      <View style={styles.passwordStrengthHeader}>
                        <Text style={[styles.passwordStrengthLabel, { color: theme.colors.text.secondary }]}>Şifre gücü</Text>
                        <Text style={[styles.passwordStrengthText, { color: pwColor }]}>{pwLabel}</Text>
                      </View>
                      <View style={styles.passwordMeter}>
                        {[0, 1, 2, 3].map((i) => (
                          <View
                            key={i}
                            style={[
                              styles.passwordBar,
                              {
                                backgroundColor: i <= passwordScore - 1 ? pwColor : theme.colors.border.subtle
                              }
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  )}

                  <Button
                    title="Şifreyi Sıfırla"
                    onPress={async () => {
                      const ok = await confirmReset();
                      if (ok) setStep(3);
                    }}
                    loading={loading}
                    disabled={
                      !newPassword.trim() ||
                      newPassword.length < 6 ||
                      !confirmPassword.trim() ||
                      newPassword !== confirmPassword ||
                      loading
                    }
                    style={styles.submitButton}
                  />
                </Card>
              )}

              {step === 3 && (
                <Card variant="elevated" padding="lg" style={styles.mainCard}>
                  <View style={[styles.successIconBackground, { backgroundColor: theme.colors.semantic.success + '1A', borderColor: theme.colors.semantic.success + '33' }]}>
                    <Ionicons name="checkmark-circle" size={56} color={theme.colors.semantic.success} />
                  </View>
                  <Button
                    title="Girişe Dön"
                    onPress={() => {
                      setToken('');
                      setNewPassword('');
                      setEmail('');
                      router.replace('/auth/login');
                    }}
                    style={styles.submitButton}
                  />
                </Card>
              )}
              </Animated.View>
            </View>
          </ScrollView>
        </SafeAreaView>

        <Toast message={toast.message} type={toast.type} visible={toast.visible} onHide={hideToast} />
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1, position: 'relative' },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : 25,
    paddingBottom: 4
  },
  backButton: { borderRadius: 12, overflow: 'hidden' },
  backButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  backText: {
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3
  },
  progressTrack: {
    height: 4,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden'
  },
  progressFill: { height: 4, borderRadius: 8 },
  progressGradient: { flex: 1, height: 4, borderRadius: 8 },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  contentContainer: {
    paddingTop: Platform.OS === 'ios' ? 12 : 8,
    paddingHorizontal: 20,
  },
  headerContent: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 8
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 2
  },
  titleContainer: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 2
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 2,
    letterSpacing: 0.3,
    textAlign: 'center',
    fontFamily: 'Poppins-Bold',
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 16,
    fontWeight: '500',
    fontFamily: 'Poppins-Regular',
  },
  form: {
    width: '100%',
    marginTop: 2
  },
  mainCard: {
    marginBottom: 0,
  },
  input: { marginBottom: 8 },
  iconWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10
  },
  infoRowText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Poppins-Regular',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
  },
  manualTokenCard: {
    marginTop: 6,
    marginBottom: 10,
  },
  tokenInput: { marginBottom: 8 },
  clipboardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8
  },
  clipboardPillText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  submitButton: { marginTop: 6, marginBottom: 0 },
  tokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16
  },
  tokenBadgeText: {
    fontSize: 12,
    letterSpacing: 0.4,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  passwordStrength: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    marginBottom: 12
  },
  passwordStrengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  passwordStrengthLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  passwordStrengthText: {
    fontWeight: '700',
    fontSize: 12.5,
    fontFamily: 'Poppins-Bold',
  },
  passwordMeter: {
    flexDirection: 'row',
    gap: 6
  },
  passwordBar: {
    flex: 1,
    height: 6,
    borderRadius: 3
  },
  mismatchText: {
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
    fontFamily: 'Poppins-Regular',
  },
  successIconBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20
  },
  loadingIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  loadingIconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  loadingText: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
  inputLocked: {
    opacity: 0.95
  },
  lockedInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: -4,
    marginBottom: 16
  },
  lockedIconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1
  },
  lockedInfoText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '500',
    fontFamily: 'Poppins-Medium',
    lineHeight: 18
  }
});
