import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface CardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'elevated' | 'outlined' | 'gradient';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'default',
  padding = 'md',
}) => {
  const theme = useTheme();

  const getPadding = () => {
    switch (padding) {
      case 'none':
        return 0;
      case 'sm':
        return theme.spacing.sm;
      case 'lg':
        return theme.spacing.lg;
      default:
        return theme.spacing.md;
    }
  };

  const cardStyle = [
    styles.base,
    {
      backgroundColor: variant === 'elevated' ? theme.colors.surface.elevated : theme.colors.surface.default,
      borderColor: theme.colors.border.default,
      padding: getPadding(),
    },
    variant === 'outlined' && { borderWidth: 1 },
    style,
  ];

  if (variant === 'gradient') {
    return (
      <View style={[styles.base, { padding: getPadding() }, style]}>
        <LinearGradient
          colors={theme.colors.gradient.dark as [string, string]}
          style={StyleSheet.absoluteFill}
          start={[0, 0]}
          end={[1, 1]}
        />
        <View style={{ position: 'relative', zIndex: 1 }}>{children}</View>
      </View>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    overflow: 'hidden',
  },
});

export default Card;
