import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Lazy load ImagePicker
let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.warn('[EditProfile] ImagePicker not available');
}
import { Toast, useToast } from '../../components/Toast';
import { Button } from '../../components/ui/Button/index';
import { Card } from '../../components/ui/Card/index';
import { Input } from '../../components/ui/Input/index';
import { VerificationCodeInput } from '../../components/ui/VerificationCodeInput';
import { useTheme } from '../../components/ui/theme/ThemeContext';
import { authFetch } from '../../utils/auth';
import { useProfile } from '../../contexts/ProfileContext';

export default function EditProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const { updateAvatarUrl: updateContextAvatar, loadAvatar: reloadAvatar } = useProfile();

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
  const [sendingCode, setSendingCode] = React.useState(false);
  const [codeSent, setCodeSent] = React.useState(false);
  const [codeVerified, setCodeVerified] = React.useState(false);
  const [checkingCode, setCheckingCode] = React.useState(false);

  // Avatar upload states
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const [photoModalVisible, setPhotoModalVisible] = React.useState(false);

  const scrollViewRef = React.useRef<ScrollView>(null);
  const passwordInputRef = React.useRef<any>(null);
  const passwordSectionRef = React.useRef<View>(null);

  React.useEffect(() => {
    loadProfile();
    loadAvatar();
  }, []);

  const loadAvatar = async () => {
    try {
      const saved = await SecureStore.getItemAsync('avatarUrl');
      if (saved) setAvatarUrl(saved);
    } catch (error) {
      console.log('[EditProfile] Failed to load avatar:', error);
    }
  };

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

  const pickImageFromGallery = async () => {
    setPhotoModalVisible(false);
    if (!ImagePicker) {
      showError('Galeri modülü eksik');
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showError('Galeri izni gerekli');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[EditProfile] Gallery error:', error);
      showError('Fotoğraf seçilemedi');
    }
  };

  const takePhoto = async () => {
    setPhotoModalVisible(false);
    if (!ImagePicker) {
      showError('Kamera modülü eksik');
      return;
    }
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showError('Kamera izni gerekli');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[EditProfile] Camera error:', error);
      showError('Fotoğraf çekilemedi');
    }
  };

  const uploadAvatar = async (uri: string) => {
    console.log('[EditProfile] 🚀 Starting avatar upload...');
    console.log('[EditProfile] 📸 Image URI:', uri);
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename || '');
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      console.log('[EditProfile] 📦 FormData details:', { filename, type });
      formData.append('avatar', { uri, name: filename || 'avatar.jpg', type } as any);

      console.log('[EditProfile] 🌐 Sending request to /users/me/avatar...');
      const response = await authFetch('/users/me/avatar', {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('[EditProfile] 📡 Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[EditProfile] ✅ Response data:', JSON.stringify(data, null, 2));

        const newAvatarUrl = data.avatarUrl || data.data?.avatarUrl;
        console.log('[EditProfile] 🖼️ New avatar URL:', newAvatarUrl);

        if (newAvatarUrl) {
          // Update local state
          setAvatarUrl(newAvatarUrl);
          console.log('[EditProfile] 💾 Local state updated');

          // Update ProfileContext - this will update header automatically!
          await updateContextAvatar(newAvatarUrl);
          console.log('[EditProfile] 🔄 ProfileContext updated');
        } else {
          console.warn('[EditProfile] ⚠️ No avatar URL in response');
        }

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showSuccess('Profil fotoğrafı başarıyla yüklendi!');
        console.log('[EditProfile] 🎉 Upload complete!');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[EditProfile] ❌ Upload failed:', response.status, errorData);
        showError('Fotoğraf yüklenemedi');
      }
    } catch (error) {
      console.error('[EditProfile] 💥 Upload avatar error:', error);
      showError('Fotoğraf yüklenirken hata oluştu');
    } finally {
      setUploadingAvatar(false);
      console.log('[EditProfile] 🏁 Upload process finished');
    }
  };

  const initials = React.useMemo(() => {
    if (!displayName) return '';
    return displayName.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  }, [displayName]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0EA5E9" />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={theme.colors.gradients.primary.slice(0, 2) as [string, string]} style={styles.header}>
        <View style={styles.headerInner}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            android_ripple={{ color: 'rgba(255,255,255,0.3)', borderless: true, radius: 20 }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Profili Düzenle</Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>Bilgilerinizi güncelleyin</Text>
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
          {/* Avatar Section */}
          <Card variant="glass" padding="lg" style={styles.section}>
            <View style={styles.avatarSection}>
              <Pressable
                onPress={() => setPhotoModalVisible(true)}
                style={({ pressed }) => [styles.avatarWrapper, pressed && { opacity: 0.9 }]}
              >
                <LinearGradient
                  colors={theme.colors.gradients.primary.slice(0, 2) as [string, string]}
                  style={styles.avatarGradient}
                >
                  {uploadingAvatar ? (
                    <ActivityIndicator color="#fff" size="large" />
                  ) : avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  )}
                </LinearGradient>
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={16} color="#fff" />
                </View>
              </Pressable>
              <View style={styles.avatarInfo}>
                <Text style={[styles.avatarTitle, { color: theme.colors.text }]}>Profil Fotoğrafı</Text>
                <Text style={[styles.avatarDescription, { color: theme.colors.textTertiary }]}>
                  Fotoğrafınızı değiştirmek için tıklayın
                </Text>
              </View>
            </View>
          </Card>

          {/* Profil Bilgileri */}
          <Card variant="glass" padding="lg" style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrapper}>
                <LinearGradient
                  colors={theme.colors.gradients.primary.slice(0, 2) as [string, string]}
                  style={styles.sectionIconGradient}
                >
                  <Ionicons name="person" size={20} color={theme.colors.text} />
                </LinearGradient>
              </View>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Kişisel Bilgiler</Text>
            </View>

            <Input
              label="Ad Soyad"
              placeholder="Adınız ve soyadınız"
              value={displayName}
              onChangeText={setDisplayName}
              leftElement={
                <View style={styles.iconWrapper}>
                  <Ionicons name="person-outline" size={20} color={theme.colors.textTertiary} />
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
                <View style={styles.iconWrapper}>
                  <Ionicons name="mail-outline" size={20} color={theme.colors.textTertiary} />
                </View>
              }
              style={[styles.input, styles.inputDisabled]}
            />
            <Text style={[styles.helperText, { color: theme.colors.textTertiary }]}>E-posta adresi değiştirilemez</Text>

            <Input
              label="Telefon (Opsiyonel)"
              placeholder="+90 5XX XXX XX XX"
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              maxLength={17}
              leftElement={
                <View style={styles.iconWrapper}>
                  <Ionicons name="call-outline" size={20} color={theme.colors.textTertiary} />
                </View>
              }
              style={styles.input}
            />
          </Card>

          {/* Şifre Değiştirme */}
          <View ref={passwordSectionRef}>
            <Card variant="glass" padding="lg" style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrapper}>
                  <LinearGradient
                    colors={theme.colors.gradients.secondary.slice(0, 2) as [string, string]}
                    style={styles.sectionIconGradient}
                  >
                    <Ionicons name="lock-closed" size={20} color={theme.colors.text} />
                  </LinearGradient>
                </View>
                <View style={styles.sectionHeaderText}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Şifre Değiştir</Text>
                  <Text style={[styles.sectionDescription, { color: theme.colors.textTertiary }]}>
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
                      <View style={styles.iconWrapper}>
                        <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textTertiary} />
                      </View>
                    }
                    rightElement={
                      <Pressable onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={styles.iconWrapper}>
                        <Ionicons
                          name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color={theme.colors.textTertiary}
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
                  <View style={[styles.verificationSection, { backgroundColor: theme.colors.primary + '14', borderColor: theme.colors.primary + '40' }]}>
                    <View style={styles.verificationHeader}>
                      <View style={styles.verificationIconWrapper}>
                        <LinearGradient
                          colors={theme.colors.gradients.primary.slice(0, 2) as [string, string]}
                          style={styles.verificationIconGradient}
                        >
                          <Ionicons name="mail" size={20} color={theme.colors.text} />
                        </LinearGradient>
                      </View>
                      <View style={styles.verificationHeaderText}>
                        <Text style={[styles.verificationTitle, { color: theme.colors.primary }]}>E-posta Doğrulama</Text>
                        <Text style={[styles.verificationDescription, { color: theme.colors.textSecondary }]}>
                          <Text style={[styles.emailHighlight, { color: theme.colors.primary }]}>{email}</Text> adresine gönderilen doğrulama kodunu girin
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
                          <Text style={[styles.codeInputLabel, { color: theme.colors.text }]}>Doğrulama Kodu</Text>
                          <VerificationCodeInput
                            value={verificationCode}
                            onChangeText={(text: string) => {
                              setVerificationCode(text);
                              if (codeVerified) {
                                setCodeVerified(false);
                              }
                            }}
                            length={6}
                            loading={checkingCode}
                            verified={codeVerified}
                            autoFocus={codeSent}
                          />
                        </View>
                        {codeVerified && verificationCode.length === 6 && (
                          <View style={[styles.verifiedBadge, { backgroundColor: theme.colors.success + '1A', borderColor: theme.colors.success + '33' }]}>
                            <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                            <Text style={[styles.verifiedText, { color: theme.colors.success }]}>Kod doğrulandı</Text>
                          </View>
                        )}
                        {checkingCode && verificationCode.length === 6 && !codeVerified && (
                          <View style={[styles.verifiedBadge, { backgroundColor: theme.colors.primary + '1A', borderColor: theme.colors.primary + '33' }]}>
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                            <Text style={[styles.verifiedText, { color: theme.colors.primary }]}>Kod doğrulanıyor...</Text>
                          </View>
                        )}
                        <Pressable
                          onPress={() => {
                            setCodeSent(false);
                            setVerificationCode('');
                            setCodeVerified(false);
                          }}
                          style={styles.resendCodeLink}
                        >
                          <Text style={[styles.resendCodeText, { color: theme.colors.primary }]}>Yeni kod gönder</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setForgotPassword(false);
                            setCodeSent(false);
                            setVerificationCode('');
                            setCodeVerified(false);
                          }}
                          style={styles.backToPasswordLink}
                        >
                          <Text style={[styles.backToPasswordText, { color: theme.colors.textTertiary }]}>Mevcut şifremi biliyorum</Text>
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
                      <View style={styles.iconWrapper}>
                        <Ionicons name="key-outline" size={20} color={theme.colors.textTertiary} />
                      </View>
                    }
                    rightElement={
                      <Pressable onPress={() => setShowNewPassword(!showNewPassword)} style={styles.iconWrapper}>
                        <Ionicons
                          name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color={theme.colors.textTertiary}
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
                      <View style={styles.iconWrapper}>
                        <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.textTertiary} />
                      </View>
                    }
                    style={styles.input}
                  />
                </>
              ) : null}

            </Card>
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

      {/* Photo Selection Modal */}
      <Modal
        visible={photoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPhotoModalVisible(false)}
        >
          <View style={styles.photoModalContent}>
            <Text style={styles.photoModalTitle}>Profil Fotoğrafı</Text>
            <Text style={styles.photoModalSubtitle}>Fotoğraf kaynağını seçin</Text>

            <Pressable
              style={({ pressed }) => [
                styles.photoOption,
                pressed && { opacity: 0.8 }
              ]}
              onPress={pickImageFromGallery}
            >
              <LinearGradient
                colors={['rgba(14, 165, 233, 0.15)', 'rgba(99, 102, 241, 0.15)']}
                style={styles.photoOptionGradient}
              >
                <View style={styles.photoOptionIcon}>
                  <Ionicons name="images" size={24} color="#0EA5E9" />
                </View>
                <Text style={styles.photoOptionText}>Galeriden Seç</Text>
                <Ionicons name="chevron-forward" size={20} color="#64748b" />
              </LinearGradient>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.photoOption,
                pressed && { opacity: 0.8 }
              ]}
              onPress={takePhoto}
            >
              <LinearGradient
                colors={['rgba(14, 165, 233, 0.15)', 'rgba(99, 102, 241, 0.15)']}
                style={styles.photoOptionGradient}
              >
                <View style={styles.photoOptionIcon}>
                  <Ionicons name="camera" size={24} color="#0EA5E9" />
                </View>
                <Text style={styles.photoOptionText}>Fotoğraf Çek</Text>
                <Ionicons name="chevron-forward" size={20} color="#64748b" />
              </LinearGradient>
            </Pressable>

            <Pressable
              style={styles.photoModalCancel}
              onPress={() => setPhotoModalVisible(false)}
            >
              <Text style={styles.photoModalCancelText}>İptal</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

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
    backgroundColor: '#020617',
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
    shadowColor: '#0EA5E9',
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
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.5,
    fontFamily: 'Poppins-Bold',
  },
  headerSubtitle: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    marginTop: 12,
  },
  section: {
    marginBottom: 24,
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
  iconWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
    marginLeft: 4,
    fontFamily: 'Poppins-Regular',
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
    color: '#0EA5E9',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
    textDecorationLine: 'underline',
  },
  verificationSection: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 0.2,
  },
  verificationDescription: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Poppins-Regular',
  },
  sendCodeButton: {
    marginTop: 12,
    height: 48,
  },
  codeInputWrapper: {
    marginBottom: 16,
    marginTop: 4,
  },
  codeInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    fontFamily: 'Poppins-SemiBold',
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  verificationIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
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
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
  },
  resendCodeLink: {
    marginTop: 12,
    alignSelf: 'center',
  },
  resendCodeText: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  backToPasswordLink: {
    marginTop: 8,
    alignSelf: 'center',
  },
  backToPasswordText: {
    fontSize: 12,
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
    borderRadius: 12,
    borderWidth: 1,
  },
  verifiedText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarGradient: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 18,
    backgroundColor: '#0f172a',
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#0EA5E9',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#020617',
  },
  avatarInfo: {
    flex: 1,
  },
  avatarTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
    fontFamily: 'Poppins-Bold',
  },
  avatarDescription: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  photoModalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  photoModalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'Poppins-Bold',
  },
  photoModalSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 24,
    fontFamily: 'Poppins-Regular',
  },
  photoOption: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  photoOptionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  photoOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
  },
  photoModalCancel: {
    marginTop: 12,
    padding: 16,
    alignItems: 'center',
  },
  photoModalCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#94a3b8',
    fontFamily: 'Poppins-SemiBold',
  },
});
