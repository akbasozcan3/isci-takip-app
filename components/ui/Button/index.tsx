import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  loading,
  disabled,
  style,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
}) => {
  const theme = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const opacityAnim = React.useRef(new Animated.Value(1)).current;

  const getGradientColors = (): string[] => {
    switch (variant) {
      case 'danger':
        return theme.colors.gradient.danger;
      case 'success':
        return theme.colors.gradient.success;
      case 'secondary':
        return theme.colors.gradient.secondary;
      case 'ghost':
        return ['transparent', 'transparent'];
      default:
        return theme.colors.gradient.primary;
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { paddingVertical: 10, paddingHorizontal: 16, fontSize: 14 };
      case 'lg':
        return { paddingVertical: 18, paddingHorizontal: 24, fontSize: 18 };
      default:
        return { paddingVertical: 14, paddingHorizontal: 20, fontSize: 16 };
    }
  };

  const sizeStyles = getSizeStyles();
  const gradientColors = getGradientColors();
  const isGhost = variant === 'ghost';

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.96,
        useNativeDriver: true,
        ...theme.animation.spring,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.9,
        duration: theme.animation.fast,
        useNativeDriver: true,
      }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        ...theme.animation.spring,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: theme.animation.fast,
        useNativeDriver: true,
      }),
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
      style={[
        styles.container,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: opacityAnim }}>
        {isGhost ? (
          <View style={[styles.ghostContainer, { paddingVertical: sizeStyles.paddingVertical, paddingHorizontal: sizeStyles.paddingHorizontal }]}>
            <Text style={[styles.title, { fontSize: sizeStyles.fontSize, color: theme.colors.text.primary }]}>
              {loading ? 'Yükleniyor...' : title}
            </Text>
          </View>
        ) : (
          <LinearGradient
            colors={gradientColors}
            style={[styles.gradient, { paddingVertical: sizeStyles.paddingVertical, paddingHorizontal: sizeStyles.paddingHorizontal }]}
            start={[0, 0]}
            end={[1, 1]}
          >
            <Text style={[styles.title, { fontSize: sizeStyles.fontSize, color: theme.colors.text.primary }]}>
              {loading ? 'Yükleniyor...' : title}
            </Text>
          </LinearGradient>
        )}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  ghostContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  title: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default Button;
