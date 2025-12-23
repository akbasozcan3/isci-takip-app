import React, { useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

interface ChangePasswordModalProps {
    visible: boolean;
    onClose: () => void;
    onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export function ChangePasswordModal({
    visible,
    onClose,
    onChangePassword
}: ChangePasswordModalProps) {
    const router = useRouter();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [passwordScore, setPasswordScore] = useState(0);

    const calcPasswordStrength = (pw: string) => {
        let score = 0;
        if (!pw) return 0;
        if (pw.length >= 6) score++;
        if (pw.length >= 10) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        return Math.min(score, 4);
    };

    const handleForgotPassword = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
        setTimeout(() => {
            router.push('/auth/reset-password');
        }, 300);
    };

    React.useEffect(() => {
        if (visible) {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setError('');
            setShowCurrent(false);
            setShowNew(false);
            setShowConfirm(false);
            setPasswordScore(0);
        }
    }, [visible]);

    React.useEffect(() => {
        setPasswordScore(calcPasswordStrength(newPassword));
    }, [newPassword]);

    const handleSubmit = async () => {
        setError('');

        if (!currentPassword || !newPassword || !confirmPassword) {
            setError('Lütfen tüm alanları doldurun');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        if (newPassword.length < 6) {
            setError('Yeni şifre en az 6 karakter olmalıdır');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Yeni şifreler eşleşmiyor');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setLoading(true);
        try {
            await onChangePassword(currentPassword, newPassword);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Şifre değiştirilemedi');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Reanimated.View entering={FadeInDown.springify()} style={styles.container}>
                    <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.gradient}>
                        <View style={styles.header}>
                            <LinearGradient
                                colors={['rgba(14, 165, 233, 0.15)', 'rgba(99, 102, 241, 0.15)']}
                                style={styles.iconWrapper}
                            >
                                <View style={styles.iconInner}>
                                    <Ionicons name="lock-closed" size={28} color="#0EA5E9" />
                                </View>
                            </LinearGradient>
                            <Text style={styles.title}>Şifre Değiştir</Text>
                            <Text style={styles.description}>Hesap güvenliğiniz için güçlü bir şifre seçin</Text>
                        </View>

                        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Text style={styles.label}>Mevcut Şifre</Text>
                                    <Pressable
                                        onPress={handleForgotPassword}
                                        style={({ pressed }) => [
                                            styles.forgotButton,
                                            pressed && { opacity: 0.7 }
                                        ]}
                                    >
                                        <Ionicons name="help-circle-outline" size={14} color="#0EA5E9" />
                                        <Text style={styles.forgotText}>Şifremi Unuttum</Text>
                                    </Pressable>
                                </View>
                                <View style={[styles.passwordContainer, error && styles.passwordContainerError]}>
                                    <View style={styles.inputIconWrapper}>
                                        <Ionicons name="key-outline" size={18} color="#64748b" />
                                    </View>
                                    <TextInput
                                        style={styles.passwordInput}
                                        value={currentPassword}
                                        onChangeText={(text) => {
                                            setCurrentPassword(text);
                                            setError('');
                                        }}
                                        placeholder="Mevcut şifrenizi girin"
                                        placeholderTextColor="#64748b"
                                        secureTextEntry={!showCurrent}
                                        autoCapitalize="none"
                                        editable={!loading}
                                    />
                                    <Pressable
                                        onPress={() => setShowCurrent(!showCurrent)}
                                        style={styles.eyeButton}
                                    >
                                        <Ionicons name={showCurrent ? 'eye-off' : 'eye'} size={20} color="#64748b" />
                                    </Pressable>
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Yeni Şifre</Text>
                                <View style={[styles.passwordContainer, error && styles.passwordContainerError]}>
                                    <View style={styles.inputIconWrapper}>
                                        <Ionicons name="shield-checkmark-outline" size={18} color="#64748b" />
                                    </View>
                                    <TextInput
                                        style={styles.passwordInput}
                                        value={newPassword}
                                        onChangeText={(text) => {
                                            setNewPassword(text);
                                            setError('');
                                        }}
                                        placeholder="En az 6 karakter"
                                        placeholderTextColor="#64748b"
                                        secureTextEntry={!showNew}
                                        autoCapitalize="none"
                                        editable={!loading}
                                    />
                                    <Pressable
                                        onPress={() => setShowNew(!showNew)}
                                        style={styles.eyeButton}
                                    >
                                        <Ionicons name={showNew ? 'eye-off' : 'eye'} size={20} color="#64748b" />
                                    </Pressable>
                                </View>
                                {newPassword.length > 0 && newPassword.length < 6 && (
                                    <Text style={styles.hintText}>Şifre en az 6 karakter olmalıdır</Text>
                                )}
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Yeni Şifre (Tekrar)</Text>
                                <View style={[styles.passwordContainer, error && styles.passwordContainerError]}>
                                    <View style={styles.inputIconWrapper}>
                                        <Ionicons name="checkmark-circle-outline" size={18} color="#64748b" />
                                    </View>
                                    <TextInput
                                        style={styles.passwordInput}
                                        value={confirmPassword}
                                        onChangeText={(text) => {
                                            setConfirmPassword(text);
                                            setError('');
                                        }}
                                        placeholder="Yeni şifrenizi tekrar girin"
                                        placeholderTextColor="#64748b"
                                        secureTextEntry={!showConfirm}
                                        autoCapitalize="none"
                                        editable={!loading}
                                    />
                                    <Pressable
                                        onPress={() => setShowConfirm(!showConfirm)}
                                        style={styles.eyeButton}
                                    >
                                        <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color="#64748b" />
                                    </Pressable>
                                </View>
                                {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                                    <Text style={styles.hintTextError}>Şifreler eşleşmiyor</Text>
                                )}
                            </View>

                            {error ? (
                                <Reanimated.View entering={FadeInDown.springify()} style={styles.errorContainer}>
                                    <Ionicons name="alert-circle" size={18} color="#ef4444" />
                                    <Text style={styles.errorText}>{error}</Text>
                                </Reanimated.View>
                            ) : null}
                        </ScrollView>

                        <View style={styles.actions}>
                            <Pressable
                                onPress={onClose}
                                disabled={loading}
                                style={({ pressed }) => [
                                    styles.cancelButton,
                                    pressed && !loading && styles.cancelButtonPressed
                                ]}
                            >
                                <LinearGradient
                                    colors={['rgba(51, 65, 85, 0.6)', 'rgba(30, 41, 59, 0.8)']}
                                    style={styles.cancelGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Ionicons name="close-circle-outline" size={20} color="#cbd5e1" />
                                    <Text style={styles.cancelText}>İptal</Text>
                                </LinearGradient>
                            </Pressable>

                            <Pressable
                                onPress={handleSubmit}
                                disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                                style={({ pressed }) => [
                                    styles.submitButton,
                                    (loading || !currentPassword || !newPassword || !confirmPassword) && styles.submitButtonDisabled,
                                    pressed && styles.submitButtonPressed
                                ]}
                            >
                                <LinearGradient
                                    colors={loading || !currentPassword || !newPassword || !confirmPassword
                                        ? ['#475569', '#334155']
                                        : ['#0EA5E9', '#0891b2', '#0e7490']}
                                    style={styles.submitGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-circle" size={22} color="#fff" />
                                            <Text style={styles.submitText}>Şifreyi Değiştir</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </Pressable>
                        </View>
                    </LinearGradient>
                </Reanimated.View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        width: '100%',
        maxWidth: 420,
        maxHeight: '90%',
        borderRadius: 28,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.5,
        shadowRadius: 40,
        elevation: 20,
    },
    gradient: {
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 28,
    },
    iconWrapper: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: 'rgba(14, 165, 233, 0.3)',
    },
    iconInner: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(14, 165, 233, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 26,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 8,
        fontFamily: 'Poppins-Bold',
        letterSpacing: 0.5,
    },
    description: {
        fontSize: 13,
        color: '#94a3b8',
        textAlign: 'center',
        fontFamily: 'Poppins-Regular',
        lineHeight: 18,
    },
    content: {
        maxHeight: 280,
    },
    inputGroup: {
        marginBottom: 18,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    label: {
        fontSize: 13,
        color: '#cbd5e1',
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
    forgotButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 2,
        paddingHorizontal: 6,
    },
    forgotText: {
        fontSize: 12,
        color: '#0EA5E9',
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        borderWidth: 2,
        borderColor: '#334155',
        borderRadius: 14,
        overflow: 'hidden',
    },
    passwordContainerError: {
        borderColor: 'rgba(239, 68, 68, 0.5)',
    },
    inputIconWrapper: {
        width: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    passwordInput: {
        flex: 1,
        padding: 14,
        paddingLeft: 0,
        fontSize: 15,
        color: '#fff',
        fontFamily: 'Poppins-Regular',
    },
    eyeButton: {
        padding: 14,
        paddingLeft: 8,
    },
    hintText: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 6,
        marginLeft: 4,
        fontFamily: 'Poppins-Regular',
    },
    hintTextError: {
        fontSize: 11,
        color: '#ef4444',
        marginTop: 6,
        marginLeft: 4,
        fontFamily: 'Poppins-Medium',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        padding: 14,
        borderRadius: 14,
        marginTop: 4,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    errorText: {
        color: '#ef4444',
        fontSize: 13,
        fontFamily: 'Poppins-Medium',
        flex: 1,
        lineHeight: 18,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
    cancelButton: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(148, 163, 184, 0.2)',
    },
    cancelGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
    },
    cancelButtonPressed: {
        opacity: 0.7,
        transform: [{ scale: 0.98 }],
    },
    cancelText: {
        color: '#e2e8f0',
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'Poppins-Bold',
        letterSpacing: 0.3,
    },
    submitButton: {
        flex: 1.2,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#0EA5E9',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    submitButtonDisabled: {
        opacity: 0.5,
        shadowOpacity: 0,
    },
    submitButtonPressed: {
        opacity: 0.85,
        transform: [{ scale: 0.97 }],
        shadowOpacity: 0.6,
    },
    submitGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
    },
    submitText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        fontFamily: 'Poppins-Bold',
        letterSpacing: 0.5,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
});
