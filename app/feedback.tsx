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

const FEEDBACK_TYPES = [
    { id: 'bug', label: 'Hata Bildirimi', icon: 'bug', color: '#ef4444' },
    { id: 'feature', label: 'Özellik İsteği', icon: 'bulb', color: '#f59e0b' },
    { id: 'improvement', label: 'İyileştirme', icon: 'trending-up', color: '#10b981' },
    { id: 'other', label: 'Diğer', icon: 'chatbubble', color: '#0EA5E9' },
];

export default function FeedbackScreen() {
    const router = useRouter();
    const { toast, showSuccess, showError, hideToast } = useToast();
    const [selectedType, setSelectedType] = useState('feature');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!title.trim() || !description.trim()) {
            showError('Lütfen tüm alanları doldurun');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setLoading(true);
        try {
            const response = await authFetch('/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: selectedType,
                    title: title.trim(),
                    description: description.trim(),
                }),
            });

            if (response.ok) {
                showSuccess('Geri bildiriminiz için teşekkürler!');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setTitle('');
                setDescription('');
                setTimeout(() => router.back(), 2000);
            } else {
                const data = await response.json().catch(() => ({}));
                showError(data.error || 'Geri bildirim gönderilemedi');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        } catch (error) {
            console.error('[Feedback] Submit error:', error);
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
                <PremiumBackground color="#f59e0b" lineCount={6} circleCount={4} />

                {/* Header */}
                <View style={styles.header}>
                    <Pressable
                        onPress={() => router.back()}
                        style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </Pressable>
                    <Text style={styles.headerTitle}>Geri Bildirim</Text>
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
                                <Ionicons name="star" size={32} color="#f59e0b" />
                            </View>
                            <Text style={styles.infoTitle}>Fikirlerinizi Paylaşın</Text>
                            <Text style={styles.infoText}>
                                Bavaxe'yi daha iyi hale getirmemize yardımcı olun. Görüşleriniz bizim için çok değerli!
                            </Text>
                        </Reanimated.View>

                        <Reanimated.View entering={FadeInDown.delay(100).springify()} style={styles.form}>
                            <Text style={styles.sectionTitle}>Geri Bildirim Türü</Text>
                            <View style={styles.typeGrid}>
                                {FEEDBACK_TYPES.map((type) => (
                                    <Pressable
                                        key={type.id}
                                        onPress={() => {
                                            setSelectedType(type.id);
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }}
                                        style={({ pressed }) => [
                                            styles.typeCard,
                                            selectedType === type.id && styles.typeCardActive,
                                            pressed && { opacity: 0.7 },
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.typeIcon,
                                                { backgroundColor: `${type.color}20` },
                                                selectedType === type.id && { backgroundColor: type.color },
                                            ]}
                                        >
                                            <Ionicons
                                                name={type.icon as any}
                                                size={24}
                                                color={selectedType === type.id ? '#fff' : type.color}
                                            />
                                        </View>
                                        <Text
                                            style={[
                                                styles.typeLabel,
                                                selectedType === type.id && styles.typeLabelActive,
                                            ]}
                                        >
                                            {type.label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Başlık</Text>
                                <View style={styles.inputContainer}>
                                    <Ionicons name="text-outline" size={20} color="#94a3b8" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Kısa ve açıklayıcı bir başlık"
                                        placeholderTextColor="#64748b"
                                        value={title}
                                        onChangeText={setTitle}
                                        editable={!loading}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Açıklama</Text>
                                <View style={[styles.inputContainer, styles.textAreaContainer]}>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        placeholder="Detaylı açıklama yazın..."
                                        placeholderTextColor="#64748b"
                                        value={description}
                                        onChangeText={setDescription}
                                        multiline
                                        numberOfLines={8}
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
                                    colors={loading ? ['#64748b', '#475569'] : ['#f59e0b', '#d97706']}
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

                        <Reanimated.View entering={FadeInDown.delay(200).springify()} style={styles.tipsCard}>
                            <View style={styles.tipsHeader}>
                                <Ionicons name="bulb-outline" size={20} color="#f59e0b" />
                                <Text style={styles.tipsTitle}>İpuçları</Text>
                            </View>
                            <View style={styles.tipItem}>
                                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                                <Text style={styles.tipText}>Mümkün olduğunca detaylı açıklama yapın</Text>
                            </View>
                            <View style={styles.tipItem}>
                                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                                <Text style={styles.tipText}>Hata bildirirken adımları belirtin</Text>
                            </View>
                            <View style={styles.tipItem}>
                                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                                <Text style={styles.tipText}>Ekran görüntüsü eklemek yardımcı olabilir</Text>
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
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderRadius: 20,
        padding: 24,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.2)',
        alignItems: 'center',
    },
    infoIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
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
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 16,
        fontFamily: 'Poppins-Bold',
    },
    typeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    typeCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    typeCardActive: {
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
    },
    typeIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    typeLabel: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
        fontFamily: 'Poppins-Medium',
    },
    typeLabelActive: {
        color: '#fff',
        fontFamily: 'Poppins-SemiBold',
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
        minHeight: 150,
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
    tipsCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    tipsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    tipsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        fontFamily: 'Poppins-Bold',
    },
    tipItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    tipText: {
        flex: 1,
        fontSize: 14,
        color: '#cbd5e1',
        fontFamily: 'Poppins-Regular',
    },
});
