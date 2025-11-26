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
  SafeAreaView,
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

/* =========================
   YARDIMCI: Şifre gücü
   ========================= */
function calcPasswordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

/* =========================
   ANA EKRAN
   ========================= */
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
  const [sentVia, setSentVia] = useState<string>('');
  const [devLinks, setDevLinks] = useState<{ web?: string; native?: string } | null>(null);
  const [isManualTokenMode, setIsManualTokenMode] = useState(false);
  const [manualTokenValue, setManualTokenValue] = useState('');
  const [clipboardSuggestion, setClipboardSuggestion] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<'web' | 'native' | 'token' | null>(null);
  const hasVerifiedToken = useRef(false); // Token'ın daha önce doğrulanıp doğrulanmadığını takip et
  const stepMeta = React.useMemo(
    () => [
      { id: 1, title: 'E-posta Gönderildi', subtitle: 'Gelen kutunu kontrol et' },
      { id: 2, title: 'Şifre Oluştur', subtitle: 'Güçlü bir parola seç' },
      { id: 3, title: 'Girişe Hazır', subtitle: 'Yeni şifre ile devam et' },
    ],
    []
  );

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

  // Smooth animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const progress = useRef(new Animated.Value(0)).current;

  // Verify token from URL
  const verifyToken = React.useCallback(async (tokenToVerify: string) => {
    // Eğer token daha önce doğrulandıysa tekrar doğrulama
    if (hasVerifiedToken.current) {
      console.log('⏭️ Token already verified, skipping...');
      return;
    }

    if (!tokenToVerify || !tokenToVerify.trim()) {
      console.warn('⚠️ Empty token provided');
      showError('Geçersiz link. Lütfen e-postanızdaki linki kullanın.');
      setStep(1);
      return;
    }

    hasVerifiedToken.current = true; // İşaretle ki tekrar çalışmasın
    setVerifying(true);
    try {
      console.log('🔍 Verifying token...');
      const res = await fetch(`${getApiBase()}/api/auth/reset/verify?token=${encodeURIComponent(tokenToVerify)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      // Network hatası kontrolü
      if (!res.ok && res.status === 0) {
        hasVerifiedToken.current = false; // Hata durumunda tekrar denemeye izin ver
        showError('Backend sunucusuna bağlanılamıyor. Lütfen backend\'in çalıştığından emin olun.');
        setStep(1);
        setVerifying(false);
        return;
      }

      const d = await res.json().catch(() => ({} as any));
      if (res.ok && d.success) {
        setEmail(d.email || '');
        setToken(tokenToVerify); // Token'ı state'e kaydet
        setStep(2); // Step 2'ye geç - şifre inputu görünecek
        console.log('✅ Token doğrulandı, Step 2\'ye geçiliyor - Şifre inputu görünecek');
        showSuccess('Link doğrulandı. Yeni şifrenizi belirleyebilirsiniz.');
      } else {
        hasVerifiedToken.current = false; // Hata durumunda tekrar denemeye izin ver
        const errorMsg = d?.error || 'Geçersiz veya süresi dolmuş link';
        console.warn('❌ Token verification failed:', errorMsg);
        showError(errorMsg);
        setStep(1);
        setToken(''); // Token'ı temizle
      }
    } catch (error: any) {
      hasVerifiedToken.current = false; // Hata durumunda tekrar denemeye izin ver
      console.error('❌ Token verification error:', error);
      showError('Link doğrulanamadı. Lütfen tekrar deneyin.');
      setStep(1);
      setToken(''); // Token'ı temizle
    } finally {
      setVerifying(false);
    }
  }, []);

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

  const handleDevCopy = React.useCallback(
    async (value: string, label: 'web' | 'native' | 'token') => {
      try {
        await Clipboard.setStringAsync(value);
        setCopyFeedback(label);
        setTimeout(() => setCopyFeedback(null), 2000);
        showSuccess('Panoya kopyalandı');
      } catch (error) {
        showError('Kopyalanamadı');
      }
    },
    [showError, showSuccess]
  );

  const openGmailInbox = React.useCallback(() => {
    Linking.openURL('https://mail.google.com').catch(() => {
      showError('Gmail açılamadı. Tarayıcıdan manuel olarak açmayı deneyin.');
    });
  }, [showError]);

  // Check if token exists in URL (deep linking support)
  useEffect(() => {
    const tokenParam = params.token;
    if (tokenParam && typeof tokenParam === 'string' && tokenParam.trim() && !hasVerifiedToken.current) {
      console.log('🔗 Token detected in URL:', tokenParam.substring(0, 10) + '...');
      setToken(tokenParam);
      verifyToken(tokenParam);
    }
  }, [params.token]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Progress bar animation
  useEffect(() => {
    Animated.timing(progress, {
      toValue: step / 3,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [step]);

  // Resend timer
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (resendTimer > 0) {
      t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [resendTimer]);

  // Password strength
  useEffect(() => {
    setPasswordScore(calcPasswordStrength(newPassword));
  }, [newPassword]);

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

  // Request reset link
  const requestResetLink = async () => {
    const clean = email.trim();
    if (!clean) {
      showError('E-posta giriniz');
      return;
    }
    if (!isValidEmail(clean)) {
      showError('Geçerli bir e-posta girin');
      return;
    }
    if (resendTimer > 0) return;

    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/auth/reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean }),
      });
      
      // Network hatası kontrolü
      if (!res.ok && res.status === 0) {
        showError('Backend sunucusuna bağlanılamıyor. Lütfen backend\'in çalıştığından emin olun.');
        setLoading(false);
        return;
      }
      
      const d = await res.json().catch(() => ({} as any));
      if (res.ok) {
        if (d?.via) setSentVia(d.via);
        if (d?.dev?.links) setDevLinks(d.dev.links);
        
        // Development modunda linkleri göster
        if (__DEV__ && d?.dev?.links) {
          console.log('🔗 Reset link (dev):', d.dev.links.web || d.dev.links.native);
        }
        
        showSuccess('Şifre sıfırlama linki e-postanıza gönderildi. Gmail kutunuzu kontrol edin.');
        startResendTimer(60);
      } else {
        // Daha açıklayıcı hata mesajları
        const errorMsg = d?.error || 'Link gönderilemedi';
        if (errorMsg.includes('429') || errorMsg.includes('çok fazla')) {
          showError('Çok fazla istek yapıldı. Lütfen 10 dakika sonra tekrar deneyin.');
        } else if (errorMsg.includes('bağlanılamıyor') || errorMsg.includes('network')) {
          showError('Backend sunucusuna bağlanılamıyor. Backend\'in çalıştığından emin olun.');
        } else {
          showError(errorMsg);
        }
      }
    } catch (error: any) {
      console.error('Reset password error:', error);
      // Daha detaylı hata mesajı
      if (error?.message?.includes('Network request failed') || error?.message?.includes('Failed to fetch')) {
        showError('Backend sunucusuna bağlanılamıyor. Lütfen backend\'in çalıştığından emin olun (http://localhost:4000)');
      } else {
        showError('Ağ hatası. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Confirm reset with token
  const confirmReset = async (): Promise<boolean> => {
    const cleanPw = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!token || !token.trim()) {
      showError('Geçersiz link. Lütfen e-postanızdaki linki kullanın.');
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
      showError('Parola en az 6 karakter olmalı');
      return false;
    }

    setLoading(true);
    try {
      console.log('🔄 Confirming password reset...');
      const res = await fetch(`${getApiBase()}/api/auth/reset/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          newPassword: cleanPw,
        }),
      });

      // Network hatası kontrolü
      if (!res.ok && res.status === 0) {
        showError('Backend sunucusuna bağlanılamıyor. Lütfen backend\'in çalıştığından emin olun.');
        setLoading(false);
        return false;
      }

      const d = await res.json().catch(() => ({} as any));
      if (res.ok && d.success) {
        console.log('✅ Password reset successful');
        showSuccess('Şifreniz güncellendi. Giriş yapabilirsiniz.');
        // Token'ı temizle
        setToken('');
        setNewPassword('');
        setConfirmPassword('');
        return true;
      } else {
        const errorMsg = d?.error || 'Şifre sıfırlanamadı';
        console.warn('❌ Password reset failed:', errorMsg);
        showError(errorMsg);
        return false;
      }
    } catch (error: any) {
      console.error('❌ Password reset error:', error);
      if (error?.message?.includes('Network request failed') || error?.message?.includes('Failed to fetch')) {
        showError('Backend sunucusuna bağlanılamıyor. Lütfen backend\'in çalıştığından emin olun.');
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

  const pwLabel =
    passwordScore >= 3 ? 'Güçlü' : passwordScore >= 2 ? 'Orta' : passwordScore >= 1 ? 'Zayıf' : '';
  const pwColor =
    passwordScore >= 3
      ? '#10b981'
      : passwordScore >= 2
      ? '#f59e0b'
      : passwordScore >= 1
      ? '#ef4444'
      : '#64748b';

  // If verifying token, show loading
  if (verifying) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#334155']}
        style={styles.gradient}
      >
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={styles.loadingContainer}>
            <Animated.View
              style={[
                styles.loadingIconContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: fadeAnim }],
                },
              ]}
            >
              <LinearGradient
                colors={['#06b6d4', '#3b82f6', '#8b5cf6']}
                style={styles.loadingIconGradient}
              >
                <Ionicons name="lock-closed" size={48} color="#ffffff" />
              </LinearGradient>
            </Animated.View>
            <Text style={styles.loadingText}>Link doğrulanıyor...</Text>
            <View style={styles.loadingDots}>
              <Animated.View style={[styles.loadingDot, { opacity: fadeAnim }]} />
              <Animated.View style={[styles.loadingDot, { opacity: fadeAnim }]} />
              <Animated.View style={[styles.loadingDot, { opacity: fadeAnim }]} />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#334155']}
        style={styles.gradient}
      >
        {/* Decorative background elements */}
        <Animated.View 
          style={[
            styles.decorativeCircle1,
            {
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.15],
              }),
            },
          ]} 
        />
        <Animated.View 
          style={[
            styles.decorativeCircle2,
            {
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.12],
              }),
            },
          ]} 
        />
        <Animated.View 
          style={[
            styles.decorativeCircle3,
            {
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.1],
              }),
            },
          ]} 
        />

        <SafeAreaView style={{ flex: 1 }}>
          {/* Header with back button */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBackPress}
              style={styles.backButton}
              accessibilityLabel="geri-don"
              activeOpacity={0.7}
            >
              <View style={styles.backButtonInner}>
                <Ionicons name="chevron-back" size={22} color="#E6EEF8" />
                <Text style={styles.backText}>Geri</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack} accessible accessibilityLabel="adim-ilerleme">
            <Animated.View
              style={[
                {
                  width: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                  height: 5,
                  borderRadius: 10,
                },
              ]}
            >
              <LinearGradient
                colors={['#06b6d4', '#3b82f6', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.progressFill}
              />
            </Animated.View>
          </View>

          <View style={styles.scrollContent}>
            <View style={styles.contentWrapper}>
              <View style={styles.stepper}>
              {stepMeta.map((item, index) => {
                const active = step >= item.id;
                return (
                  <View key={item.id} style={styles.stepItem}>
                    <View style={[styles.stepCircle, active && styles.stepCircleActive]}>
                      <Text style={[styles.stepCircleText, active && styles.stepCircleTextActive]}>
                        {item.id}
                      </Text>
                    </View>
                    <View style={styles.stepTexts}>
                      <Text style={[styles.stepTitle, active && styles.stepTitleActive]}>
                        {item.title}
                      </Text>
                    </View>
                    {index !== stepMeta.length - 1 && (
                      <View style={[styles.stepDivider, active && styles.stepDividerActive]} />
                    )}
                  </View>
                );
              })}
            </View>


              <Animated.View
                style={[
                  styles.content,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                {/* Logo - Only show in Step 1 */}
                {step === 1 && (
                  <Animated.View
                    style={[
                      styles.logoWrapper,
                      {
                        opacity: fadeAnim,
                        transform: [
                          {
                            scale: fadeAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.92, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <BrandLogo size={120} withSoftContainer={false} variant="default" />
                  </Animated.View>
                )}

                {/* Title */}
                {step !== 2 && (
                  <View style={styles.titleContainer}>
                    <Text style={styles.title}>Şifre Sıfırlama</Text>
                  </View>
                )}

              {/* Step 1: Email Input */}
              {step === 1 && (
                <View style={styles.form}>
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
                        <Ionicons name="mail-outline" size={16} color="#64748b" />
                      </View>
                    }
                    style={styles.input}
                  />

                  <View style={styles.helperCard}>
                    <Text style={styles.helperTitle}>Nasıl çalışır?</Text>
                    <View style={styles.bulletRow}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.bulletText}>E-postana tek kullanımlık bir link gönderiyoruz.</Text>
                    </View>
                    <View style={styles.bulletRow}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.bulletText}>Linki açtığında bu ekran otomatik olarak 2. adıma geçer.</Text>
                    </View>
                    <View style={styles.bulletRow}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.bulletText}>Link çalışmıyorsa token'ı manuel girebilirsin.</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.gmailButton} onPress={openGmailInbox} activeOpacity={0.85}>
                    <View style={styles.gmailIconCircle}>
                      <Ionicons name="mail" size={20} color="#0ea5e9" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gmailButtonText}>Gmail'i aç</Text>
                      <Text style={styles.gmailButtonSub}>Bavaxe'den gelen maili hızlıca bul</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={18} color="#38bdf8" />
                  </TouchableOpacity>

                  <Button
                    title={resendTimer > 0 ? `Tekrar gönder (${resendTimer}s)` : 'Link Gönder'}
                    onPress={requestResetLink}
                    loading={loading}
                    disabled={loading || resendTimer > 0 || !email.trim()}
                    style={styles.submitButton}
                    accessibilityLabel="link-gonder"
                  />

                  {!!sentVia && (
                    <Text style={styles.sentInfo}>
                      Gönderildi: {sentVia === 'email' ? 'Gmail servisi' : 'E-posta kuyruğu'} • Gelen kutunu kontrol et
                    </Text>
                  )}

                  {!!devLinks && (__DEV__) && (
                    <View style={styles.devHelperCard}>
                      <View style={styles.devHelperHeader}>
                        <Ionicons name="code-slash" size={16} color="#10b981" />
                        <Text style={styles.devHelperTitle}>Test modundasın</Text>
                      </View>
                      {!!devLinks.web && (
                        <View style={styles.devHelperRow}>
                          <Text style={styles.devLinkLabel}>Web</Text>
                          <View style={styles.devHelperActions}>
                            <TouchableOpacity
                              style={styles.devActionButton}
                              onPress={async () => {
                                const base = devLinks.web as string;
                                const url = Platform.OS === 'android' ? base.replace('localhost', '10.0.2.2') : base;
                                try { await Linking.openURL(url); } catch {}
                              }}
                            >
                              <Text style={styles.devActionText}>Aç</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.devActionButton}
                              onPress={() => handleDevCopy(devLinks.web as string, 'web')}
                            >
                              <Text style={styles.devActionText}>
                                {copyFeedback === 'web' ? 'Kopyalandı' : 'Kopyala'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                      {!!devLinks.native && (
                        <View style={styles.devHelperRow}>
                          <Text style={styles.devLinkLabel}>Native</Text>
                          <View style={styles.devHelperActions}>
                            <TouchableOpacity
                              style={styles.devActionButton}
                              onPress={async () => {
                                try { await Linking.openURL(devLinks.native as string); } catch {}
                              }}
                            >
                              <Text style={styles.devActionText}>Aç</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.devActionButton}
                              onPress={() => handleDevCopy(devLinks.native as string, 'native')}
                            >
                              <Text style={styles.devActionText}>
                                {copyFeedback === 'native' ? 'Kopyalandı' : 'Kopyala'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  <View style={styles.manualTokenWrapper}>
                    {isManualTokenMode ? (
                      <>
                        <Input
                          label="Token (32 karakter)"
                          placeholder="E-postadaki uzun karakter zinciri"
                          value={manualTokenValue}
                          onChangeText={setManualTokenValue}
                          autoCapitalize="none"
                          style={styles.tokenInput}
                          leftElement={
                            <View style={styles.iconCircle}>
                              <Ionicons name="key-outline" size={16} color="#64748b" />
                            </View>
                          }
                        />
                        <Button
                          title="Token'ı Doğrula"
                          onPress={handleManualTokenVerify}
                          disabled={!manualTokenValue.trim()}
                          style={styles.submitButton}
                        />
                        <TouchableOpacity
                          style={styles.manualTokenToggle}
                          onPress={() => setIsManualTokenMode(false)}
                        >
                          <Text style={styles.manualTokenToggleText}>Link isteme ekranına dön</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        onPress={() => setIsManualTokenMode(true)}
                        style={styles.manualTokenToggle}
                      >
                        <Text style={styles.manualTokenToggleText}>
                          Link açılmıyor mu? Token'ı manuel gir
                        </Text>
                      </TouchableOpacity>
                    )}

                    {!!clipboardSuggestion && (
                      <TouchableOpacity
                        style={styles.clipboardPill}
                        onPress={() => setManualTokenValue(clipboardSuggestion)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="clipboard-outline" size={14} color="#0ea5e9" />
                        <Text style={styles.clipboardPillText}>
                          Panodaki tokenı kullan ({clipboardSuggestion.slice(0, 6)}…)
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* Step 2: New Password */}
              {step === 2 && (
                <View style={styles.form}>
                  <Animated.View 
                    style={[
                      styles.emailInfo,
                      {
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                      },
                    ]}
                  >
                    <View style={styles.emailInfoIconWrapper}>
                      <Ionicons name="mail" size={18} color="#06b6d4" />
                    </View>
                    <Text style={styles.emailInfoText}>{maskedEmail}</Text>
                  </Animated.View>

                  {tokenPreview ? (
                    <View style={styles.tokenBadge}>
                      <Ionicons name="shield-checkmark-outline" size={18} color="#10b981" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tokenBadgeTitle}>Link doğrulandı</Text>
                        <Text style={styles.tokenBadgeText}>{tokenPreview}</Text>
                      </View>
                    </View>
                  ) : null}

                  <Input
                    label="Yeni Şifre"
                    placeholder="Yeni şifrenizi girin"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="password-new"
                    leftElement={
                      <View style={styles.iconCircle}>
                        <Ionicons name="lock-closed-outline" size={16} color="#64748b" />
                      </View>
                    }
                    rightElement={
                      <TouchableOpacity
                        onPress={() => setShowPassword((s) => !s)}
                        style={styles.iconCircle}
                        accessibilityLabel="toggle-password-visibility"
                      >
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={16}
                          color="#64748b"
                        />
                      </TouchableOpacity>
                    }
                    style={styles.input}
                    accessibilityLabel="new-password-input"
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
                        <Ionicons name="checkmark-circle-outline" size={16} color="#64748b" />
                      </View>
                    }
                    style={styles.input}
                  />
                  {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                    <Text style={styles.mismatchText}>Şifreler eşleşmiyor</Text>
                  )}

                  {/* Password Strength Meter */}
                  {newPassword.length > 0 && (
                    <Animated.View 
                      style={[
                        styles.passwordStrength,
                        {
                          opacity: fadeAnim,
                        },
                      ]}
                    >
                      <View style={styles.passwordStrengthHeader}>
                        <Text style={styles.passwordStrengthLabel}>Şifre Gücü:</Text>
                        <View style={[styles.passwordStrengthBadge, { backgroundColor: `${pwColor}20` }]}>
                          <Text style={[styles.passwordStrengthText, { color: pwColor }]}>
                            {pwLabel}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.passwordMeter}>
                        {[0, 1, 2, 3].map((i) => (
                          <Animated.View
                            key={i}
                            style={[
                              styles.passwordBar,
                              {
                                backgroundColor:
                                  i <= passwordScore - 1
                                    ? pwColor
                                    : 'rgba(255,255,255,0.08)',
                                transform: [
                                  {
                                    scale: i <= passwordScore - 1 ? 1 : 0.95,
                                  },
                                ],
                              },
                            ]}
                          />
                        ))}
                      </View>
                    </Animated.View>
                  )}

                  {/* Password Rules */}
                  <Animated.View 
                    style={[
                      styles.rulesContainer,
                      {
                        opacity: fadeAnim,
                      },
                    ]}
                  >
                    <View style={styles.ruleCard}>
                      <View style={styles.ruleRow}>
                        <View style={[
                          styles.ruleIconWrapper,
                          newPassword.length >= 6 && styles.ruleIconWrapperActive
                        ]}>
                          <Ionicons
                            name={newPassword.length >= 6 ? 'checkmark-circle' : 'ellipse-outline'}
                            size={18}
                            color={newPassword.length >= 6 ? '#10b981' : '#64748b'}
                          />
                        </View>
                        <Text
                          style={[
                            styles.ruleText,
                            newPassword.length >= 6 && styles.ruleTextActive,
                          ]}
                        >
                          En az 6 karakter
                        </Text>
                      </View>
                      <View style={styles.ruleRow}>
                        <View style={[
                          styles.ruleIconWrapper,
                          (/[A-Z]/.test(newPassword) || /[0-9]/.test(newPassword)) && styles.ruleIconWrapperActive
                        ]}>
                          <Ionicons
                            name={
                              /[A-Z]/.test(newPassword) || /[0-9]/.test(newPassword)
                                ? 'checkmark-circle'
                                : 'ellipse-outline'
                            }
                            size={18}
                            color={
                              /[A-Z]/.test(newPassword) || /[0-9]/.test(newPassword)
                                ? '#10b981'
                                : '#64748b'
                            }
                          />
                        </View>
                        <Text
                          style={[
                            styles.ruleText,
                            (/[A-Z]/.test(newPassword) || /[0-9]/.test(newPassword)) &&
                              styles.ruleTextActive,
                          ]}
                        >
                          Büyük harf veya rakam içermesi önerilir
                        </Text>
                      </View>
                    </View>
                  </Animated.View>

                  <View style={styles.passwordHintCard}>
                    <Text style={styles.helperTitle}>İpucu</Text>
                    <View style={styles.bulletRow}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.bulletText}>
                        Daha önce kullanmadığınız bir parola belirleyin.
                      </Text>
                    </View>
                    <View style={styles.bulletRow}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.bulletText}>
                        Harf, rakam ve sembolleri karıştırarak skoru yükseltebilirsiniz.
                      </Text>
                    </View>
                  </View>

                  <Button
                    title={
                      resendTimer > 0
                        ? `Linki tekrar gönder (${resendTimer}s)`
                        : 'Linki tekrar gönder'
                    }
                    onPress={requestResetLink}
                    disabled={!email.trim() || loading || resendTimer > 0}
                    style={[styles.submitButton, styles.secondaryButton]}
                    variant="secondary"
                  />

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
                    accessibilityLabel="sifreyi-sifirla"
                  />

                  <TouchableOpacity style={styles.footerLink} onPress={openGmailInbox}>
                    <Text style={[styles.footerLinkText, { color: '#38bdf8' }]}>
                      Mail gelmedi mi? Gmail'i yeniden aç
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.footerLink} onPress={() => setStep(1)}>
                    <Text style={[styles.footerLinkText, { color: '#fda4af' }]}>
                      Yanlış e-posta girdim
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Step 3: Success */}
              {step === 3 && (
                <Animated.View
                  style={[
                    styles.successContainer,
                    {
                      opacity: fadeAnim,
                      transform: [{ translateY: slideAnim }],
                    },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.successIconContainer,
                      {
                        transform: [
                          {
                            scale: fadeAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.5, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <View style={styles.successIconBackground}>
                      <Ionicons name="checkmark-circle" size={64} color="#10b981" />
                    </View>
                  </Animated.View>
                  <Text style={styles.successTitle}>Şifre Güncellendi</Text>
                  <Text style={styles.successSub}>
                    Yeni şifrenizle giriş yapabilirsiniz.
                  </Text>
                  <Button
                    title="Girişe Dön"
                    onPress={() => {
                      // Token ve şifre state'lerini temizle
                      setToken('');
                      setNewPassword('');
                      setEmail('');
                      router.replace('/auth/login');
                    }}
                    style={styles.submitButton}
                    accessibilityLabel="girise-don"
                  />
                </Animated.View>
              )}

              {/* Footer Link */}
              {step !== 3 && (
                <TouchableOpacity
                  onPress={() => router.replace('/auth/login')}
                  style={styles.footerLink}
                  accessibilityLabel="girise-geri-don"
                >
                  <Text style={styles.footerLinkText}>Giriş ekranına dön</Text>
                </TouchableOpacity>
              )}
              </Animated.View>
            </View>
          </View>

          <Toast
            message={toast.message}
            type={toast.type}
            visible={toast.visible}
            onHide={hideToast}
          />
        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

/* =========================
   STYLES
   ========================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    position: 'relative',
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    top: -150,
    right: -150,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    bottom: -100,
    left: -100,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 15,
  },
  decorativeCircle3: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    top: '35%',
    right: -50,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  backButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  backButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  backText: {
    color: '#E6EEF8',
    fontWeight: '700',
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 0.3,
  },
  progressTrack: {
    height: 4,
    marginHorizontal: 20,
    marginBottom: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    flex: 1,
    height: 5,
    borderRadius: 10,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 3,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  content: {
    width: '100%',
  },
  stepper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(148,163,184,0.4)',
    backgroundColor: 'rgba(148,163,184,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  stepCircleActive: {
    backgroundColor: 'rgba(16,185,129,0.25)',
    borderColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  stepCircleText: {
    color: '#94a3b8',
    fontWeight: '700',
  },
  stepCircleTextActive: {
    color: '#10b981',
  },
  stepTexts: {
    marginTop: 6,
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  stepTitleActive: {
    color: '#e2e8f0',
    fontWeight: '700',
  },
  stepDivider: {
    position: 'absolute',
    top: 16,
    right: -6,
    width: 12,
    height: 1.5,
    backgroundColor: 'rgba(148,163,184,0.3)',
  },
  stepDividerActive: {
    backgroundColor: '#10b981',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 8,
    marginBottom: 8,
  },
  titleContainer: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
    textAlign: 'center',
    fontFamily: 'Poppins-Bold',
  },
  form: {
    width: '100%',
  },
  input: {
    marginBottom: 4,
  },
  helperCard: {
    marginTop: 12,
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    gap: 10,
  },
  helperTitle: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    backgroundColor: '#38bdf8',
  },
  bulletText: {
    flex: 1,
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  gmailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(8,145,178,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.25)',
    marginBottom: 12,
  },
  gmailIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(14,165,233,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gmailButtonText: {
    color: '#e0f2fe',
    fontSize: 16,
    fontWeight: '700',
  },
  gmailButtonSub: {
    color: '#bae6fd',
    fontSize: 12,
  },
  sentInfo: {
    color: '#38bdf8',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  devHelperCard: {
    marginTop: 6,
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
    gap: 10,
  },
  devHelperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  devHelperTitle: {
    color: '#d1fae5',
    fontWeight: '700',
  },
  devHelperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  devLinkLabel: {
    color: '#bbf7d0',
    fontSize: 12,
  },
  devHelperActions: {
    flexDirection: 'row',
    gap: 8,
  },
  devActionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(15,118,110,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.4)',
  },
  devActionText: {
    color: '#ccfbf1',
    fontSize: 12,
    fontWeight: '600',
  },
  manualTokenWrapper: {
    marginTop: 4,
    gap: 8,
  },
  tokenInput: {
    marginBottom: 8,
  },
  manualTokenToggle: {
    alignSelf: 'center',
    marginTop: 4,
  },
  manualTokenToggleText: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  clipboardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(14,165,233,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.3)',
  },
  clipboardPillText: {
    color: '#bae6fd',
    fontSize: 12,
    fontWeight: '600',
  },
  iconCircle: {
    width: 30,
    height: 30,
    left: -4,
    marginTop: -12,
    borderRadius: 15,
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    marginTop: 2,
    marginBottom: 0,
  },
  emailInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
  },
  emailInfoIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailInfoText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 0.3,
  },
  tokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  tokenBadgeTitle: {
    color: '#d1fae5',
    fontSize: 13,
    fontWeight: '700',
  },
  tokenBadgeText: {
    color: '#86efac',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  passwordStrength: {
    marginTop: 8,
    marginBottom: 10,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  passwordStrengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  passwordStrengthLabel: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 0.3,
  },
  passwordStrengthBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.4,
  },
  passwordMeter: {
    flexDirection: 'row',
    gap: 8,
    height: 8,
  },
  passwordBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  rulesContainer: {
    marginTop: 6,
    marginBottom: 10,
  },
  ruleCard: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ruleIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  ruleIconWrapperActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  ruleText: {
    color: '#94a3b8',
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    letterSpacing: 0.2,
    flex: 1,
  },
  ruleTextActive: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  mismatchText: {
    color: '#fca5a5',
    fontSize: 12,
    marginBottom: 8,
  },
  passwordHintCard: {
    marginTop: 8,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(248,250,252,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    gap: 8,
  },
  secondaryButton: {
    marginTop: 12,
  },
  successContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  successIconContainer: {
    marginBottom: 12,
  },
  successTitle: {
    color: '#E6EEF8',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  successSub: {
    color: '#cbd5e1',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'Poppins-Medium',
  },
  footerLink: {
    alignSelf: 'center',
    marginTop: 4,
    paddingVertical: 2,
  },
  footerLinkText: {
    color: '#9fb7ff',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
    fontFamily: 'Poppins-SemiBold',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  loadingIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  loadingIconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  loadingText: {
    color: '#E6EEF8',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.8,
    marginTop: 24,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#06b6d4',
  },
  successMessageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  devLinkText: {
    color: '#60a5fa',
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    letterSpacing: 0.3,
  },
  successIconBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
});
