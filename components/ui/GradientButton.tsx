import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import theme from '../../constants/theme';

interface GradientButtonProps {
    title: string;
    onPress: () => void;
    gradient?: string[];
    icon?: keyof typeof Ionicons.glyphMap;
    iconSize?: number;
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
    fullWidth?: boolean;
}

export function GradientButton({
    title,
    onPress,
    gradient = theme.colors.primary.cyan,
    icon,
    iconSize = 20,
    disabled = false,
    loading = false,
    style,
    textStyle,
    fullWidth = false,
}: GradientButtonProps) {
    const handlePress = () => {
        if (!disabled && !loading) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onPress();
        }
    };

    return (
        <Pressable
            onPress={handlePress}
            disabled={disabled || loading}
            style={({ pressed }) => [
                styles.container,
                fullWidth && styles.fullWidth,
                pressed && styles.pressed,
                (disabled || loading) && styles.disabled,
                style,
            ]}
        >
            <LinearGradient
                colors={disabled || loading ? ['#64748b', '#475569'] : gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                ) : (
                    <>
                        {icon && <Ionicons name={icon} size={iconSize} color="#fff" style={styles.icon} />}
                        <Text style={[styles.text, textStyle]}>{title}</Text>
                    </>
                )}
            </LinearGradient>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
        ...theme.shadows.md,
    },
    fullWidth: {
        width: '100%',
    },
    gradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.xl,
        gap: theme.spacing.sm,
    },
    text: {
        ...theme.typography.bodyBold,
        color: '#fff',
    },
    icon: {
        marginRight: theme.spacing.xs,
    },
    pressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }],
    },
    disabled: {
        opacity: 0.6,
    },
});
