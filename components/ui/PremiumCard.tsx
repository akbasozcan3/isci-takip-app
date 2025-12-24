import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import theme from '../constants/theme';

interface PremiumCardProps {
    children: React.ReactNode;
    gradient?: string[];
    style?: ViewStyle;
    borderColor?: string;
    noPadding?: boolean;
}

export function PremiumCard({
    children,
    gradient,
    style,
    borderColor = theme.colors.border.primary,
    noPadding = false
}: PremiumCardProps) {
    if (gradient) {
        return (
            <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.card, noPadding && styles.noPadding, style]}
            >
                {children}
            </LinearGradient>
        );
    }

    return (
        <View style={[styles.card, { borderColor }, noPadding && styles.noPadding, style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: theme.colors.background.card,
        borderRadius: theme.borderRadius.xl,
        padding: theme.spacing.xl,
        borderWidth: 1.5,
        ...theme.shadows.lg,
    },
    noPadding: {
        padding: 0,
    },
});
