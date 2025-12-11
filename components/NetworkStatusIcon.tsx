/**
 * Network Status Icon Component
 * Shows Wi-Fi icon with connection status (green = connected, red = disconnected)
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { checkNetworkStatus } from '../utils/network';

interface NetworkStatusIconProps {
  size?: number;
  showIndicator?: boolean;
}

export function NetworkStatusIcon({ size = 20, showIndicator = true }: NetworkStatusIconProps) {
  const [isConnected, setIsConnected] = React.useState(true);
  const [isBackendReachable, setIsBackendReachable] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(true);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    // Initial check
    checkStatus();

    // Check every 15 seconds (reduced frequency to prevent spam)
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      const status = await checkNetworkStatus(true);
      setIsConnected(status.isConnected);
      setIsBackendReachable(status.isBackendReachable);
      setIsChecking(false);
    } catch (error: any) {
      // Silently handle network errors - don't spam console
      if (error?.name !== 'AbortError' && error?.message && !error.message.includes('Aborted')) {
        console.warn('[NetworkStatusIcon] Status check error:', error);
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
            toValue: 0.5,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isConnected, showIndicator]);

  if (isChecking) {
    return (
      <View style={styles.container}>
        <Ionicons name="wifi-outline" size={size} color="#94a3b8" />
      </View>
    );
  }

  // Professional network status display
  // Green: Internet + Backend connected
  // Yellow: Internet connected but backend unreachable
  // Red: No internet
  let iconName = 'wifi-outline';
  let iconColor = '#ef4444'; // Red - no connection
  
  if (isConnected && isBackendReachable) {
    iconName = 'wifi';
    iconColor = '#10b981'; // Green - all good
  } else if (isConnected && !isBackendReachable) {
    iconName = 'wifi-outline';
    iconColor = '#f59e0b'; // Yellow/Amber - internet but no backend
  }

  return (
    <Animated.View style={[styles.container, { opacity: pulseAnim }]}>
      <Ionicons name={iconName as any} size={size} color={iconColor} />
      {!isConnected && showIndicator && (
        <View style={[styles.indicator, { backgroundColor: '#ef4444' }]} />
      )}
      {isConnected && !isBackendReachable && showIndicator && (
        <View style={[styles.indicator, { backgroundColor: '#f59e0b' }]} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});

