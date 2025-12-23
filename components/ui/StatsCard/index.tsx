import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  onPress?: () => void;
  variant?: 'default' | 'gradient' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconColor,
  trend,
  onPress,
  variant = 'default',
  size = 'md',
}) => {
  const theme = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (onPress) {
      Animated.spring(scaleAnim, {
        toValue: 0.98,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }).start();
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          padding: theme.spacing.md,
          titleSize: 12,
          valueSize: 20,
          iconSize: 20,
        };
      case 'lg':
        return {
          padding: theme.spacing.xl,
          titleSize: 14,
          valueSize: 32,
          iconSize: 32,
        };
      default:
        return {
          padding: theme.spacing.lg,
          titleSize: 13,
          valueSize: 24,
          iconSize: 24,
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const defaultIconColor = iconColor || theme.colors.primary;

  const content = (
    <View style={styles.content}>
      <View style={styles.header}>
        <Text
          style={[
            styles.title,
            {
              color: theme.colors.textSecondary,
              fontSize: sizeStyles.titleSize,
            },
          ]}
        >
          {title}
        </Text>
        {icon && (
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: `${defaultIconColor}20`,
                borderRadius: theme.borderRadius.md,
                padding: 6,
              },
            ]}
          >
            <Ionicons name={icon} size={sizeStyles.iconSize} color={defaultIconColor} />
          </View>
        )}
      </View>

      <View style={styles.valueContainer}>
        <Text
          style={[
            styles.value,
            {
              color: theme.colors.text,
              fontSize: sizeStyles.valueSize,
            },
          ]}
        >
          {value}
        </Text>
        {trend && (
          <View style={styles.trendContainer}>
            <Ionicons
              name={trend.isPositive ? 'trending-up' : 'trending-down'}
              size={14}
              color={trend.isPositive ? theme.colors.success : theme.colors.error}
            />
            <Text
              style={[
                styles.trendText,
                {
                  color: trend.isPositive
                    ? theme.colors.success
                    : theme.colors.error,
                },
              ]}
            >
              {Math.abs(trend.value)}%
            </Text>
          </View>
        )}
      </View>

      {subtitle && (
        <Text
          style={[
            styles.subtitle,
            {
              color: theme.colors.textTertiary,
              fontSize: sizeStyles.titleSize - 1,
            },
          ]}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );

  const cardStyle = [
    styles.card,
    {
      padding: sizeStyles.padding,
      borderRadius: theme.borderRadius.lg,
    },
    variant === 'outlined' && {
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: 'transparent',
    },
    variant === 'default' && {
      backgroundColor: theme.colors.surfaceElevated,
    },
  ];

  if (variant === 'gradient') {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!onPress}
        style={({ pressed }) => [
          styles.pressable,
          pressed && { opacity: 0.9 },
        ]}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <LinearGradient
            colors={theme.colors.gradients.primary.slice(0, 2) as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[cardStyle, { overflow: 'hidden' }]}
          >
            {content}
          </LinearGradient>
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.pressable,
        pressed && { opacity: 0.9 },
      ]}
    >
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, cardStyle]}>
        {content}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontWeight: '500',
    flex: 1,
  },
  iconContainer: {
    marginLeft: 8,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  value: {
    fontWeight: '700',
    marginRight: 8,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  subtitle: {
    fontWeight: '400',
  },
});

