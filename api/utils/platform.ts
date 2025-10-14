import { Dimensions, Platform } from 'react-native';

/**
 * Platform-specific utilities for Android and iOS optimization
 */

export const isAndroid = Platform.OS === 'android';
export const isIOS = Platform.OS === 'ios';
export const isWeb = Platform.OS === 'web';

const { width, height } = Dimensions.get('window');

export const deviceInfo = {
  width,
  height,
  isSmallDevice: width < 375,
  isMediumDevice: width >= 375 && width < 414,
  isLargeDevice: width >= 414,
  isTablet: width >= 768,
};

/**
 * Get platform-specific value
 * @example getPlatformValue({ android: 10, ios: 20, default: 15 })
 */
export function getPlatformValue<T>(values: {
  android?: T;
  ios?: T;
  web?: T;
  default: T;
}): T {
  if (isAndroid && values.android !== undefined) return values.android;
  if (isIOS && values.ios !== undefined) return values.ios;
  if (isWeb && values.web !== undefined) return values.web;
  return values.default;
}

/**
 * Get elevation/shadow style based on platform
 */
export function getElevation(level: number = 4) {
  if (isAndroid) {
    return { elevation: level };
  }
  // iOS shadow
  const shadowOpacity = Math.min(level / 24, 0.3);
  const shadowRadius = level * 2;
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: level / 2 },
    shadowOpacity,
    shadowRadius,
  };
}
/**
 * Get status bar height based on platform
 */
export function getStatusBarHeight(): number {
  if (isAndroid) {
    const version = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
    return version >= 21 ? 24 : 20;
  }
  // iOS
  if (height >= 812) return 44; // iPhone X and newer
  return 20; // Older iPhones
}
/**
 * Check if device has notch (iPhone X and newer)
 */
export function hasNotch(): boolean {
  return isIOS && height >= 812;
}

/**
 * Get safe bottom padding for devices with home indicator
 */
export function getBottomSafeArea(): number {
  if (hasNotch()) return 34;
  return 0;
}

/**
 * Haptic feedback wrapper (iOS only has strong feedback)
 */
export function getHapticStyle(): 'light' | 'medium' | 'heavy' {
  return isIOS ? 'medium' : 'light';
}

/**
 * Animation duration based on platform
 */
export const animationDuration = {
  fast: getPlatformValue({ android: 200, ios: 250, default: 200 }),
  normal: getPlatformValue({ android: 300, ios: 350, default: 300 }),
  slow: getPlatformValue({ android: 400, ios: 450, default: 400 }),
};

/**
 * Font scaling based on platform
 */
export function scaleFontSize(size: number): number {
  const scale = width / 375; // Base width: iPhone 11 Pro
  const newSize = size * scale;
  
  if (isAndroid) {
    return Math.round(newSize);
  }
  return Math.round(newSize * 0.95); // iOS fonts are slightly larger
}

/**
 * Check if running on physical device
 */
export function isPhysicalDevice(): boolean {
  return Platform.OS !== 'web' && !__DEV__;
}

/**
 * Get optimal map provider based on platform
 */
export function getMapProvider(): 'google' | 'apple' {
  return isIOS ? 'apple' : 'google';
}

/**
 * Platform-specific keyboard behavior
 */
export const keyboardBehavior = getPlatformValue({
  ios: 'padding' as const,
  android: 'height' as const,
  default: 'padding' as const,
});

/**
 * Get optimal image quality based on device
 */
export function getImageQuality(): number {
  if (deviceInfo.isSmallDevice) return 0.7;
  if (deviceInfo.isMediumDevice) return 0.8;
  return 0.9;
}
