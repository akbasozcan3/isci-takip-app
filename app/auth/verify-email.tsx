import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { BrandLogo } from '../../components/BrandLogo';
import { Toast, useToast } from '../../components/Toast';
import { Button } from '../../components/ui/Button';
import { getApiBase } from '../../utils/api';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const email = (params.email as string) || '';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const hiddenInputRef = useRef<TextInput>(null);

  // Smooth animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cursorBlink = useRef(new Animated.Value(1)).current;

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
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for mail icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Cursor blink animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(cursorBlink, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(cursorBlink, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Update code when digits change
  useEffect(() => {
    const fullCode = codeDigits.join('');
    setCode(fullCode);
    if (fullCode.length === 6) {
      // Auto verify when 6 digits entered
      handleVerify();
    }
  }, [codeDigits]);

  const handleVerify = async () => {
    const fullCode = codeDigits.join('');
    if (!fullCode.trim() || fullCode.length !== 6) {
      showError('Lütfen 6 haneli doğrulama kodunu girin');
      return;
    }

    setLoading(true);
    try {
      // Verify the code
      const verifyResponse = await fetch(`${getApiBase()}/api/auth/pre-verify-email/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: fullCode.trim() }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        showError(verifyData.error || 'Geçersiz doğrulama kodu');
        // Clear code on error
        setCodeDigits(['', '', '', '', '', '']);
        setFocusedIndex(0);
        return;
      }

      showSuccess('E-posta doğrulandı! Giriş yapılıyor...');

      // Auto-login: Check if user already exists and has password
      try {
        // Try to get user info to check if account is complete
        const userCheckResponse = await fetch(`${getApiBase()}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: email.trim(),
            // We don't have password here, so this will fail
            // But we use it to check if user exists
            password: '__check_only__'
          }),
        });

        // If user doesn't exist or password not set, redirect to login
        // User needs to complete registration or login manually
        setTimeout(() => {
          router.replace('/auth/login');
        }, 1000);
      } catch (error) {
        // On any error, just redirect to login
        setTimeout(() => {
          router.replace('/auth/login');
        }, 1000);
      }
    } catch (error) {
      console.error('Verify error:', error);
      showError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setSending(true);
    try {
      const response = await fetch(`${getApiBase()}/api/auth/pre-verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        showError(data.error || 'Kod gönderilemedi');
        return;
      }

      // Backend automatically sends email via Python service
      // Just show success message
      if (response.ok) {
        showSuccess('Yeni doğrulama kodu e-posta adresinize gönderildi');
      }
    } catch (error) {
      console.error('Resend error:', error);
      showError('Kod gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSending(false);
    }
  };

  const handleCodeChange = (text: string, index: number) => {
    if (text.length > 1) {
      // Handle paste
      const digits = text.slice(0, 6).split('');
      const newDigits = [...codeDigits];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newDigits[index + i] = digit;
        }
      });
      setCodeDigits(newDigits);
      setFocusedIndex(Math.min(index + digits.length, 5));
    } else {
      // Handle single digit
      const newDigits = [...codeDigits];
      newDigits[index] = text.replace(/[^0-9]/g, '');
      setCodeDigits(newDigits);
      if (text && index < 5) {
        setFocusedIndex(index + 1);
      }
    }
  };

  const handleBackspace = (index: number) => {
    const newDigits = [...codeDigits];
    if (newDigits[index]) {
      newDigits[index] = '';
    } else if (index > 0) {
      newDigits[index - 1] = '';
      setFocusedIndex(index - 1);
    }
    setCodeDigits(newDigits);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#334155']}
        style={styles.gradient}
      >
        <StatusBar barStyle="light-content" />
        <View style={styles.decorativeCircle1} />
        <View style={styles.decorativeCircle2} />
        <View style={styles.decorativeCircle3} />

        <View style={styles.content}>
          <Animated.View 
            style={[
              styles.header,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            <View style={styles.logoWrapper}>
              <BrandLogo size={70} withSoftContainer={false} variant="default" />
            </View>

            <Animated.View 
              style={[
                styles.iconContainer,
                {
                  transform: [{ scale: pulseAnim }],
                }
              ]}
            >
              <LinearGradient
                colors={['#06b6d4', '#7c3aed']}
                style={styles.iconGradient}
                start={[0, 0]}
                end={[1, 1]}
              >
                <Ionicons name="mail" size={48} color="#fff" />
              </LinearGradient>
            </Animated.View>

            <View style={styles.titleContainer}>
              <Text style={styles.title}>E-posta Doğrula</Text>
              <Text style={styles.subtitle}>
                <Text style={styles.emailHighlight}>{email}</Text> adresine gönderilen{'\n'}
                6 haneli doğrulama kodunu girin
              </Text>
            </View>
          </Animated.View>

          <Animated.View 
            style={[
              styles.form,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              }
            ]}
          >
            {/* Email Info Card */}
            <View style={styles.emailCard}>
              <View style={styles.emailCardHeader}>
                <Ionicons name="mail-outline" size={20} color="#06b6d4" />
                <Text style={styles.emailCardTitle}>Doğrulanacak E-posta</Text>
              </View>
              <Text style={styles.emailCardText}>{email}</Text>
            </View>

              {/* Code Input Grid */}
            <View style={styles.codeContainer}>
              <Text style={styles.codeLabel}>Doğrulama Kodu</Text>
              <View style={styles.codeGrid}>
                {codeDigits.map((digit, index) => (
                  <Pressable
                    key={index}
                    onPress={() => {
                      setFocusedIndex(index);
                      hiddenInputRef.current?.focus();
                    }}
                    style={({ pressed }) => [
                      styles.codeDigit,
                      focusedIndex === index && styles.codeDigitFocused,
                      digit && styles.codeDigitFilled,
                      pressed && styles.codeDigitPressed,
                    ]}
                  >
                    <Text style={styles.codeDigitText}>{digit || '•'}</Text>
                    {focusedIndex === index && !digit && (
                      <Animated.View 
                        style={[
                          styles.codeCursor,
                          {
                            opacity: cursorBlink,
                          }
                        ]} 
                      />
                    )}
                  </Pressable>
                ))}
              </View>
              
              {/* Hidden input for keyboard */}
              <TextInput
                ref={hiddenInputRef}
                value={code}
                onChangeText={(text: string) => {
                  const digits = text.replace(/[^0-9]/g, '').slice(0, 6).split('');
                  const newDigits: string[] = [...Array(6).fill('')];
                  digits.forEach((digit: string, i: number) => {
                    newDigits[i] = digit;
                  });
                  setCodeDigits(newDigits);
                  setFocusedIndex(Math.min(digits.length, 5));
                }}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.hiddenInput}
                autoFocus
                autoComplete="off"
              />
            </View>

            {/* Security Warning */}
            <View style={styles.warningCard}>
              <View style={styles.warningHeader}>
                <Ionicons name="shield-checkmark" size={20} color="#f59e0b" />
                <Text style={styles.warningTitle}>Güvenlik Uyarısı</Text>
              </View>
              <Text style={styles.warningText}>
                Bu kodu kimseyle paylaşmayın. Eğer bu işlemi siz yapmadıysanız, 
                bu e-postayı görmezden gelebilirsiniz.
              </Text>
            </View>

            <Button
              title={loading ? 'Doğrulanıyor...' : 'Doğrula ve Devam Et'}
              onPress={handleVerify}
              loading={loading}
              style={styles.button}
            />

            <TouchableOpacity
              onPress={handleResendCode}
              disabled={sending}
              style={styles.resendButton}
            >
              <Ionicons name="refresh" size={16} color="#06b6d4" />
              <Text style={styles.resendText}>
                {sending ? 'Gönderiliyor...' : 'Kodu Tekrar Gönder'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/auth/login')}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={16} color="#94a3b8" />
              <Text style={styles.backText}>Giriş sayfasına dön</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
        <Toast
          message={toast.message}
          type={toast.type}
          visible={toast.visible}
          onHide={hideToast}
        />
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

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
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    top: -100,
    right: -100,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    bottom: -50,
    left: -50,
  },
  decorativeCircle3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
    top: '40%',
    right: -30,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    width: '100%',
  },
  logoWrapper: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  titleContainer: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 12,
    letterSpacing: 0.5,
    textAlign: 'center',
    fontFamily: 'Poppins-Bold',
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 24,
    fontWeight: '500',
    fontFamily: 'Poppins-Regular',
  },
  emailHighlight: {
    color: '#06b6d4',
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
  },
  form: {
    width: '100%',
  },
  emailCard: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
  },
  emailCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  emailCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#06b6d4',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Poppins-SemiBold',
  },
  emailCardText: {
    fontSize: 15,
    color: '#cbd5e1',
    fontWeight: '600',
    fontFamily: 'Poppins-Medium',
  },
  codeContainer: {
    marginBottom: 24,
  },
  codeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    fontFamily: 'Poppins-SemiBold',
  },
  codeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  codeDigit: {
    flex: 1,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(100, 116, 139, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  codeDigitFocused: {
    borderColor: '#06b6d4',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  codeDigitFilled: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  codeDigitPressed: {
    transform: [{ scale: 0.95 }],
  },
  codeDigitText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
  codeCursor: {
    position: 'absolute',
    width: 2,
    height: 24,
    backgroundColor: '#06b6d4',
    bottom: 12,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  warningCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f59e0b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Poppins-SemiBold',
  },
  warningText: {
    fontSize: 13,
    color: '#fbbf24',
    lineHeight: 18,
    fontFamily: 'Poppins-Regular',
  },
  button: {
    marginTop: 8,
    marginBottom: 0,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    gap: 8,
  },
  resendText: {
    color: '#06b6d4',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 12,
    gap: 8,
  },
  backText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Poppins-Regular',
  },
});
