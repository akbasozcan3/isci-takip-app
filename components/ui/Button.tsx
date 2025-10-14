import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, ColorValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import theme from './theme';

interface Props {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  variant?: 'primary' | 'secondary' | 'danger';
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const Button: React.FC<Props> = ({ title, onPress, loading, disabled, style, variant = 'primary', accessibilityLabel, accessibilityHint }) => {
  const gradientColors: [ColorValue, ColorValue] =
    variant === 'danger' ? ['#ef4444', '#dc2626'] :
    variant === 'secondary' ? ['#64748b', '#475569'] :
    [theme.colors.primary, theme.colors.primaryDark];
  const textColor = '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.pressable, (disabled || loading) && styles.disabled, pressed && { opacity: 0.95 }, style]}
    >
      <LinearGradient colors={gradientColors} style={styles.gradient} start={[0,0]} end={[1,1]}>
        <Text style={[styles.title, { color: textColor }]}>{loading ? 'Lütfen bekleyin...' : title}</Text>
      </LinearGradient>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  title: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  disabled: {
    opacity: 0.6,
  },
});

export default Button;
