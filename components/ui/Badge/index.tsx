import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  showGradient?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  showGradient = false,
}) => {
  const theme = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          gradient: theme.colors.gradient.success,
          solid: theme.colors.semantic.success,
          text: '#ffffff',
        };
      case 'warning':
        return {
          gradient: theme.colors.gradient.warning,
          solid: theme.colors.semantic.warning,
          text: '#ffffff',
        };
      case 'danger':
        return {
          gradient: theme.colors.gradient.danger,
          solid: theme.colors.semantic.danger,
          text: '#ffffff',
        };
      case 'info':
        return {
          gradient: theme.colors.gradient.primary,
          solid: theme.colors.primary.main,
          text: '#ffffff',
        };
      case 'secondary':
        return {
          gradient: theme.colors.gradient.secondary,
          solid: theme.colors.accent.main,
          text: '#ffffff',
        };
      default:
        return {
          gradient: theme.colors.gradient.primary,
          solid: theme.colors.primary.main,
          text: '#ffffff',
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: 4,
          paddingHorizontal: 8,
          fontSize: 11,
          iconSize: 12,
        };
      case 'lg':
        return {
          paddingVertical: 8,
          paddingHorizontal: 16,
          fontSize: 14,
          iconSize: 16,
        };
      default:
        return {
          paddingVertical: 6,
          paddingHorizontal: 12,
          fontSize: 12,
          iconSize: 14,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const content = (
    <View style={[styles.content, { flexDirection: 'row', alignItems: 'center' }]}>
      {icon && iconPosition === 'left' && (
        <Ionicons
          name={icon}
          size={sizeStyles.iconSize}
          color={variantStyles.text}
          style={{ marginRight: 4 }}
        />
      )}
      <Text
        style={[
          styles.label,
          {
            color: variantStyles.text,
            fontSize: sizeStyles.fontSize,
            fontWeight: '600',
          },
        ]}
      >
        {label}
      </Text>
      {icon && iconPosition === 'right' && (
        <Ionicons
          name={icon}
          size={sizeStyles.iconSize}
          color={variantStyles.text}
          style={{ marginLeft: 4 }}
        />
      )}
    </View>
  );

  if (showGradient) {
    return (
      <LinearGradient
        colors={variantStyles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.badge,
          {
            paddingVertical: sizeStyles.paddingVertical,
            paddingHorizontal: sizeStyles.paddingHorizontal,
            borderRadius: theme.radius.full,
          },
        ]}
      >
        {content}
      </LinearGradient>
    );
  }

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: variantStyles.solid,
          paddingVertical: sizeStyles.paddingVertical,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          borderRadius: theme.radius.full,
        },
      ]}
    >
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
  },
});

