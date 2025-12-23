/**
 * Confetti Component
 * Celebration animation for achievements
 */

import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';

interface ConfettiProps {
  visible: boolean;
  duration?: number;
  particleCount?: number;
}

export const Confetti: React.FC<ConfettiProps> = ({
  visible,
  duration = 2000,
  particleCount = 50,
}) => {
  const theme = useTheme();
  const particles = React.useRef(
    Array.from({ length: particleCount }, (_, i) => {
      const initialX = Math.random() * 100;
      return {
      id: i,
        x: new Animated.Value(initialX),
        initialX,
      y: new Animated.Value(-10),
      rotation: new Animated.Value(0),
      opacity: new Animated.Value(1),
      color: [
          theme.colors.primary,
          theme.colors.success,
          theme.colors.warning,
          theme.colors.accent,
      ][Math.floor(Math.random() * 4)],
      };
    })
  ).current;

  React.useEffect(() => {
    if (visible) {
      particles.forEach((particle) => {
        Animated.parallel([
          Animated.timing(particle.y, {
            toValue: 110,
            duration: duration + Math.random() * 1000,
            useNativeDriver: false,
          }),
          Animated.timing(particle.x, {
            toValue: particle.initialX + (Math.random() - 0.5) * 50,
            duration: duration + Math.random() * 1000,
            useNativeDriver: false,
          }),
          Animated.timing(particle.rotation, {
            toValue: Math.random() * 360,
            duration: duration + Math.random() * 1000,
            useNativeDriver: false,
          }),
          Animated.sequence([
            Animated.delay(duration * 0.7),
            Animated.timing(particle.opacity, {
              toValue: 0,
              duration: duration * 0.3,
              useNativeDriver: false,
            }),
          ]),
        ]).start();
      });
    } else {
      particles.forEach((particle) => {
        particle.y.setValue(-10);
        particle.x.setValue(Math.random() * 100);
        particle.rotation.setValue(0);
        particle.opacity.setValue(1);
      });
    }
  }, [visible, duration]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((particle) => (
        <Animated.View
          key={particle.id}
          style={[
            styles.particle,
            {
              left: particle.x.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
              top: particle.y.interpolate({
                inputRange: [-10, 110],
                outputRange: ['-10%', '110%'],
              }),
              backgroundColor: particle.color,
              opacity: particle.opacity,
              transform: [
                {
                  rotate: particle.rotation.interpolate({
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default Confetti;

