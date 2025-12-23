import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '../../contexts/ProfileContext';

interface HeaderAction {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    badge?: number;
}

interface SharedHeaderProps {
    title: string;
    subtitle?: string;
    actions?: HeaderAction[];
    showAvatar?: boolean;
}

export function SharedHeader({
    title,
    subtitle,
    actions = [],
    showAvatar = true
}: SharedHeaderProps) {
    const { avatarUrl } = useProfile();

    return (
        <LinearGradient colors={['#0369a1', '#0c4a6e']} style={styles.header}>
            <View style={styles.headerTop}>
                <View style={styles.headerLeft}>
                    {showAvatar && (
                        <View style={styles.headerAvatarContainer}>
                            {avatarUrl ? (
                                <Image source={{ uri: avatarUrl }} style={styles.headerAvatar} />
                            ) : (
                                <View style={styles.headerAvatarPlaceholder}>
                                    <Ionicons name="person" size={24} color="#fff" />
                                </View>
                            )}
                        </View>
                    )}
                    <View style={styles.headerTextBlock}>
                        <Text style={styles.brandLabel}>BAVAXE PLATFORMU</Text>
                        <Text style={styles.headerTitle}>{title}</Text>
                        {subtitle && (
                            <Text style={styles.headerSubtitle}>{subtitle}</Text>
                        )}
                    </View>
                </View>

                <View style={styles.headerActions}>
                    {actions.map((action, index) => (
                        <Pressable
                            key={index}
                            onPress={action.onPress}
                            style={({ pressed }) => [
                                styles.headerIconButton,
                                pressed && styles.headerIconButtonPressed
                            ]}
                        >
                            <Ionicons name={action.icon} size={20} color="#fff" />
                            {action.badge !== undefined && action.badge > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>
                                        {action.badge > 99 ? '99+' : action.badge}
                                    </Text>
                                </View>
                            )}
                        </Pressable>
                    ))}
                </View>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingTop: 16,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    headerTextBlock: {
        flex: 1,
    },
    brandLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.85)',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        fontFamily: 'Poppins-SemiBold',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 0.5,
        fontFamily: 'Poppins-Bold',
    },
    headerSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.9)',
        marginTop: 3,
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIconButton: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        marginLeft: 8,
    },
    headerIconButtonPressed: {
        backgroundColor: 'rgba(255,255,255,0.3)',
        transform: [{ scale: 0.95 }],
    },
    headerAvatarContainer: {
        width: 52,
        height: 52,
        borderRadius: 26,
        overflow: 'hidden',
        borderWidth: 2.5,
        borderColor: 'rgba(255,255,255,0.4)',
        shadowColor: '#0369a1',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 5,
    },
    headerAvatar: {
        width: '100%',
        height: '100%',
    },
    headerAvatarPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#0c4a6e',
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
        fontFamily: 'Poppins-Bold',
    },
});
