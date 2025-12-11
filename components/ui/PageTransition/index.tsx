/**
 * Page Transition Component
 * Smooth page transitions with animations
 */

import React from 'react';
import { Animated, StyleSheet } from 'react-native';

interface PageTransitionProps {
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down' | 'fade';
  duration?: number;
  style?: any;
}

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  direction = 'fade',
  duration = 300,
  style,
}) => {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateX = React.useRef(new Animated.Value(direction === 'left' ? 50 : direction === 'right' ? -50 : 0)).current;
  const translateY = React.useRef(new Animated.Value(direction === 'up' ? 50 : direction === 'down' ? -50 : 0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity,
          transform: [
            { translateX: direction === 'left' || direction === 'right' ? translateX : 0 },
            { translateY: direction === 'up' || direction === 'down' ? translateY : 0 },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default PageTransition;

