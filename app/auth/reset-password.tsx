import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions
} from 'react-native';
import { BrandLogo } from '../../components/BrandLogo';
import { PremiumBackground } from '../../components/PremiumBackground';
import { Toast, useToast } from '../../components/Toast';
import { Button } from '../../components/ui/Button/index';
import { Input } from '../../components/ui/Input/index';
import { VerificationCodeInput } from '../../components/ui/VerificationCodeInput';
import { getApiBase } from '../../utils/api';
import {
  validateEmailTR,
  validatePasswordTR,
  validatePasswordMatchTR,
  validateVerificationCodeTR,
  calculatePasswordStrength,
  getPasswordStrengthLabel,
  getPasswordStrengthColor
} from '../../utils/validation';

const { width } = Dimensions.get('window');

// Separate component for internal imports if needed
const ActivityIndicator = require('react-native').ActivityIndicator;

// Animated Bubbles Component for Premium Loading
function AnimatedBubbles() {
  const bubble1 = useRef(new Animated.Value(0)).current;
  const bubble2 = useRef(new Animated.Value(0)).current;
  const bubble3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (bubble: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(bubble, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(bubble, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animate(bubble1, 0);
    animate(bubble2, 400);
    animate(bubble3, 800);
  }, []);

  const createBubbleStyle = (animValue: Animated.Value, left: string) => ({
    position: 'absolute' as const,
    left,
    bottom: '30%',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    opacity: animValue.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.3, 0.8, 0.3],
    }),
    transform: [
      {
        translateY: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -100],
        }),
      },
      {
        scale: animValue.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.8, 1.2, 0.8],
        }),
      },
    ],
  });

  return (
    <>
      <Animated.View style={createBubbleStyle(bubble1, '20%')} />
      <Animated.View style={createBubbleStyle(bubble2, '50%')} />
      <Animated.View style={createBubbleStyle(bubble3, '80%')} />
    </>
  );
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; email?: string; fromSettings?: string }>();
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

  // Smooth animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (resendTimer > 0) {
      t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    }
    return () => { if (t) clearTimeout(t); };
  }, [resendTimer]);

  useEffect(() => {
    setPasswordScore(calculatePasswordStrength(newPassword));
  }, [newPassword]);

  // Clipboard Logic
  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      (async () => {
        try {
          const content = await Clipboard.getStringAsync();
          if (active && content && content.trim().length === 6 && /^\d+$/.test(content.trim())) {
            setClipboardSuggestion(content.trim());
          }
        } catch (_) { }
      })();
      return () => { active = false; };
    }, [])
  );

  React.useEffect(() => {
    if (params.email && typeof params.email === 'string' && params.email.trim()) {
      setEmail(params.email.trim());
    }
  }, [params.email]);

  const startResendTimer = (seconds: number) => {
    setResendTimer(seconds);
  };

  const verifyToken = React.useCallback(async (tokenToVerify: string) => {
    if (hasVerifiedToken.current) return;
    if (!email.trim() || !tokenToVerify.trim() || !/^\d{6}$/.test(tokenToVerify.trim())) {
      showError('Lütfen geçerli bir token ve e-posta girin.');
      return;
    }

    hasVerifiedToken.current = true;
    setVerifying(true);

    try {
      const apiBase = getApiBase();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${apiBase}/api/auth/reset/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: tokenToVerify.trim() }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const d = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(d.error || 'Kod doğrulanamadı.');
      }

      setToken(tokenToVerify.trim());
      setStep(2);
      showSuccess('Kod başarıyla doğrulandı.');
    } catch (error: any) {
      hasVerifiedToken.current = false;
      showError(error.message || 'Bir hata oluştu.');
      setStep(1);
    } finally {
      setVerifying(false);
    }
  }, [email, showError, showSuccess]);

  const [emailLocked, setEmailLocked] = useState(!!params.email);

  const requestResetLink = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showError('Geçerli bir e-posta adresi girin.');
      return;
    }
    setLoading(true);
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/auth/reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const d = await res.json().catch(() => ({}));

      if (res.ok) {
        showSuccess(d.message || 'Doğrulama kodu gönderildi.');
        setIsManualTokenMode(true);
        setEmailLocked(true); // Lock email after successful code send
        startResendTimer(60);
        if (clipboardSuggestion) setManualTokenValue(clipboardSuggestion);
      } else {
        showError(d.error || 'İstek başarısız oldu.');
      }
    } catch (e) {
      showError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async () => {
    if (newPassword !== confirmPassword) {
      showError('Şifreler eşleşmiyor.');
      return;
    }
    if (passwordScore < 2) {
      showError('Şifre çok zayıf.');
      return;
    }
    setLoading(true);
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/auth/reset/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: token, newPassword: newPassword.trim() })
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setStep(3);
        showSuccess('Şifreniz başarıyla sıfırlandı.');
        setTimeout(() => router.replace('/auth/login'), 2000);
      } else {
        showError(d.error || 'Sıfırlama başarısız.');
      }
    } catch (e) {
      showError('Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualTokenVerify = () => {
    verifyToken(manualTokenValue);
  };

  const handleBackPress = () => {
    if (step === 2) { setStep(1); return true; }
    if (step === 3) { router.replace('/auth/login'); return true; }
    router.back();
    return true;
  };

  useFocusEffect(
    React.useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      return () => sub.remove();
    }, [step])
  );

  // Render password strength meter
  const renderPasswordStrength = () => (
    <View style={styles.strengthContainer}>
      <View style={styles.meterContainer}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.meterBar,
              {
                backgroundColor: i <= passwordScore
                  ? (passwordScore > 2 ? '#10b981' : passwordScore > 1 ? '#0EA5E9' : '#ef4444')
                  : 'rgba(255,255,255,0.1)'
              }
            ]}
          />
        ))}
      </View>
      <Text style={[
        styles.strengthText,
        { color: passwordScore > 2 ? '#10b981' : passwordScore > 1 ? '#0EA5E9' : '#64748b' }
      ]}>
        {passwordScore === 0 ? 'Şifre Giriniz' :
          passwordScore < 2 ? 'Zayıf' :
            passwordScore < 3 ? 'Orta' : 'Güçlü'}
      </Text>
    </View>
  );

  const getHeaderContent = () => {
    if (step === 1) {
      if (isManualTokenMode) {
        return {
          title: 'Kodu Onayla',
          subtitle: 'Gelen 6 haneli kodu gir',
          icon: 'keypad'
        };
      }
      return {
        title: 'Hesap Kurtarma',
        subtitle: 'Şifreni güvenle sıfırla',
        icon: 'shield-checkmark'
      };
    }
    if (step === 2) {
      return {
        title: 'Yeni Şifre',
        subtitle: 'Güçlü bir şifre oluştur',
        icon: 'lock-closed'
      };
    }
    return {
      title: 'İşlem Başarılı',
      subtitle: 'Hesabın artık güvende',
      icon: 'checkmark-circle'
    };
  };

  const { title, subtitle, icon } = getHeaderContent();

  if (verifying) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#020617', '#111827', '#1e293b']} style={styles.gradient}>
          <StatusBar barStyle="light-content" />
          <View style={styles.verifyingContainer}>
            <AnimatedBubbles />
            <ActivityIndicator size="large" color="#0EA5E9" />
            <Text style={styles.verifyingText}>Doğrulanıyor...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#020617', '#0f172a', '#1e293b']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <StatusBar barStyle="light-content" />
        <PremiumBackground color="#06B6D4" lineCount={8} circleCount={5} />

        <SafeAreaWrapper>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardAvoid}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Top Navigation */}
              <View style={styles.navBar}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.backButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Enhanced Header Section */}
              <View style={styles.header}>
                {step === 1 && !isManualTokenMode ? (
                  <View style={styles.brandContainer}>
                    <BrandLogo style={{ top: 140 }} size={320} withSoftContainer={false} variant="large" />
                  </View>
                ) : (
                  <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
                    <LinearGradient
                      colors={['rgba(6, 182, 212, 0.2)', 'rgba(59, 130, 246, 0.1)']}
                      style={styles.iconGradient}
                    >
                      <Ionicons name={icon as any} size={32} color="#22d3ee" />
                    </LinearGradient>
                  </Animated.View>
                )}

                <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
                  {title}
                </Animated.Text>
                <Animated.Text style={[styles.subtitle, { opacity: fadeAnim }]}>
                  {subtitle}
                </Animated.Text>
              </View>

              {/* Refined Form Section */}
              <Animated.View
                style={[
                  styles.formCard,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  }
                ]}
              >
                {/* Step 1: Email + Code Entry */}
                {step === 1 && (
                  <>
                    <View style={styles.inputGroup}>
                      <Input
                        label="E-posta Adresi"
                        placeholder="ornek@email.com"
                        value={email}
                        onChangeText={!emailLocked ? setEmail : undefined}
                        editable={!emailLocked}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        style={[
                          styles.inputCustom,
                          emailLocked && styles.inputLocked
                        ]}
                        leftElement={
                          <View style={styles.inputIconContainer}>
                            <Ionicons
                              name={emailLocked ? "lock-closed" : "mail-outline"}
                              size={18}
                              color={emailLocked ? "#f59e0b" : "#94a3b8"}
                            />
                          </View>
                        }
                        rightElement={
                          emailLocked ? (
                            <View style={styles.lockedBadge}>
                              <Ionicons name="shield-checkmark" size={14} color="#f59e0b" />
                              <Text style={styles.lockedText}>Kilitli</Text>
                            </View>
                          ) : undefined
                        }
                      />
                      {emailLocked && (
                        <Text style={styles.lockedHint}>
                          {isManualTokenMode
                            ? `Doğrulama kodu ${email} adresine gönderildi`
                            : 'Bu e-posta adresi güvenlik nedeniyle kilitlenmiştir'}
                        </Text>
                      )}
                    </View>

                    {isManualTokenMode ? (
                      <>
                        <View style={styles.verificationCodeContainer}>
                          <Text style={styles.verificationCodeLabel}>Doğrulama Kodu</Text>
                          <VerificationCodeInput
                            value={manualTokenValue}
                            onChangeText={setManualTokenValue}
                            length={6}
                            loading={loading}
                            autoFocus={true}
                          />
                          <Text style={styles.verificationCodeHint}>
                            E-postanıza gönderilen 6 haneli kodu girin
                          </Text>
                        </View>
                        <Button
                          title="Doğrula ve Devam Et"
                          onPress={handleManualTokenVerify}
                          loading={loading}
                          style={styles.primaryButton}
                        />

                        {/* Resend Code Button */}
                        <TouchableOpacity
                          onPress={requestResetLink}
                          disabled={resendTimer > 0 || loading}
                          style={[
                            styles.resendButton,
                            (resendTimer > 0 || loading) && styles.resendButtonDisabled
                          ]}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="refresh-outline"
                            size={16}
                            color={resendTimer > 0 || loading ? "#64748b" : "#0EA5E9"}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={[
                            styles.resendButtonText,
                            (resendTimer > 0 || loading) && styles.resendButtonTextDisabled
                          ]}>
                            {resendTimer > 0 ? `Tekrar Gönder (${resendTimer}s)` : 'Kodu Tekrar Gönder'}
                          </Text>
                        </TouchableOpacity>

                        {/* Cancel/Back Button */}
                        <View style={styles.cancelButtonContainer}>
                          <TouchableOpacity
                            onPress={() => {
                              setIsManualTokenMode(false);
                              setManualTokenValue('');
                              // Only allow unlocking email if not from settings
                              if (!params.email) {
                                setEmailLocked(false);
                              }
                            }}
                            style={styles.textButton}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="arrow-back-outline" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                            <Text style={styles.textButtonText}>
                              {params.email ? 'Geri' : 'E-postayı Değiştir'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <>
                        <Button
                          title={resendTimer > 0 ? `Tekrar Gönder (${resendTimer})` : loading ? 'Gönderiliyor...' : 'Doğrulama Kodu Gönder'}
                          onPress={requestResetLink}
                          loading={loading}
                          disabled={resendTimer > 0}
                          style={styles.primaryButton}
                        />

                        {/* Enhanced 'I have a code' Action Card */}
                        <TouchableOpacity
                          onPress={() => setIsManualTokenMode(true)}
                          activeOpacity={0.9}
                          style={styles.actionCard}
                        >
                          <View style={styles.actionCardIcon}>
                            <Ionicons name="key-outline" size={20} color="#f59e0b" />
                          </View>
                          <View style={styles.actionCardContent}>
                            <Text style={styles.actionCardTitle}>Doğrulama kodunuz var mı?</Text>
                            <Text style={styles.actionCardSubtitle}>Manuel giriş yapmak için tıklayın</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color="#64748b" />
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                )}

                {/* Step 2: New Password */}
                {step === 2 && (
                  <>
                    <View style={styles.inputGroup}>
                      <Input
                        label="Yeni Şifre"
                        placeholder="En az 6 karakter"
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        style={styles.inputCustom}
                        leftElement={
                          <View style={styles.inputIconContainer}>
                            <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" />
                          </View>
                        }
                        rightElement={
                          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ paddingHorizontal: 10 }}>
                            <Ionicons
                              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                              size={18}
                              color="#94a3b8"
                            />
                          </TouchableOpacity>
                        }
                      />
                      {renderPasswordStrength()}
                    </View>

                    <View style={styles.inputGroup}>
                      <Input
                        label="Şifre Tekrar"
                        placeholder="Şifreyi onayla"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        style={styles.inputCustom}
                        leftElement={
                          <View style={styles.inputIconContainer}>
                            <Ionicons name="shield-outline" size={18} color="#94a3b8" />
                          </View>
                        }
                      />
                    </View>

                    <Button
                      title="Şifreyi Güncelle"
                      onPress={confirmReset}
                      loading={loading}
                      style={styles.primaryButton}
                    />
                  </>
                )}

                {/* Step 3: Success */}
                {step === 3 && (
                  <View style={styles.successContainer}>
                    <View style={styles.successIconBubble}>
                      <Ionicons name="checkmark" size={40} color="#fff" />
                    </View>
                    <Text style={styles.successText}>Şifreniz başarıyla yenilendi</Text>
                    <Text style={styles.successSubText}>Giriş sayfasına yönlendiriliyorsunuz...</Text>

                    <Button
                      title="Giriş Yap"
                      onPress={() => router.replace('/auth/login')}
                      style={styles.primaryButton}
                    />
                  </View>
                )}
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaWrapper>

        <Toast
          message={toast.message}
          type={toast.type}
          visible={toast.visible}
          onHide={hideToast}
        />
      </LinearGradient>
    </View>
  );
}

const SafeAreaWrapper = ({ children }: { children: React.ReactNode }) => {
  const insets = require('react-native-safe-area-context').useSafeAreaInsets();
  return <View style={{ flex: 1, paddingTop: insets.top }}>{children}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  gradient: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  glowEffect: {
    position: 'absolute',
    top: -100,
    left: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    transform: [{ scale: 1.5 }],
  },
  glowEffectBottom: {
    position: 'absolute',
    bottom: -50,
    right: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    transform: [{ scale: 1.5 }],
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    marginTop: -200,
    paddingBottom: 40,
  },
  navBar: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    top: 210,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 10,
  },
  brandContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    fontFamily: 'Poppins-Regular',
    lineHeight: 20,
    maxWidth: '85%',
  },
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputCustom: {
    // Ensuring specific visual height and alignment for placeholders
    textAlignVertical: 'center',
    paddingTop: 0, // Reset default padding that might push placeholder
    paddingBottom: 0,
    justifyContent: 'center',
    height: 52, // Explicit fixed height for consistency
  },
  inputIconContainer: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: '#0EA5E9',
    height: 52,
    borderRadius: 14,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionCardContent: {
    flex: 1,
  },
  actionCardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 2,
  },
  actionCardSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
  },
  textButton: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    flexDirection: 'row',
  },
  cancelButtonContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  textButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  meterContainer: {
    flexDirection: 'row',
    flex: 1,
    gap: 6,
    marginRight: 15
  },
  meterBar: {
    height: 4,
    flex: 1,
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successIconBubble: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successText: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: '#fff',
    marginTop: 8,
    textAlign: 'center',
  },
  successSubText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#94a3b8',
    marginTop: 8,
    marginBottom: 32,
    textAlign: 'center',
  },
  verifyingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  verifyingText: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#cbd5e1',
    marginTop: 20,
  },
  inputLocked: {
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 2,
  },
  inputCustom: {
    color: '#ffffff',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  lockedText: {
    fontSize: 11,
    fontFamily: 'Poppins-SemiBold',
    color: '#f59e0b',
    letterSpacing: 0.5,
  },
  lockedHint: {
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
    color: '#94a3b8',
    marginTop: 6,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.3)',
  },
  resendButtonDisabled: {
    backgroundColor: 'rgba(100, 116, 139, 0.05)',
    borderColor: 'rgba(100, 116, 139, 0.2)',
  },
  resendButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#0EA5E9',
  },
  resendButtonTextDisabled: {
    color: '#64748b',
  },
  verificationCodeContainer: {
    marginBottom: 20,
  },
  verificationCodeLabel: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#cbd5e1',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  verificationCodeHint: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});
