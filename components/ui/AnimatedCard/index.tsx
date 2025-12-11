/**
 * Animated Card Component
 * Premium card with advanced animations
 */

import React from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { Card } from '../Card';

interface AnimatedCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
  variant?: 'default' | 'elevated' | 'outlined' | 'gradient';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  onPress,
  style,
  variant = 'default',
  padding = 'md',
  animated = true,
}) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const opacityAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (onPress && animated) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0.98,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.9,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handlePressOut = () => {
    if (onPress && animated) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const cardContent = (
    <Card variant={variant} padding={padding} style={style}>
      {children}
    </Card>
  );

  if (!onPress) {
    return cardContent;
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.pressable}
    >
      <Animated.View
        style={{
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        }}
      >
        {cardContent}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
});

export default AnimatedCard;

