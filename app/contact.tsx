import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
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
    View,
} from 'react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { PremiumBackground } from '../components/PremiumBackground';
import { authFetch } from '../utils/auth';
import { Toast, useToast } from '../components/Toast';

export default function ContactScreen() {
    const router = useRouter();
    const { toast, showSuccess, showError, hideToast } = useToast();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
            showError('Lütfen tüm alanları doldurun');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            showError('Geçerli bir e-posta adresi girin');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setLoading(true);
        try {
            const response = await authFetch('/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    email: email.trim(),
                    subject: subject.trim(),
                    message: message.trim(),
                }),
            });

            if (response.ok) {
                showSuccess('Mesajınız başarıyla gönderildi!');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setName('');
                setEmail('');
                setSubject('');
                setMessage('');
                setTimeout(() => router.back(), 2000);
            } else {
                const data = await response.json().catch(() => ({}));
                showError(data.error || 'Mesaj gönderilemedi');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        } catch (error) {
            console.error('[Contact] Submit error:', error);
            showError('Bağlantı hatası');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0f172a', '#1e293b', '#334155']}
                style={styles.gradient}
            >
                <StatusBar barStyle="light-content" />
                <PremiumBackground color="#10b981" lineCount={6} circleCount={4} />

                {/* Header */}
                <View style={styles.header}>
                    <Pressable
                        onPress={() => router.back()}
                        style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </Pressable>
                    <Text style={styles.headerTitle}>İletişim</Text>
                    <View style={{ width: 40 }} />
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardAvoid}
                >
                    <ScrollView
                        style={styles.content}
                        contentContainerStyle={styles.contentContainer}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <Reanimated.View entering={FadeInDown.springify()} style={styles.infoCard}>
                            <View style={styles.infoIcon}>
                                <Ionicons name="mail" size={32} color="#10b981" />
                            </View>
                            <Text style={styles.infoTitle}>Bizimle İletişime Geçin</Text>
                            <Text style={styles.infoText}>
                                Sorularınız, önerileriniz veya sorunlarınız için bize ulaşın.
                                En kısa sürede size geri dönüş yapacağız.
                            </Text>
                        </Reanimated.View>

                        <Reanimated.View entering={FadeInDown.delay(100).springify()} style={styles.form}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Ad Soyad</Text>
                                <View style={styles.inputContainer}>
                                    <Ionicons name="person-outline" size={20} color="#94a3b8" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Adınız Soyadınız"
                                        placeholderTextColor="#64748b"
                                        value={name}
                                        onChangeText={setName}
                                        editable={!loading}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>E-posta</Text>
                                <View style={styles.inputContainer}>
                                    <Ionicons name="mail-outline" size={20} color="#94a3b8" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="ornek@email.com"
                                        placeholderTextColor="#64748b"
                                        value={email}
                                        onChangeText={setEmail}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        editable={!loading}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Konu</Text>
                                <View style={styles.inputContainer}>
                                    <Ionicons name="bookmark-outline" size={20} color="#94a3b8" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Mesajınızın konusu"
                                        placeholderTextColor="#64748b"
                                        value={subject}
                                        onChangeText={setSubject}
                                        editable={!loading}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Mesaj</Text>
                                <View style={[styles.inputContainer, styles.textAreaContainer]}>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        placeholder="Mesajınızı buraya yazın..."
                                        placeholderTextColor="#64748b"
                                        value={message}
                                        onChangeText={setMessage}
                                        multiline
                                        numberOfLines={6}
                                        textAlignVertical="top"
                                        editable={!loading}
                                    />
                                </View>
                            </View>

                            <Pressable
                                onPress={handleSubmit}
                                disabled={loading}
                                style={({ pressed }) => [
                                    styles.submitButton,
                                    loading && styles.submitButtonDisabled,
                                    pressed && { opacity: 0.9 },
                                ]}
                            >
                                <LinearGradient
                                    colors={loading ? ['#64748b', '#475569'] : ['#10b981', '#059669']}
                                    style={styles.submitGradient}
                                >
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <Ionicons name="send" size={20} color="#fff" />
                                            <Text style={styles.submitText}>Gönder</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </Pressable>
                        </Reanimated.View>

                        <Reanimated.View entering={FadeInDown.delay(200).springify()} style={styles.contactInfo}>
                            <Text style={styles.contactInfoTitle}>Diğer İletişim Yolları</Text>

                            <View style={styles.contactItem}>
                                <View style={styles.contactIcon}>
                                    <Ionicons name="mail" size={20} color="#10b981" />
                                </View>
                                <View style={styles.contactDetails}>
                                    <Text style={styles.contactLabel}>E-posta</Text>
                                    <Text style={styles.contactValue}>destek@bavaxe.com</Text>
                                </View>
                            </View>

                            <View style={styles.contactItem}>
                                <View style={styles.contactIcon}>
                                    <Ionicons name="call" size={20} color="#10b981" />
                                </View>
                                <View style={styles.contactDetails}>
                                    <Text style={styles.contactLabel}>Telefon</Text>
                                    <Text style={styles.contactValue}>+90 (XXX) XXX XX XX</Text>
                                </View>
                            </View>

                            <View style={styles.contactItem}>
                                <View style={styles.contactIcon}>
                                    <Ionicons name="time" size={20} color="#10b981" />
                                </View>
                                <View style={styles.contactDetails}>
                                    <Text style={styles.contactLabel}>Çalışma Saatleri</Text>
                                    <Text style={styles.contactValue}>Hafta içi 09:00 - 18:00</Text>
                                </View>
                            </View>
                        </Reanimated.View>
                    </ScrollView>
                </KeyboardAvoidingView>

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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    gradient: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        fontFamily: 'Poppins-Bold',
    },
    keyboardAvoid: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    infoCard: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: 20,
        padding: 24,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.2)',
        alignItems: 'center',
    },
    infoIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    infoTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
        fontFamily: 'Poppins-Bold',
    },
    infoText: {
        fontSize: 14,
        color: '#cbd5e1',
        textAlign: 'center',
        lineHeight: 22,
        fontFamily: 'Poppins-Regular',
    },
    form: {
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
        fontFamily: 'Poppins-SemiBold',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    textAreaContainer: {
        alignItems: 'flex-start',
        paddingVertical: 12,
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 15,
        fontFamily: 'Poppins-Regular',
    },
    textArea: {
        minHeight: 120,
        textAlignVertical: 'top',
    },
    submitButton: {
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 8,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
    },
    submitText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        fontFamily: 'Poppins-Bold',
    },
    contactInfo: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    contactInfoTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 16,
        fontFamily: 'Poppins-Bold',
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    contactIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    contactDetails: {
        flex: 1,
    },
    contactLabel: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 2,
        fontFamily: 'Poppins-Regular',
    },
    contactValue: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
        fontFamily: 'Poppins-SemiBold',
    },
});
