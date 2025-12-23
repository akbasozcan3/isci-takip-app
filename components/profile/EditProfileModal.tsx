import React, { useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface EditProfileModalProps {
    visible: boolean;
    currentName: string;
    currentPhone: string;
    onClose: () => void;
    onSave: (name: string, phone: string) => Promise<void>;
}

export function EditProfileModal({
    visible,
    currentName,
    currentPhone,
    onClose,
    onSave
}: EditProfileModalProps) {
    const [name, setName] = useState(currentName);
    const [phone, setPhone] = useState(currentPhone);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    React.useEffect(() => {
        if (visible) {
            setName(currentName);
            setPhone(currentPhone);
            setError('');
        }
    }, [visible, currentName, currentPhone]);

    const handleSubmit = async () => {
        setError('');

        if (!name.trim()) {
            setError('İsim alanı boş bırakılamaz');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setLoading(true);
        try {
            await onSave(name.trim(), phone.trim());
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Profil güncellenemedi');
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
                                    <Ionicons name="person" size={28} color="#0EA5E9" />
                                </View>
                            </LinearGradient>
                            <Text style={styles.title}>Profil Düzenle</Text>
                            <Text style={styles.description}>Hesap bilgilerinizi güncelleyin</Text>
                        </View>

                        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>İsim Soyisim</Text>
                                <View style={[styles.inputContainer, error && styles.inputContainerError]}>
                                    <View style={styles.inputIconWrapper}>
                                        <Ionicons name="person-outline" size={18} color="#64748b" />
                                    </View>
                                    <TextInput
                                        style={styles.input}
                                        value={name}
                                        onChangeText={(text) => {
                                            setName(text);
                                            setError('');
                                        }}
                                        placeholder="İsim Soyisim"
                                        placeholderTextColor="#64748b"
                                        editable={!loading}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Telefon Numarası (Opsiyonel)</Text>
                                <View style={styles.inputContainer}>
                                    <View style={styles.inputIconWrapper}>
                                        <Ionicons name="call-outline" size={18} color="#64748b" />
                                    </View>
                                    <TextInput
                                        style={styles.input}
                                        value={phone}
                                        onChangeText={setPhone}
                                        placeholder="+90 5XX XXX XX XX"
                                        placeholderTextColor="#64748b"
                                        keyboardType="phone-pad"
                                        editable={!loading}
                                    />
                                </View>
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
                                <Text style={styles.cancelText}>İptal</Text>
                            </Pressable>

                            <Pressable
                                onPress={handleSubmit}
                                disabled={loading || !name.trim()}
                                style={({ pressed }) => [
                                    styles.submitButton,
                                    (loading || !name.trim()) && styles.submitButtonDisabled,
                                    pressed && styles.submitButtonPressed
                                ]}
                            >
                                <LinearGradient
                                    colors={loading || !name.trim() ? ['#64748b', '#475569'] : ['#0EA5E9', '#0891b2']}
                                    style={styles.submitGradient}
                                >
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                            <Text style={styles.submitText}>Kaydet</Text>
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
        maxHeight: 300,
    },
    inputGroup: {
        marginBottom: 18,
    },
    label: {
        fontSize: 13,
        color: '#cbd5e1',
        marginBottom: 10,
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        borderWidth: 2,
        borderColor: '#334155',
        borderRadius: 14,
        overflow: 'hidden',
    },
    inputContainerError: {
        borderColor: 'rgba(239, 68, 68, 0.5)',
    },
    inputIconWrapper: {
        width: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    input: {
        flex: 1,
        padding: 14,
        paddingLeft: 0,
        fontSize: 15,
        color: '#fff',
        fontFamily: 'Poppins-Regular',
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
        padding: 16,
        borderRadius: 16,
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#334155',
    },
    cancelButtonPressed: {
        opacity: 0.7,
        transform: [{ scale: 0.98 }],
    },
    cancelText: {
        color: '#cbd5e1',
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'Poppins-Bold',
    },
    submitButton: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#0EA5E9',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonDisabled: {
        opacity: 0.5,
        shadowOpacity: 0,
    },
    submitButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
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
        fontWeight: '700',
        fontFamily: 'Poppins-Bold',
    },
});
