/**
 * Network Status Icon Component - Professional Edition
 * Beautiful Wi-Fi icon with connection status and smooth animations
 * Green: Internet + Backend connected ✅
 * Yellow: Internet connected but backend unreachable ⚠️
 * Red: No internet ❌
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { checkNetworkStatus } from '../utils/network';

interface NetworkStatusIconProps {
  size?: number;
  showIndicator?: boolean;
  style?: any;
}

export function NetworkStatusIcon({ size = 20, showIndicator = true, style }: NetworkStatusIconProps) {
  const [isConnected, setIsConnected] = React.useState(true);
  const [isBackendReachable, setIsBackendReachable] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(true);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const glowAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Initial check
    checkStatus();

    // Check every 10 seconds for better responsiveness
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      const status = await checkNetworkStatus(true);
      setIsConnected(status.isConnected);
      setIsBackendReachable(status.isBackendReachable);
      setIsChecking(false);

      // Smooth scale animation on status change
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error: any) {
      if (error?.name !== 'AbortError' && error?.message && !error.message.includes('Aborted')) {
      }
      setIsConnected(false);
      setIsBackendReachable(false);
      setIsChecking(false);
    }
  };

  React.useEffect(() => {
    if (!isConnected && showIndicator) {
      // Pulse animation when disconnected
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Glow effect for disconnected state
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0);
    }
  }, [isConnected, showIndicator]);

  // Determine icon and color based on status - Premium cyan theme with enhanced visibility
  let iconName: string = 'wifi-outline';
  let iconColor: string = 'rgba(255, 255, 255, 0.6)'; // Brighter white - no connection
  let glowColor: string = 'rgba(255, 255, 255, 0.2)'; // White glow

  if (isConnected && isBackendReachable) {
    iconName = 'wifi';
    iconColor = '#ffffff'; // Bright white - all good, maximum visibility
    glowColor = 'rgba(255, 255, 255, 0.4)'; // Bright white glow
  } else if (isConnected && !isBackendReachable) {
    iconName = 'wifi-outline';
    iconColor = 'rgba(255, 255, 255, 0.85)'; // Very bright white - internet but no backend
    glowColor = 'rgba(255, 255, 255, 0.3)'; // White glow
  }

  if (isChecking) {
    return (
      <View style={[styles.container, style]}>
        <Animated.View style={{ opacity: pulseAnim }}>
          <Ionicons name="wifi-outline" size={size} color="#ffffff" />
        </Animated.View>
      </View>
    );
  }
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.iconWrapper,
          {
            transform: [{ scale: scaleAnim }],
            opacity: pulseAnim,
          }
        ]}
      >
        {/* Glow effect */}
        {!isConnected && (
          <Animated.View
            style={[
              styles.glow,
              {
                backgroundColor: glowColor,
                opacity: glowOpacity,
                width: size + 12,
                height: size + 12,
                borderRadius: (size + 12) / 2,
              }
            ]}
          />
        )}

        {/* Main icon */}
        <Ionicons
          name={iconName as any}
          size={size}
          color={iconColor}
          style={styles.icon}
        />

        {/* Status indicator dot */}
        {showIndicator && (
          <View
            style={[
              styles.indicator,
              {
                backgroundColor: iconColor,
                width: size * 0.35,
                height: size * 0.35,
                borderRadius: (size * 0.35) / 2,
                borderWidth: size * 0.08,
              }
            ]}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    alignSelf: 'center',
  },
  icon: {
    zIndex: 1,
  },
  indicator: {
    position: 'absolute',
    top: -1,
    right: -1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
});

