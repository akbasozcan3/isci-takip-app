import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

type Bubble = {
  id: number;
  size: number;
  x: number;
  y: number;
  duration: number;
  delay: number;
};

export function AnimatedBubbles() {
  const bubbles: Bubble[] = React.useMemo(() => {
    const bubbleCount = 15;
    return Array.from({ length: bubbleCount }, (_, i) => ({
      id: i,
      size: Math.random() * 80 + 40,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 8000 + 10000,
      delay: Math.random() * 2000,
    }));
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      {bubbles.map((bubble) => (
        <Bubble key={bubble.id} {...bubble} />
      ))}
    </View>
  );
}

function Bubble({ size, x, y, duration, delay }: Bubble) {
  const startY = useRef(Math.random() * 200 + 100).current;
  const translateY = useRef(new Animated.Value(startY)).current;
  const opacity = useRef(new Animated.Value(0.1)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    opacity.setValue(0.1);
    scale.setValue(0.8);

    const animate = () => {
      Animated.parallel([
        Animated.loop(
          Animated.sequence([
            Animated.timing(translateY, {
              toValue: -600,
              duration: duration,
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: startY,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.4,
              duration: duration / 3,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0.15,
              duration: duration / 3,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0.4,
              duration: duration / 3,
              useNativeDriver: true,
            }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(scale, {
              toValue: 1.3,
              duration: duration / 2,
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 0.7,
              duration: duration / 2,
              useNativeDriver: true,
            }),
          ])
        ),
      ]).start();
    };

    const timer = setTimeout(() => {
      animate();
    }, delay);

    return () => clearTimeout(timer);
  }, [duration, delay]);

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          width: size,
          height: size,
          left: `${x}%`,
          top: `${y}%`,
          borderRadius: size / 2,
          transform: [
            { translateY },
            { scale },
          ],
          opacity,
        },
      ]}
    >
      <View style={[styles.bubbleInner, { borderRadius: size / 2 }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  bubble: {
    position: 'absolute',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
  },
  bubbleInner: {
    flex: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    margin: 2,
  },
});
