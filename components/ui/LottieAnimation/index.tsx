/**
 * Lottie Animation Component
 * Premium animations using Lottie (if available)
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

interface LottieAnimationProps {
  source: any; // Lottie animation JSON
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
  style?: any;
  width?: number;
  height?: number;
}

export const LottieAnimation: React.FC<LottieAnimationProps> = ({
  source,
  autoPlay = true,
  loop = true,
  speed = 1,
  style,
  width = 200,
  height = 200,
}) => {
  // Try to use Lottie if available, otherwise show placeholder
  try {
    const LottieView = require('lottie-react-native').default;
    
    return (
      <View style={[styles.container, { width, height }, style]}>
        <LottieView
          source={source}
          autoPlay={autoPlay}
          loop={loop}
          speed={speed}
          style={styles.animation}
        />
      </View>
    );
  } catch (error) {
    // Fallback: Show simple animated view
    return (
      <View style={[styles.container, { width, height }, style]}>
        <View style={styles.placeholder} />
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  animation: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
});

export default LottieAnimation;

