import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Animated, ColorValue, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from './theme/ThemeContext';

interface Props {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: 'primary' | 'secondary' | 'danger';
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const Button: React.FC<Props> = ({ title, onPress, loading, disabled, style, variant = 'primary', accessibilityLabel, accessibilityHint }) => {
  const theme = useTheme();
  const gradientColors: [ColorValue, ColorValue] =
    variant === 'danger' ? theme.colors.gradient.danger as [ColorValue, ColorValue] :
    variant === 'secondary' ? theme.colors.gradient.secondary as [ColorValue, ColorValue] :
    theme.colors.gradient.primary as [ColorValue, ColorValue];
  const textColor = '#fff';
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const opacityAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, tension: 300, friction: 10 }),
      Animated.timing(opacityAnim, { toValue: 0.9, duration: 100, useNativeDriver: true })
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 100, useNativeDriver: true })
    ]).start();
  };

  const handlePress = () => {
    if (!disabled && !loading && onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPress();
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={[styles.pressable, (disabled || loading) && styles.disabled, style]}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: opacityAnim }}>
        <LinearGradient colors={gradientColors} style={styles.gradient} start={[0,0]} end={[1,1]}>
          <Text style={[styles.title, { color: textColor }]}>{loading ? 'Lütfen bekleyin...' : title}</Text>
        </LinearGradient>
      </Animated.View>
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
