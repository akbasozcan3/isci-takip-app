import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../theme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  style,
}) => {
  const theme = useTheme();

  const getButtonStyles = () => {
    const baseStyle: ViewStyle = {
      height: theme.components.button.height[size],
      paddingHorizontal: theme.components.button.padding[size].horizontal,
      paddingVertical: theme.components.button.padding[size].vertical,
      borderRadius: theme.borderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      opacity: disabled || loading ? 0.6 : 1,
    };

    if (fullWidth) {
      baseStyle.width = '100%';
    }

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          backgroundColor: theme.colors.primary,
        };
      case 'secondary':
        return {
          ...baseStyle,
          backgroundColor: theme.colors.secondary,
        };
      case 'outline':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: theme.colors.primary,
        };
      case 'ghost':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
        };
      case 'danger':
        return {
          ...baseStyle,
          backgroundColor: theme.colors.error,
        };
      default:
        return baseStyle;
    }
  };

  const getTextStyles = () => {
    const baseStyle = {
      fontSize: theme.typography.fontSize[size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'base'],
      fontWeight: theme.typography.fontWeight.semiBold as '600',
      fontFamily: theme.typography.fontFamily.semiBold,
    };

    switch (variant) {
      case 'primary':
      case 'secondary':
      case 'danger':
        return {
          ...baseStyle,
          color: theme.colors.textInverse,
        };
      case 'outline':
        return {
          ...baseStyle,
          color: theme.colors.primary,
        };
      case 'ghost':
        return {
          ...baseStyle,
          color: theme.colors.text,
        };
      default:
        return {
          ...baseStyle,
          color: theme.colors.text,
        };
    }
  };

  const buttonContent = (
    <>
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? theme.colors.primary : theme.colors.textInverse}
          size="small"
        />
      ) : (
        <>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={getTextStyles()}>{title}</Text>
        </>
      )}
    </>
  );

  if (variant === 'primary' && !disabled && !loading) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={[getButtonStyles(), style]}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
      >
        <LinearGradient
          colors={theme.colors.gradients.primary as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: theme.borderRadius.lg }]}
        />
        <View style={styles.content}>{buttonContent}</View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[getButtonStyles(), style]}
      android_ripple={{
        color: variant === 'outline' || variant === 'ghost' ? theme.colors.primary + '20' : 'rgba(255,255,255,0.2)',
      }}
    >
      {buttonContent}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },
});

export default Button;
