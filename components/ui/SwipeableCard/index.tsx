/**
 * Swipeable Card Component
 * Premium card with swipe gestures
 */

import React from 'react';
import { Animated, PanResponder, StyleSheet } from 'react-native';
import { Card } from '../Card';

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  swipeThreshold?: number;
  style?: any;
  variant?: 'default' | 'elevated' | 'outlined' | 'gradient';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  swipeThreshold = 100,
  style,
  variant = 'default',
  padding = 'md',
}) => {
  const pan = React.useRef(new Animated.ValueXY()).current;

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        
        const { dx, dy } = gestureState;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        
        if (absDx > absDy && absDx > swipeThreshold) {
          // Horizontal swipe
          if (dx > 0 && onSwipeRight) {
            onSwipeRight();
          } else if (dx < 0 && onSwipeLeft) {
            onSwipeLeft();
          }
        } else if (absDy > absDx && absDy > swipeThreshold) {
          // Vertical swipe
          if (dy > 0 && onSwipeDown) {
            onSwipeDown();
          } else if (dy < 0 && onSwipeUp) {
            onSwipeUp();
          }
        }
        
        // Reset position
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
          tension: 300,
          friction: 10,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        },
        style,
      ]}
      {...panResponder.panHandlers}
    >
      <Card variant={variant} padding={padding}>
        {children}
      </Card>
    </Animated.View>
  );
};

const styles = StyleSheet.create({});

export default SwipeableCard;

