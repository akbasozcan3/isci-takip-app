import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface HelpSupportProps {
    onFAQPress: () => void;
    onContactPress: () => void;
    onFeedbackPress: () => void;
}

export function HelpSupport({ onFAQPress, onContactPress, onFeedbackPress }: HelpSupportProps) {
    const handlePress = async (callback: () => void) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        callback();
    };

    const items = [
        {
            icon: 'help-circle-outline' as const,
            label: 'Sıkça Sorulan Sorular',
            desc: 'Yaygın soruların cevapları',
            color: '#0EA5E9',
            bgColor: 'rgba(14, 165, 233, 0.1)',
            onPress: onFAQPress,
        },
        {
            icon: 'chatbubble-ellipses-outline' as const,
            label: 'İletişim',
            desc: 'Bizimle iletişime geçin',
            color: '#10b981',
            bgColor: 'rgba(16, 185, 129, 0.1)',
            onPress: onContactPress,
        },
        {
            icon: 'star-outline' as const,
            label: 'Geri Bildirim',
            desc: 'Önerilerinizi paylaşın',
            color: '#f59e0b',
            bgColor: 'rgba(245, 158, 11, 0.1)',
            onPress: onFeedbackPress,
        },
    ];

    return (
        <Reanimated.View entering={FadeInDown.delay(350).springify()} style={styles.container}>
            <Text style={styles.sectionTitle}>Yardım & Destek</Text>

            <View style={styles.settingsGroup}>
                {items.map((item, index) => (
                    <React.Fragment key={index}>
                        <Pressable
                            style={({ pressed }) => [
                                styles.settingItem,
                                pressed && styles.settingItemPressed
                            ]}
                            onPress={() => handlePress(item.onPress)}
                        >
                            <View style={[styles.settingIcon, { backgroundColor: item.bgColor }]}>
                                <Ionicons name={item.icon} size={20} color={item.color} />
                            </View>
                            <View style={styles.settingContent}>
                                <Text style={styles.settingLabel}>{item.label}</Text>
                                <Text style={styles.settingDesc}>{item.desc}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#475569" />
                        </Pressable>
                        {index < items.length - 1 && <View style={styles.divider} />}
                    </React.Fragment>
                ))}
            </View>
        </Reanimated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#94a3b8',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontFamily: 'Poppins-Bold',
    },
    settingsGroup: {
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    settingItemPressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    settingIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingContent: {
        flex: 1,
    },
    settingLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 2,
        fontFamily: 'Poppins-SemiBold',
    },
    settingDesc: {
        fontSize: 12,
        color: '#64748b',
        fontFamily: 'Poppins-Regular',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginHorizontal: 16,
    },
});
