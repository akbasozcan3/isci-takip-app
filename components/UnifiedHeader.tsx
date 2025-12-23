import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    View,
    Image,
    Animated,
} from 'react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { NetworkStatusIcon } from './NetworkStatusIcon';
import { useProfile } from '../contexts/ProfileContext';

interface UnifiedHeaderProps {
    title: string;
    subtitle?: string;
    gradientColors: [string, string, ...string[]];
    showProfile?: boolean;
    showNetwork?: boolean;
    showBack?: boolean;  // NEW: Show back button
    onBackPress?: () => void;  // NEW: Custom back handler
    profileName?: string;  // Optional override
    avatarUrl?: string | null;  // Optional override
    onProfilePress?: () => void;
    actions?: React.ReactNode;
    brandLabel?: string;
}

export function UnifiedHeader({
    title,
    subtitle,
    gradientColors,
    showProfile = true,
    showNetwork = true,
    showBack = false,  // NEW
    onBackPress,  // NEW
    profileName: profileNameProp,
    avatarUrl: avatarUrlProp,
    onProfilePress,
    actions,
    brandLabel,
}: UnifiedHeaderProps) {
    const router = useRouter();
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    // Get profile data from context
    const { avatarUrl: contextAvatarUrl, userName: contextUserName } = useProfile();

    // Use prop values if provided, otherwise use context values
    const avatarUrl = avatarUrlProp !== undefined ? avatarUrlProp : contextAvatarUrl;
    const profileName = profileNameProp !== undefined ? profileNameProp : contextUserName;

    const initials = React.useMemo(() => {
        if (!profileName) return '';
        return profileName
            .split(' ')
            .map((s) => s[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
    }, [profileName]);

    // Shimmer animation for premium effect
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 2500,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0,
                    duration: 2500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const shimmerTranslate = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-300, 300],
    });

    const shimmerOpacity = shimmerAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 0.15, 0],
    });

    const handleProfilePress = () => {
        if (onProfilePress) {
            onProfilePress();
        } else {
            router.push('/(tabs)/profile');
        }
    };

    // NEW: Handle back button press
    const handleBackPress = () => {
        if (onBackPress) {
            onBackPress();
        } else {
            // Use router.back() for proper navigation
            if (router.canGoBack()) {
                router.back();
            } else {
                // Fallback to home if no history
                router.replace('/(tabs)');
            }
        }
    };

    return (
        <View style={styles.headerWrapper}>
            <LinearGradient
                colors={gradientColors.length >= 2 ? gradientColors : ['#14b8a6', '#06b6d4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                {/* Shimmer effect overlay */}
                <Animated.View
                    style={[
                        styles.shimmerOverlay,
                        {
                            transform: [{ translateX: shimmerTranslate }],
                            opacity: shimmerOpacity,
                        },
                    ]}
                />

                {/* Decorative circles */}
                <View style={styles.decorativeCircle1} />
                <View style={styles.decorativeCircle2} />

                <Reanimated.View
                    entering={FadeInDown.delay(100).springify()}
                    style={styles.headerContent}
                >
                    <View style={styles.headerLeft}>
                        {/* NEW: Back Button */}
                        {showBack && (
                            <Pressable
                                onPress={handleBackPress}
                                style={({ pressed }) => [
                                    styles.backButton,
                                    pressed && styles.backButtonPressed,
                                ]}
                            >
                                <Ionicons name="arrow-back" size={24} color="#fff" />
                            </Pressable>
                        )}

                        {showProfile && !showBack && (
                            <Pressable
                                onPress={handleProfilePress}
                                style={({ pressed }) => [
                                    styles.headerAvatarContainer,
                                    pressed && styles.headerAvatarPressed,
                                ]}
                            >
                                {avatarUrl ? (
                                    <Image source={{ uri: avatarUrl }} style={styles.headerAvatar} />
                                ) : (
                                    <LinearGradient
                                        colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.15)']}
                                        style={styles.headerAvatarPlaceholder}
                                    >
                                        <Ionicons name="person" size={26} color="#fff" />
                                    </LinearGradient>
                                )}
                                {/* Online indicator */}
                                <View style={styles.onlineIndicator} />
                            </Pressable>
                        )}
                        <View style={styles.headerTextBlock}>
                            {brandLabel && (
                                <View style={styles.brandLabelContainer}>
                                    <View style={styles.brandDot} />
                                    <Text style={styles.brandLabel}>{brandLabel}</Text>
                                </View>
                            )}
                            <Text style={styles.title} numberOfLines={1}>{title}</Text>
                            {subtitle && (
                                <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
                            )}
                        </View>
                    </View>

                    <View style={styles.headerRight}>
                        {actions}
                        {showNetwork && (
                            <View style={styles.networkIconContainer}>
                                <View style={styles.networkIcon}>
                                    <NetworkStatusIcon size={18} />
                                </View>
                            </View>
                        )}
                    </View>
                </Reanimated.View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    headerWrapper: {
        marginBottom: 4,
    },
    header: {
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 16 : 16,
        paddingHorizontal: 20,
        paddingBottom: 24,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        shadowColor: '#06b6d4',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
        elevation: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    shimmerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: 200,
        backgroundColor: 'rgba(255,255,255,1)',
        transform: [{ skewX: '-20deg' }],
    },
    decorativeCircle1: {
        position: 'absolute',
        top: -40,
        right: -20,
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    decorativeCircle2: {
        position: 'absolute',
        bottom: -30,
        left: -30,
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 1,
    },
    headerLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    headerTextBlock: {
        flex: 1,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.25)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    backButtonPressed: {
        transform: [{ scale: 0.92 }],
        backgroundColor: 'rgba(255,255,255,0.25)',
        opacity: 0.9,
    },
    brandLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    brandDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#fff',
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
    brandLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.95)',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        fontFamily: 'Poppins-SemiBold',
        fontWeight: '600',
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 0.3,
        fontFamily: 'Poppins-Bold',
        textShadowColor: 'rgba(0,0,0,0.15)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    subtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.92)',
        marginTop: 4,
        fontWeight: '500',
        fontFamily: 'Poppins-Medium',
        letterSpacing: 0.2,
    },
    networkIconContainer: {
        position: 'relative',
    },
    networkIcon: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.18)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    headerAvatarContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.5)',
        position: 'relative',
    },
    headerAvatarPressed: {
        transform: [{ scale: 0.95 }],
        opacity: 0.9,
    },
    headerAvatar: {
        width: '100%',
        height: '100%',
    },
    headerAvatarPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#10b981',
        borderWidth: 2.5,
        borderColor: '#fff',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
});
