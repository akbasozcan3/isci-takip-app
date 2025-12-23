/**
 * Reusable Badge Component
 * Status badges with different variants
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { theme } from '../../constants/theme';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'success' | 'error' | 'warning' | 'info' | 'primary' | 'secondary';
    size?: 'sm' | 'md' | 'lg';
    style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    style,
}) => {
    const getContainerStyle = (): ViewStyle => {
        const baseStyle: ViewStyle = {
            borderRadius: theme.borderRadius.full,
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'flex-start',
        };

        const sizeStyles: Record<string, ViewStyle> = {
            sm: {
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: 2,
            },
            md: {
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.xs,
            },
            lg: {
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.sm,
            },
        };

        const variantStyles: Record<string, ViewStyle> = {
            success: {
                backgroundColor: `${theme.colors.success.main}20`,
            },
            error: {
                backgroundColor: `${theme.colors.error.main}20`,
            },
            warning: {
                backgroundColor: `${theme.colors.warning.main}20`,
            },
            info: {
                backgroundColor: `${theme.colors.info.main}20`,
            },
            primary: {
                backgroundColor: `${theme.colors.primary[500]}20`,
            },
            secondary: {
                backgroundColor: `${theme.colors.secondary[500]}20`,
            },
        };

        return {
            ...baseStyle,
            ...sizeStyles[size],
            ...variantStyles[variant],
            ...style,
        };
    };

    const getTextStyle = (): TextStyle => {
        const sizeStyles: Record<string, TextStyle> = {
            sm: {
                fontSize: theme.typography.fontSize.xs,
            },
            md: {
                fontSize: theme.typography.fontSize.sm,
            },
            lg: {
                fontSize: theme.typography.fontSize.base,
            },
        };

        const variantStyles: Record<string, TextStyle> = {
            success: {
                color: theme.colors.success.main,
            },
            error: {
                color: theme.colors.error.main,
            },
            warning: {
                color: theme.colors.warning.main,
            },
            info: {
                color: theme.colors.info.main,
            },
            primary: {
                color: theme.colors.primary[500],
            },
            secondary: {
                color: theme.colors.secondary[500],
            },
        };

        return {
            fontFamily: theme.typography.fontFamily.semiBold,
            fontWeight: theme.typography.fontWeight.semiBold,
            ...sizeStyles[size],
            ...variantStyles[variant],
        };
    };

    return (
        <View style={getContainerStyle()}>
            <Text style={getTextStyle()}>{children}</Text>
        </View>
    );
};
