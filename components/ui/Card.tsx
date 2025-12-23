/**
 * Reusable Card Component
 * Consistent card styling with gradient backgrounds
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../constants/theme';

interface CardProps {
    children: React.ReactNode;
    variant?: 'default' | 'elevated' | 'outlined' | 'gradient';
    padding?: keyof typeof theme.spacing;
    style?: ViewStyle;
    gradientColors?: string[];
}

export const Card: React.FC<CardProps> = ({
    children,
    variant = 'default',
    padding = 'lg',
    style,
    gradientColors,
}) => {
    const getCardStyle = (): ViewStyle => {
        const baseStyle: ViewStyle = {
            borderRadius: theme.borderRadius.xl,
            padding: theme.spacing[padding],
        };

        const variantStyles: Record<string, ViewStyle> = {
            default: {
                backgroundColor: theme.colors.background.secondary,
                borderWidth: 1,
                borderColor: theme.colors.border.light,
            },
            elevated: {
                backgroundColor: theme.colors.background.secondary,
                ...theme.shadows.lg,
            },
            outlined: {
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderColor: theme.colors.border.medium,
            },
            gradient: {
                backgroundColor: 'transparent',
            },
        };

        return {
            ...baseStyle,
            ...variantStyles[variant],
            ...style,
        };
    };

    if (variant === 'gradient') {
        const colors = gradientColors || [
            theme.colors.background.secondary,
            'rgba(30, 41, 59, 0.5)',
        ];

        return (
            <View style={getCardStyle()}>
                <LinearGradient
                    colors={colors}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
                <View style={{ position: 'relative', zIndex: 1 }}>{children}</View>
            </View>
        );
    }

    return <View style={getCardStyle()}>{children}</View>;
};
