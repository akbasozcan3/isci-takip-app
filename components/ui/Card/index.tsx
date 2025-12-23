import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export interface CardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'elevated' | 'outlined' | 'gradient' | 'glass';
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
      backgroundColor: variant === 'elevated' ? theme.colors.surfaceElevated : theme.colors.surface,
      borderColor: theme.colors.border,
      padding: getPadding(),
    },
    variant === 'outlined' && { borderWidth: 1 },
    style,
  ];

  if (variant === 'glass') {
    return (
      <View style={[styles.base, styles.glass, { padding: getPadding() }, style]}>
        {children}
      </View>
    );
  }

  if (variant === 'gradient') {
    return (
      <View style={[styles.base, { padding: getPadding() }, style]}>
        <LinearGradient
          colors={theme.colors.gradients.background.slice(0, 2) as [string, string]}
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
    borderRadius: 24,
    overflow: 'hidden',
  },
  glass: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  }
});

export default Card;
