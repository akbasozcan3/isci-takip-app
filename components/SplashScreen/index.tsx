/**
 * Premium Splash Screen
 * Professional white background splash screen with elegant logo
 */

import React from 'react';
import { Animated, Dimensions, Image, StyleSheet, View } from 'react-native';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const scaleAnim = React.useRef(new Animated.Value(0.6)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Logo entrance animation with elegant spring
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 40,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();

    // Finish after 2.5 seconds
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onFinish();
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      {/* Subtle background pattern */}
      <View style={styles.backgroundPattern}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <View style={styles.circle3} />
      </View>

      {/* Main content */}
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          <Image
            source={require('../../Nexora (2).png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  backgroundPattern: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  circle1: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: (width * 1.2) / 2,
    backgroundColor: 'rgba(6, 182, 212, 0.03)',
    top: -width * 0.3,
    right: -width * 0.2,
  },
  circle2: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: (width * 0.8) / 2,
    backgroundColor: 'rgba(124, 58, 237, 0.02)',
    bottom: -width * 0.2,
    left: -width * 0.15,
  },
  circle3: {
    position: 'absolute',
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: (width * 0.6) / 2,
    backgroundColor: 'rgba(6, 182, 212, 0.02)',
    top: height * 0.3,
    left: width * 0.5,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 12,
  },
  logo: {
    width: 280,
    height: 280,
  },
});
export default SplashScreen;

