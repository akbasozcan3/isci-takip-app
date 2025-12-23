/**
 * Reusable Button Component
 * Consistent button styling across the app
 */

import React from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../constants/theme';

interface ButtonProps {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    onPress: () => void;
    children: React.ReactNode;
    disabled?: boolean;
    loading?: boolean;
    fullWidth?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    onPress,
    children,
    disabled = false,
    loading = false,
    fullWidth = false,
    style,
    textStyle,
}) => {
    const getButtonStyles = () => {
        const baseStyle: ViewStyle = {
            borderRadius: theme.borderRadius.md,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
        };

        // Size styles
        const sizeStyles: Record<string, ViewStyle> = {
            sm: {
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                minHeight: 36,
            },
            md: {
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.md,
                minHeight: 48,
            },
            lg: {
                paddingHorizontal: theme.spacing.xl,
                paddingVertical: theme.spacing.lg,
                minHeight: 56,
            },
        };

        // Variant styles
        const variantStyles: Record<string, ViewStyle> = {
            outline: {
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderColor: theme.colors.primary[500],
            },
            ghost: {
                backgroundColor: 'transparent',
            },
        };

        return [
            baseStyle,
            sizeStyles[size],
            variantStyles[variant],
            fullWidth && { width: '100%' },
            disabled && { opacity: 0.5 },
            style,
        ];
    };

    const getTextStyles = () => {
        const baseStyle: TextStyle = {
            fontFamily: theme.typography.fontFamily.semiBold,
            fontWeight: theme.typography.fontWeight.semiBold,
        };

        // Size styles
        const sizeStyles: Record<string, TextStyle> = {
            sm: {
                fontSize: theme.typography.fontSize.sm,
            },
            md: {
                fontSize: theme.typography.fontSize.base,
            },
            lg: {
                fontSize: theme.typography.fontSize.lg,
            },
        };

        // Variant styles
        const variantStyles: Record<string, TextStyle> = {
            primary: {
                color: theme.colors.text.primary,
            },
            secondary: {
                color: theme.colors.text.primary,
            },
            outline: {
                color: theme.colors.primary[500],
            },
            ghost: {
                color: theme.colors.primary[500],
            },
        };

        return [
            baseStyle,
            sizeStyles[size],
            variantStyles[variant],
            disabled && { opacity: 0.7 },
            textStyle,
        ];
    };

    const getGradientColors = () => {
        switch (variant) {
            case 'primary':
                return [theme.colors.primary[500], theme.colors.primary[600]];
            case 'secondary':
                return [theme.colors.secondary[500], theme.colors.secondary[600]];
            default:
                return ['transparent', 'transparent'];
        }
    };

    const renderContent = () => (
        <>
            {loading && (
                <ActivityIndicator
                    color={variant === 'outline' || variant === 'ghost' ? theme.colors.primary[500] : theme.colors.text.primary}
                    style={{ marginRight: theme.spacing.sm }}
                />
            )}
            <Text style={getTextStyles()}>{children}</Text>
        </>
    );

    if (variant === 'primary' || variant === 'secondary') {
        return (
            <TouchableOpacity
                onPress={onPress}
                disabled={disabled || loading}
                activeOpacity={0.8}
                style={getButtonStyles()}
            >
                <LinearGradient
                    colors={getGradientColors()}
                    style={[
                        StyleSheet.absoluteFill,
                        { borderRadius: theme.borderRadius.md },
                    ]}
                />
                {renderContent()}
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.8}
            style={getButtonStyles()}
        >
            {renderContent()}
        </TouchableOpacity>
    );
};
