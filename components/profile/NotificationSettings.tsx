import React from 'react';
import { View, Text, StyleSheet, Switch, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface NotificationSettingsProps {
    pushEnabled: boolean;
    emailEnabled: boolean;
    onPushToggle: (value: boolean) => void;
    onEmailToggle: (value: boolean) => void;
}

export function NotificationSettings({
    pushEnabled,
    emailEnabled,
    onPushToggle,
    onEmailToggle,
}: NotificationSettingsProps) {
    const handleToggle = (callback: (value: boolean) => void, currentValue: boolean) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        callback(!currentValue);
    };

    return (
        <Reanimated.View entering={FadeInDown.delay(250).springify()} style={styles.container}>
            <Text style={styles.sectionTitle}>Bildirimler</Text>

            <View style={styles.settingsGroup}>
                <View style={styles.settingItem}>
                    <View style={[styles.settingIcon, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                        <Ionicons name="notifications-outline" size={20} color="#6366f1" />
                    </View>
                    <View style={styles.settingContent}>
                        <Text style={styles.settingLabel}>Push Bildirimleri</Text>
                        <Text style={styles.settingDesc}>Anlık bildirimler al</Text>
                    </View>
                    <Switch
                        value={pushEnabled}
                        onValueChange={(value) => handleToggle(onPushToggle, pushEnabled)}
                        trackColor={{ false: '#334155', true: '#0EA5E9' }}
                        thumbColor={pushEnabled ? '#fff' : '#94a3b8'}
                        ios_backgroundColor="#334155"
                    />
                </View>

                <View style={styles.divider} />

                <View style={styles.settingItem}>
                    <View style={[styles.settingIcon, { backgroundColor: 'rgba(14, 165, 233, 0.1)' }]}>
                        <Ionicons name="mail-outline" size={20} color="#0EA5E9" />
                    </View>
                    <View style={styles.settingContent}>
                        <Text style={styles.settingLabel}>E-posta Bildirimleri</Text>
                        <Text style={styles.settingDesc}>Önemli güncellemeler</Text>
                    </View>
                    <Switch
                        value={emailEnabled}
                        onValueChange={(value) => handleToggle(onEmailToggle, emailEnabled)}
                        trackColor={{ false: '#334155', true: '#0EA5E9' }}
                        thumbColor={emailEnabled ? '#fff' : '#94a3b8'}
                        ios_backgroundColor="#334155"
                    />
                </View>
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
