import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Toast, useToast } from '../../components/Toast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { authFetch } from '../../utils/auth';

export default function EditProfileScreen() {
  const router = useRouter();
  const { toast, showError, showSuccess, hideToast } = useToast();
  
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [displayName, setDisplayName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  
  const formatPhoneNumber = (text: string): string => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length === 0) return '';
    
    let digits = cleaned;
    if (cleaned.startsWith('90') && cleaned.length > 2) {
      digits = cleaned.slice(2);
    } else if (cleaned.startsWith('0') && cleaned.length > 1) {
      digits = cleaned.slice(1);
    }
    
    if (digits.length > 10) {
      digits = digits.slice(0, 10);
    }
    
    if (digits.length === 0) return '+90 ';
    if (digits.length <= 3) return `+90 ${digits}`;
    if (digits.length <= 6) return `+90 ${digits.slice(0, 3)} ${digits.slice(3)}`;
    if (digits.length <= 8) return `+90 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    return `+90 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
  };
  
  const handlePhoneChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setPhone(formatted);
  };
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [forgotPassword, setForgotPassword] = React.useState(false);
  const [verificationCode, setVerificationCode] = React.useState('');
  const [codeDigits, setCodeDigits] = React.useState(['', '', '', '', '', '']);
  const [sendingCode, setSendingCode] = React.useState(false);
  const [codeSent, setCodeSent] = React.useState(false);
  const [codeVerified, setCodeVerified] = React.useState(false);
  const [checkingCode, setCheckingCode] = React.useState(false);
  
  const scrollViewRef = React.useRef<ScrollView>(null);
  const passwordInputRef = React.useRef<any>(null);
  const passwordSectionRef = React.useRef<View>(null);

  React.useEffect(() => {
    loadProfile();
  }, []);

  // Kod doğrulandığında şifre inputlarına scroll yap
  React.useEffect(() => {
    if (codeVerified && verificationCode.length === 6) {
      // Şifre inputlarına scroll yap
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: 500, // Şifre bölümünün yaklaşık konumu
          animated: true,
        });
        // İlk şifre inputuna focus yap
        setTimeout(() => {
          passwordInputRef.current?.focus?.();
        }, 500);
      }, 300);
    }
  }, [codeVerified, verificationCode]);

  // Doğrulama kodu 6 hane olduğunda backend üzerinde doğrula
  React.useEffect(() => {
    let isActive = true;
    const shouldVerify = forgotPassword && verificationCode.length === 6 && !codeVerified;
    if (!shouldVerify) {
      if (verificationCode.length < 6 && codeVerified) {
        setCodeVerified(false);
      }
      return () => {
        isActive = false;
      };
    }

    (async () => {
      try {
        setCheckingCode(true);
        const response = await authFetch('/auth/profile/verify-password-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: verificationCode }),
        });
        const data = await response.json();

        if (!isActive) return;

        if (response.ok) {
          setCodeVerified(true);
          showSuccess('Kod doğrulandı! Yeni şifrenizi girebilirsiniz.');
        } else {
          setCodeVerified(false);
          showError(data.error || 'Kod doğrulanamadı');
        }
      } catch (error) {
        console.error('Verify password code error:', error);
        if (isActive) {
          setCodeVerified(false);
          showError('Kod doğrulanamadı');
        }
      } finally {
        if (isActive) {
          setCheckingCode(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [forgotPassword, verificationCode, codeVerified]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await authFetch('/auth/profile');
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          setDisplayName(data.user.displayName || data.user.name || '');
          setEmail(data.user.email || '');
          setPhone(data.user.phone || '');
        }
      }
    } catch (error) {
      showError('Profil bilgileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      showError('İsim alanı boş bırakılamaz');
      return;
    }

    // Şifre değişikliği kontrolü
    if (newPassword || confirmPassword) {
      if (forgotPassword) {
        // Email doğrulama kodu ile
        if (!verificationCode || verificationCode.length !== 6) {
          showError('Doğrulama kodunu girin');
          return;
        }
        if (!codeVerified) {
          showError('Doğrulama kodunu onaylayın');
          return;
        }
      } else {
        // Mevcut şifre ile
        if (!currentPassword) {
          showError('Mevcut şifrenizi girin');
          return;
        }
      }
      
      if (newPassword !== confirmPassword) {
        showError('Yeni şifreler eşleşmiyor');
        return;
      }
      if (newPassword.length < 6) {
        showError('Yeni şifre en az 6 karakter olmalı');
        return;
      }
    }

    try {
      setSaving(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const updates: any = {
        displayName: displayName.trim(),
      };

      if (phone) {
        const cleanedPhone = phone.replace(/\s/g, '').replace('+90', '').replace(/^0+/, '');
        updates.phone = cleanedPhone ? `+90${cleanedPhone}` : phone.trim();
      }

      if (newPassword) {
        if (forgotPassword && verificationCode) {
          updates.verificationCode = verificationCode;
          updates.newPassword = newPassword;
        } else if (currentPassword) {
          updates.currentPassword = currentPassword;
          updates.newPassword = newPassword;
        }
      }

      const response = await authFetch('/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        showError(data.error || 'Profil güncellenemedi');
        return;
      }

      // SecureStore'u güncelle
      if (data.user) {
        if (data.user.displayName || data.user.name) {
          await SecureStore.setItemAsync('displayName', data.user.displayName || data.user.name);
        }
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccess('Profil başarıyla güncellendi!');
      
      // Şifre alanlarını temizle
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setVerificationCode('');
      setCodeDigits(['', '', '', '', '', '']);
      setForgotPassword(false);
      setCodeSent(false);
      setCodeVerified(false);
      setCheckingCode(false);
      
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error) {
      console.error('Save profile error:', error);
      showError('Bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#06b6d4" />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient colors={['#06b6d4', '#0ea5a4']} style={styles.header}>
        <View style={styles.headerInner}>
          <Pressable 
            onPress={() => router.back()} 
            style={styles.backButton}
            android_ripple={{ color: 'rgba(255,255,255,0.3)', borderless: true, radius: 20 }}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Profili Düzenle</Text>
            <Text style={styles.headerSubtitle}>Bilgilerinizi güncelleyin</Text>
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profil Bilgileri */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrapper}>
                <LinearGradient
                  colors={['#06b6d4', '#0891b2']}
                  style={styles.sectionIconGradient}
                >
                  <Ionicons name="person" size={20} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.sectionTitle}>Kişisel Bilgiler</Text>
            </View>
            
            <Input
              label="Ad Soyad"
              placeholder="Adınız ve soyadınız"
              value={displayName}
              onChangeText={setDisplayName}
              leftElement={
                <View style={styles.iconCircle}>
                  <Ionicons name="person-outline" size={18} color="#64748b" />
                </View>
              }
              style={styles.input}
            />

            <Input
              label="E-posta"
              placeholder="ornek@email.com"
              value={email}
              editable={false}
              leftElement={
                <View style={styles.iconCircle}>
                  <Ionicons name="mail-outline" size={16} color="#64748b" />
                </View>
              }
              style={[styles.input, styles.inputDisabled]}
            />
            <Text style={styles.helperText}>E-posta adresi değiştirilemez</Text>

            <Input
              label="Telefon (Opsiyonel)"
              placeholder="+90 5XX XXX XX XX"
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              maxLength={17}
              leftElement={
                <View style={styles.iconCircle}>
                  <Ionicons name="call-outline" size={16} color="#64748b" />
                </View>
              }
              style={styles.input}
            />
          </View>

          {/* Şifre Değiştirme */}
          <View ref={passwordSectionRef} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrapper}>
                <LinearGradient
                  colors={['#7c3aed', '#6d28d9']}
                  style={styles.sectionIconGradient}
                >
                  <Ionicons name="lock-closed" size={20} color="#fff" />
                </LinearGradient>
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Şifre Değiştir</Text>
                <Text style={styles.sectionDescription}>
                  Şifrenizi değiştirmek istemiyorsanız bu alanları boş bırakın
                </Text>
              </View>
            </View>

            {!forgotPassword ? (
              <>
                <Input
                  label="Mevcut Şifre"
                  placeholder="Mevcut şifreniz"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPassword}
                  leftElement={
                    <View style={styles.iconCircle}>
                      <Ionicons name="lock-closed-outline" size={16} color="#64748b" />
                    </View>
                  }
                  rightElement={
                    <Pressable onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                      <Ionicons 
                        name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'} 
                        size={20} 
                        color="#64748b" 
                      />
                    </Pressable>
                  }
                  style={styles.input}
                />
                <Pressable 
                  onPress={() => {
                    setForgotPassword(true);
                    setCurrentPassword('');
                  }}
                  style={styles.forgotPasswordLink}
                >
                  <Text style={styles.forgotPasswordText}>
                    Mevcut şifremi bilmiyorum / Gmail ile doğrula
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.verificationSection}>
                  <View style={styles.verificationHeader}>
                    <View style={styles.verificationIconWrapper}>
                      <LinearGradient
                        colors={['#06b6d4', '#0891b2']}
                        style={styles.verificationIconGradient}
                      >
                        <Ionicons name="mail" size={20} color="#fff" />
                      </LinearGradient>
                    </View>
                    <View style={styles.verificationHeaderText}>
                      <Text style={styles.verificationTitle}>E-posta Doğrulama</Text>
                      <Text style={styles.verificationDescription}>
                        <Text style={styles.emailHighlight}>{email}</Text> adresine gönderilen doğrulama kodunu girin
                      </Text>
                    </View>
                  </View>
                  
                  {!codeSent ? (
                    <Button
                      title={sendingCode ? 'Gönderiliyor...' : 'Doğrulama Kodu Gönder'}
                      onPress={async () => {
                        try {
                          setSendingCode(true);
                          const response = await authFetch('/auth/profile/send-password-code', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                          });
                          const data = await response.json();
                          if (response.ok) {
                            setCodeSent(true);
                              showSuccess('Doğrulama kodu e-postanıza gönderildi');
                          } else {
                            showError(data.error || 'Kod gönderilemedi');
                          }
                        } catch (error) {
                          console.error('Send code error:', error);
                          showError('Bir hata oluştu');
                        } finally {
                          setSendingCode(false);
                        }
                      }}
                      disabled={sendingCode}
                      loading={sendingCode}
                      style={styles.sendCodeButton}
                    />
                  ) : (
                    <>
                      <View style={styles.codeInputWrapper}>
                        <Text style={styles.codeInputLabel}>Doğrulama Kodu</Text>
                        <View style={styles.codeInputContainer}>
                          {[0, 1, 2, 3, 4, 5].map((index) => (
                            <View
                              key={index}
                              style={[
                                styles.codeDigitContainer,
                                codeDigits[index] && styles.codeDigitFilled,
                                codeVerified && codeDigits[index] && styles.codeDigitVerified,
                                checkingCode && codeDigits[index] && styles.codeDigitChecking
                              ]}
                            >
                              <Text style={styles.codeDigitText}>
                                {codeDigits[index] || ''}
                              </Text>
                            </View>
                          ))}
                          <TextInput
                            style={styles.hiddenCodeInput}
                            value={verificationCode}
                            onChangeText={(text) => {
                              const digits = text.replace(/[^0-9]/g, '').slice(0, 6).split('');
                              const newDigits: string[] = [...Array(6).fill('')];
                              digits.forEach((digit, i) => {
                                newDigits[i] = digit;
                              });
                              setCodeDigits(newDigits);
                              setVerificationCode(digits.join(''));
                              if (codeVerified) {
                                setCodeVerified(false);
                              }
                            }}
                            keyboardType="number-pad"
                            maxLength={6}
                            autoFocus={codeSent}
                            autoComplete="off"
                          />
                        </View>
                      </View>
                      {codeVerified && verificationCode.length === 6 && (
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                          <Text style={styles.verifiedText}>Kod doğrulandı</Text>
                        </View>
                      )}
                      {checkingCode && verificationCode.length === 6 && (
                        <View style={styles.verifiedBadge}>
                          <ActivityIndicator size="small" color="#06b6d4" />
                          <Text style={[styles.verifiedText, { color: '#06b6d4' }]}>Kod doğrulanıyor...</Text>
                        </View>
                      )}
                      <Pressable 
                        onPress={() => {
                          setCodeSent(false);
                          setVerificationCode('');
                          setCodeDigits(['', '', '', '', '', '']);
                          setCodeVerified(false);
                        }}
                        style={styles.resendCodeLink}
                      >
                        <Text style={styles.resendCodeText}>Yeni kod gönder</Text>
                      </Pressable>
                      <Pressable 
                        onPress={() => {
                          setForgotPassword(false);
                          setCodeSent(false);
                          setVerificationCode('');
                          setCodeDigits(['', '', '', '', '', '']);
                          setCodeVerified(false);
                        }}
                        style={styles.backToPasswordLink}
                      >
                        <Text style={styles.backToPasswordText}>Mevcut şifremi biliyorum</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </>
            )}

            {(forgotPassword && codeVerified) || !forgotPassword ? (
              <>
                <Input
                  ref={passwordInputRef}
                  label="Yeni Şifre"
                  placeholder="En az 6 karakter"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  leftElement={
                    <View style={styles.iconCircle}>
                      <Ionicons name="key-outline" size={16} color="#64748b" />
                    </View>
                  }
                  rightElement={
                    <Pressable onPress={() => setShowNewPassword(!showNewPassword)}>
                      <Ionicons 
                        name={showNewPassword ? 'eye-off-outline' : 'eye-outline'} 
                        size={20} 
                        color="#64748b" 
                      />
                    </Pressable>
                  }
                  style={styles.input}
                />

                <Input
                  label="Yeni Şifre (Tekrar)"
                  placeholder="Yeni şifrenizi tekrar girin"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showNewPassword}
                  leftElement={
                    <View style={styles.iconCircle}>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#64748b" />
                    </View>
                  }
                  style={styles.input}
                />
              </>
            ) : null}

          </View>

          {/* Kaydet Butonu */}
          <View style={styles.buttonContainer}>
            <Button
              title={saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
              onPress={handleSave}
              disabled={saving}
              loading={saving}
              style={styles.saveButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={hideToast}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 20 : 20,
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: 3,
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    marginTop: 12,
  },
  section: {
    marginBottom: 32,
    padding: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  sectionIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionIconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: 0.5,
    fontFamily: 'Poppins-Bold',
  },
  sectionDescription: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    fontFamily: 'Poppins-Regular',
  },
  input: {
    marginBottom: 12,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  iconCircle: {
    width: 32,
    height: 32,
    marginTop: -15,
    right: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 4,
  },
  buttonContainer: {
    marginTop: 12,
    marginBottom: 24,
  },
  saveButton: {
    height: 56,
  },
  forgotPasswordLink: {
    marginTop: -8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  forgotPasswordText: {
    color: '#06b6d4',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
    textDecorationLine: 'underline',
  },
  verificationSection: {
    marginBottom: 20,
    padding: 20,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  verificationTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#06b6d4',
    marginBottom: 6,
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.3,
  },
  verificationDescription: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
    fontFamily: 'Poppins-Regular',
  },
  sendCodeButton: {
    marginTop: 8,
  },
  codeInputWrapper: {
    marginBottom: 20,
  },
  codeInputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    fontFamily: 'Poppins-SemiBold',
  },
  codeInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    position: 'relative',
  },
  codeDigitContainer: {
    flex: 1,
    height: 68,
    borderRadius: 18,
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(100, 116, 139, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  codeDigitFilled: {
    borderColor: '#06b6d4',
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  codeDigitVerified: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  codeDigitChecking: {
    borderColor: '#06b6d4',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  codeDigitText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'Poppins-ExtraBold',
    letterSpacing: 1,
  },
  hiddenCodeInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  verificationIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
  },
  verificationIconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verificationHeaderText: {
    flex: 1,
  },
  emailHighlight: {
    color: '#06b6d4',
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
  },
  resendCodeLink: {
    marginTop: 8,
    alignSelf: 'center',
  },
  resendCodeText: {
    color: '#06b6d4',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  backToPasswordLink: {
    marginTop: 12,
    alignSelf: 'center',
  },
  backToPasswordText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  verifiedText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
  },
});
