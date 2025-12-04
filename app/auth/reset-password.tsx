import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { BrandLogo } from '../../components/BrandLogo';
import { Toast, useToast } from '../../components/Toast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { getApiBase } from '../../utils/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const params = useLocalSearchParams<{ token?: string }>();
  const { toast, showError, showSuccess, hideToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [email, setEmail] = useState('');
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
      showError('Geçersiz link. Lütfen e-postanızdaki linki kullanın.');
      setStep(1);
      return;
    }

    hasVerifiedToken.current = true;
    setVerifying(true);
    try {
      const apiBase = getApiBase();
      const url = `${apiBase}/api/auth/reset/verify?token=${encodeURIComponent(tokenToVerify)}`;
      
      // Timeout controller (15 saniye)
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
        const errorMsg = d?.error || 'Geçersiz veya süresi dolmuş link';
        showError(errorMsg);
        setStep(1);
        setToken('');
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
      router.replace('/auth/login');
      return true;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/auth/login');
    }
    return true;
  }, [router, step]);

  useFocusEffect(
    React.useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      return () => subscription.remove();
    }, [handleBackPress])
  );

  const   requestResetLink = async () => {
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
      
      // Timeout controller (15 saniye)
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
      if (res.ok) {
        showSuccess('Şifre sıfırlama linki e-postanıza gönderildi.');
        startResendTimer(60);
      } else {
        const errorMsg = d?.error || 'Link gönderilemedi';
        if (errorMsg.includes('429') || errorMsg.includes('çok fazla')) {
          showError('Çok fazla istek. Lütfen 10 dakika sonra tekrar deneyin.');
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

  const   confirmReset = async (): Promise<boolean> => {
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
      
      // Timeout controller (15 saniye)
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
        const errorMsg = d?.error || 'Şifre sıfırlanamadı';
        showError(errorMsg);
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
  const pwColor = passwordScore >= 3 ? '#10b981' : passwordScore >= 2 ? '#f59e0b' : passwordScore >= 1 ? '#ef4444' : '#64748b';

  if (verifying) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <LinearGradient colors={['#0f172a', '#1e293b', '#334155']} style={styles.gradient}>
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
                <LinearGradient colors={['#06b6d4', '#3b82f6', '#8b5cf6']} style={styles.loadingIconGradient}>
                  <Ionicons name="lock-closed" size={48} color="#ffffff" />
                </LinearGradient>
              </Animated.View>
              <Text style={styles.loadingText}>Link doğrulanıyor...</Text>
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
      <LinearGradient colors={['#0f172a', '#1e293b', '#334155']} style={styles.gradient}>
        <StatusBar barStyle="light-content" />
        <Animated.View
          style={[
            styles.decorativeCircle1,
            {
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.15]
              })
            }
          ]}
        />
        <Animated.View
          style={[
            styles.decorativeCircle2,
            {
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.12]
              })
            }
          ]}
        />

        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBackPress} style={styles.backButton} activeOpacity={0.7}>
              <View style={styles.backButtonInner}>
                <Ionicons name="chevron-back" size={22} color="#E6EEF8" />
                <Text style={styles.backText}>Geri</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.progressTrack}>
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
              <LinearGradient colors={['#06b6d4', '#3b82f6', '#8b5cf6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.progressGradient} />
            </Animated.View>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
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
                <BrandLogo size={250} withSoftContainer={false} variant="default" />
              </View>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>
                  {step === 1 && 'Şifre Sıfırlama'}
                  {step === 2 && 'Yeni Şifre Belirle'}
                  {step === 3 && 'Şifre Güncellendi'}
                </Text>
                <Text style={styles.subtitle}>
                  {step === 1 && 'E-posta adresinize gönderilen link ile şifrenizi sıfırlayın'}
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
                <>
                  <Input
                    label="E-posta Adresi"
                    placeholder="ornek@email.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    leftElement={
                      <View style={styles.iconCircle}>
                        <Ionicons name="mail-outline" size={18} color="#94a3b8" />
                      </View>
                    }
                    style={styles.input}
                  />

                  <View style={styles.infoRow}>
                    <Ionicons name="information-circle-outline" size={16} color="#38bdf8" />
                    <Text style={styles.infoRowText}>Link 10 dakika geçerlidir</Text>
                  </View>

                  <View style={styles.quickActions}>
                    <TouchableOpacity 
                      style={styles.chip} 
                      onPress={openGmailInbox}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="logo-google" size={16} color="#4285f4" />
                      <Text style={styles.chipText}>Gmail Aç</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.chip} 
                      onPress={() => setIsManualTokenMode((p) => !p)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="key-outline" size={16} color="#f472b6" />
                      <Text style={styles.chipText}>{isManualTokenMode ? 'Token Gizle' : 'Token Gir'}</Text>
                    </TouchableOpacity>
                  </View>

                  {isManualTokenMode && (
                    <View style={styles.manualTokenCard}>
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
                        <TouchableOpacity
                          style={styles.clipboardPill}
                          onPress={() => setManualTokenValue(clipboardSuggestion)}
                        >
                          <Ionicons name="clipboard-outline" size={14} color="#0ea5e9" />
                          <Text style={styles.clipboardPillText}>Panodan yapıştır ({clipboardSuggestion.slice(0, 6)}...)</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  <Button
                    title={resendTimer > 0 ? `Tekrar gönder (${resendTimer}s)` : 'Link Gönder'}
                    onPress={requestResetLink}
                    loading={loading}
                    disabled={loading || resendTimer > 0 || !email.trim()}
                    style={styles.submitButton}
                  />
                </>
              )}

              {step === 2 && (
                <>
                  {tokenPreview && (
                    <View style={styles.tokenBadge}>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#10b981" />
                      <Text style={styles.tokenBadgeText}>{tokenPreview}</Text>
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
                      <View style={styles.iconCircle}>
                        <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" />
                      </View>
                    }
                    rightElement={
                      <TouchableOpacity onPress={() => setShowPassword((s) => !s)} style={styles.iconCircle}>
                        <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94a3b8" />
                      </TouchableOpacity>
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
                      <View style={styles.iconCircle}>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#94a3b8" />
                      </View>
                    }
                    style={styles.input}
                  />

                  {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                    <Text style={styles.mismatchText}>Şifreler eşleşmiyor</Text>
                  )}

                  {newPassword.length > 0 && (
                    <View style={styles.passwordStrength}>
                      <View style={styles.passwordStrengthHeader}>
                        <Text style={styles.passwordStrengthLabel}>Şifre gücü</Text>
                        <Text style={[styles.passwordStrengthText, { color: pwColor }]}>{pwLabel}</Text>
                      </View>
                      <View style={styles.passwordMeter}>
                        {[0, 1, 2, 3].map((i) => (
                          <View
                            key={i}
                            style={[
                              styles.passwordBar,
                              {
                                backgroundColor: i <= passwordScore - 1 ? pwColor : 'rgba(255,255,255,0.08)'
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
                </>
              )}

              {step === 3 && (
                <>
                  <View style={styles.successIconBackground}>
                    <Ionicons name="checkmark-circle" size={56} color="#10b981" />
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
                </>
              )}
            </Animated.View>
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
  decorativeCircle1: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(6,182,212,0.12)',
    top: -120,
    right: -120
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(59,130,246,0.1)',
    bottom: -120,
    left: -120
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8
  },
  backButton: { borderRadius: 12, overflow: 'hidden' },
  backButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)'
  },
  backText: {
    color: '#E6EEF8',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3
  },
  progressTrack: {
    height: 4,
    top: 10,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden'
  },
  progressFill: { height: 4, borderRadius: 8 },
  progressGradient: { flex: 1, height: 4, borderRadius: 8 },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  headerContent: {
    alignItems: 'center',
    width: '100%'
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 0
  },
  titleContainer: {
    alignItems: 'center',
    width: '100%'
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 4,
    letterSpacing: 0.5,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
    fontWeight: '500'
  },
  form: {
    width: '100%'
  },
  input: { marginBottom: 10 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.15)',
    marginBottom: 12
  },
  infoRowText: {
    flex: 1,
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '500'
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.25)'
  },
  chipText: {
    color: '#e0e7ff',
    fontSize: 13,
    fontWeight: '600'
  },
  manualTokenCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(2,6,23,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.15)',
    gap: 10,
    marginTop: 8,
    marginBottom: 8
  },
  tokenInput: { marginBottom: 0 },
  clipboardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(14,165,233,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.25)'
  },
  clipboardPillText: {
    color: '#bae6fd',
    fontSize: 12,
    fontWeight: '600'
  },
  submitButton: { marginTop: 4, marginBottom: 0 },
  tokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    marginBottom: 8
  },
  tokenBadgeText: {
    color: '#86efac',
    fontSize: 12,
    letterSpacing: 0.4
  },
  passwordStrength: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    gap: 8
  },
  passwordStrengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  passwordStrengthLabel: {
    color: '#cbd5e1',
    fontSize: 12.5,
    fontWeight: '600'
  },
  passwordStrengthText: {
    fontWeight: '700',
    fontSize: 12.5
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
    color: '#fca5a5',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 4
  },
  successIconBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(16,185,129,0.25)',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
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
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10
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
    color: '#E6EEF8',
    fontSize: 20,
    fontWeight: '700'
  }
});
