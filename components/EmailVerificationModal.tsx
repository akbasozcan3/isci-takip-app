import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface EmailVerificationModalProps {
    visible: boolean;
    email: string;
    onVerify: (code: string) => Promise<void>;
    onCancel: () => void;
    onResend: () => Promise<void>;
    title?: string;
    description?: string;
}

export function EmailVerificationModal({
    visible,
    email,
    onVerify,
    onCancel,
    onResend,
    title = 'Email Doğrulama',
    description = 'E-posta adresinize gönderilen 6 haneli doğrulama kodunu girin'
}: EmailVerificationModalProps) {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [countdown, setCountdown] = useState(60);
    const [error, setError] = useState('');

    useEffect(() => {
        if (visible) {
            setCode('');
            setError('');
            setCountdown(60);
        }
    }, [visible]);

    useEffect(() => {
        if (!visible || countdown <= 0) return;

        const timer = setInterval(() => {
            setCountdown(prev => prev > 0 ? prev - 1 : 0);
        }, 1000);

        return () => clearInterval(timer);
    }, [visible, countdown]);

    const handleVerify = async () => {
        if (code.length !== 6) {
            setError('Lütfen 6 haneli kodu girin');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setLoading(true);
        setError('');

        try {
            await onVerify(code);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err: any) {
            setError(err.message || 'Doğrulama başarısız');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (countdown > 0) return;

        setResending(true);
        setError('');

        try {
            await onResend();
            setCountdown(60);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err: any) {
            setError(err.message || 'Kod gönderilemedi');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setResending(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <Pressable style={styles.overlay} onPress={onCancel}>
                <Reanimated.View entering={FadeInDown.springify()} style={styles.container}>
                    <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.gradient}>
                        <View style={styles.header}>
                            <View style={styles.iconWrapper}>
                                <Ionicons name="mail" size={32} color="#0EA5E9" />
                            </View>
                            <Text style={styles.title}>{title}</Text>
                            <Text style={styles.description}>{description}</Text>
                            <Text style={styles.email}>{email}</Text>
                        </View>

                        <View style={styles.content}>
                            <TextInput
                                style={styles.input}
                                value={code}
                                onChangeText={(text) => {
                                    setCode(text.replace(/[^0-9]/g, '').slice(0, 6));
                                    setError('');
                                }}
                                placeholder="000000"
                                placeholderTextColor="#64748b"
                                keyboardType="number-pad"
                                maxLength={6}
                                autoFocus
                                editable={!loading}
                            />

                            {error ? (
                                <View style={styles.errorContainer}>
                                    <Ionicons name="alert-circle" size={16} color="#ef4444" />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            ) : null}

                            <Pressable
                                onPress={handleResend}
                                disabled={countdown > 0 || resending}
                                style={({ pressed }) => [
                                    styles.resendButton,
                                    (countdown > 0 || resending) && styles.resendButtonDisabled,
                                    pressed && styles.resendButtonPressed
                                ]}
                            >
                                {resending ? (
                                    <ActivityIndicator size="small" color="#0EA5E9" />
                                ) : (
                                    <>
                                        <Ionicons name="refresh" size={16} color={countdown > 0 ? '#64748b' : '#0EA5E9'} />
                                        <Text style={[styles.resendText, countdown > 0 && styles.resendTextDisabled]}>
                                            {countdown > 0 ? `Tekrar gönder (${countdown}s)` : 'Tekrar gönder'}
                                        </Text>
                                    </>
                                )}
                            </Pressable>
                        </View>

                        <View style={styles.actions}>
                            <Pressable
                                onPress={onCancel}
                                disabled={loading}
                                style={({ pressed }) => [
                                    styles.cancelButton,
                                    pressed && !loading && styles.cancelButtonPressed
                                ]}
                            >
                                <Text style={styles.cancelText}>İptal</Text>
                            </Pressable>

                            <Pressable
                                onPress={handleVerify}
                                disabled={loading || code.length !== 6}
                                style={({ pressed }) => [
                                    styles.verifyButton,
                                    (loading || code.length !== 6) && styles.verifyButtonDisabled,
                                    pressed && styles.verifyButtonPressed
                                ]}
                            >
                                <LinearGradient
                                    colors={loading || code.length !== 6 ? ['#64748b', '#475569'] : ['#0EA5E9', '#0891b2']}
                                    style={styles.verifyGradient}
                                >
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                            <Text style={styles.verifyText}>Doğrula</Text>
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
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 24,
        overflow: 'hidden',
    },
    gradient: {
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    iconWrapper: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(14, 165, 233, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(14, 165, 233, 0.2)',
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 8,
        fontFamily: 'Poppins-Bold',
    },
    description: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        marginBottom: 8,
        fontFamily: 'Poppins-Regular',
    },
    email: {
        fontSize: 14,
        color: '#0EA5E9',
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
    content: {
        marginBottom: 24,
    },
    input: {
        backgroundColor: '#0f172a',
        borderWidth: 2,
        borderColor: '#334155',
        borderRadius: 16,
        padding: 16,
        fontSize: 32,
        color: '#fff',
        textAlign: 'center',
        letterSpacing: 8,
        fontFamily: 'Poppins-Bold',
        marginBottom: 16,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 13,
        fontFamily: 'Poppins-Medium',
    },
    resendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
    },
    resendButtonDisabled: {
        opacity: 0.5,
    },
    resendButtonPressed: {
        opacity: 0.7,
    },
    resendText: {
        color: '#0EA5E9',
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
    resendTextDisabled: {
        color: '#64748b',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#1e293b',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    cancelButtonPressed: {
        opacity: 0.7,
    },
    cancelText: {
        color: '#94a3b8',
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'Poppins-Bold',
    },
    verifyButton: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
    },
    verifyButtonDisabled: {
        opacity: 0.5,
    },
    verifyButtonPressed: {
        opacity: 0.9,
    },
    verifyGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
    },
    verifyText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'Poppins-Bold',
    },
});
