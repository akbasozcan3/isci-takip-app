/**
 * ErrorDisplay Component
 * User-friendly error display with retry functionality
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface ErrorDisplayProps {
    error: string;
    onRetry?: () => void;
    type?: 'error' | 'warning' | 'info';
    icon?: keyof typeof Ionicons.glyphMap;
    actionText?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
    error,
    onRetry,
    type = 'error',
    icon,
    actionText = 'Tekrar Dene'
}) => {
    const config = {
        error: {
            icon: icon || 'alert-circle',
            color: '#ef4444',
            bgColor: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.3)'
        },
        warning: {
            icon: icon || 'warning',
            color: '#f59e0b',
            bgColor: 'rgba(245, 158, 11, 0.1)',
            borderColor: 'rgba(245, 158, 11, 0.3)'
        },
        info: {
            icon: icon || 'information-circle',
            color: '#0EA5E9',
            bgColor: 'rgba(14, 165, 233, 0.1)',
            borderColor: 'rgba(14, 165, 233, 0.3)'
        }
    }[type];

    const handleRetry = async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onRetry?.();
    };

    return (
        <Animated.View
            entering={FadeInDown.springify()}
            style={[
                styles.container,
                {
                    backgroundColor: config.bgColor,
                    borderColor: config.borderColor
                }
            ]}
        >
            <View style={styles.iconContainer}>
                <Ionicons name={config.icon} size={24} color={config.color} />
            </View>

            <View style={styles.content}>
                <Text style={styles.errorText}>{error}</Text>

                {onRetry && (
                    <Pressable
                        onPress={handleRetry}
                        style={({ pressed }) => [
                            styles.retryButton,
                            { backgroundColor: config.color },
                            pressed && styles.retryButtonPressed
                        ]}
                    >
                        <Ionicons name="refresh" size={16} color="#fff" />
                        <Text style={styles.retryText}>{actionText}</Text>
                    </Pressable>
                )}
            </View>
        </Animated.View>
    );
};

/**
 * EmptyState Component
 * Display when no data is available
 */
interface EmptyStateProps {
    icon?: keyof typeof Ionicons.glyphMap;
    title: string;
    description?: string;
    actionText?: string;
    onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon = 'folder-open-outline',
    title,
    description,
    actionText,
    onAction
}) => {
    const handleAction = async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onAction?.();
    };

    return (
        <View style={styles.emptyContainer}>
            <LinearGradient
                colors={['rgba(14, 165, 233, 0.1)', 'rgba(99, 102, 241, 0.1)']}
                style={styles.emptyIconWrapper}
            >
                <Ionicons name={icon} size={48} color="#0EA5E9" />
            </LinearGradient>

            <Text style={styles.emptyTitle}>{title}</Text>
            {description && <Text style={styles.emptyDescription}>{description}</Text>}

            {onAction && actionText && (
                <Pressable
                    onPress={handleAction}
                    style={({ pressed }) => [
                        styles.emptyButton,
                        pressed && styles.emptyButtonPressed
                    ]}
                >
                    <LinearGradient
                        colors={['#0EA5E9', '#0891b2']}
                        style={styles.emptyButtonGradient}
                    >
                        <Text style={styles.emptyButtonText}>{actionText}</Text>
                    </LinearGradient>
                </Pressable>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginVertical: 8
    },
    iconContainer: {
        marginRight: 12
    },
    content: {
        flex: 1
    },
    errorText: {
        color: '#fff',
        fontSize: 14,
        fontFamily: 'Poppins-Medium',
        lineHeight: 20
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginTop: 12,
        alignSelf: 'flex-start'
    },
    retryButtonPressed: {
        opacity: 0.8
    },
    retryText: {
        color: '#fff',
        fontSize: 13,
        fontFamily: 'Poppins-SemiBold'
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        minHeight: 300
    },
    emptyIconWrapper: {
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24
    },
    emptyTitle: {
        fontSize: 20,
        fontFamily: 'Poppins-Bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 8
    },
    emptyDescription: {
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        color: '#94a3b8',
        textAlign: 'center',
        maxWidth: '80%',
        lineHeight: 20
    },
    emptyButton: {
        marginTop: 24,
        borderRadius: 12,
        overflow: 'hidden'
    },
    emptyButtonPressed: {
        opacity: 0.9
    },
    emptyButtonGradient: {
        paddingVertical: 12,
        paddingHorizontal: 24
    },
    emptyButtonText: {
        color: '#fff',
        fontSize: 15,
        fontFamily: 'Poppins-SemiBold'
    }
});
