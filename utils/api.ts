import { Platform } from 'react-native';

/**
 * API base resolver.
 * Gives priority to Expo env vars, then `app.json` extras, finally local defaults.
 * Works both on emulator and physical devices without code changes.
 */
let resolvedBase: string | null = null;

// Lazy require to avoid breaking web builds that tree shake different modules
let Constants: { expoConfig?: { extra?: Record<string, unknown> }; manifest?: { extra?: Record<string, unknown> } } | null;
try {
  Constants = require('expo-constants').default;
} catch {
  Constants = null;
}

function pickFromConstants(): string | undefined {
  const extra = Constants?.expoConfig?.extra || Constants?.manifest?.extra || {};
  if (Platform.OS === 'android') {
    return (extra.apiBaseDev as string) || (extra.apiBase as string);
  }
  if (Platform.OS === 'ios') {
    return (extra.apiBaseIOS as string) || (extra.apiBase as string);
  }
  return (extra.apiBaseWeb as string) || (extra.apiBase as string);
}

function resolveBaseUrl(): string {
  if (resolvedBase) {
    return resolvedBase;
  }

  // 1) Expo public env vars (works with EAS + .env)
  const envBase =
    typeof process !== 'undefined'
      ? process.env?.EXPO_PUBLIC_API_BASE_URL || process.env?.EXPO_PUBLIC_API_URL
      : undefined;
  if (envBase?.trim()) {
    resolvedBase = envBase.trim().replace(/\/+$/, '');
    return resolvedBase;
  }

  const extraBase = pickFromConstants();
  if (extraBase && extraBase.trim()) {
    resolvedBase = extraBase.trim().replace(/\/+$/, '');
    return resolvedBase;
  }

  if (__DEV__) {
    // Android emulator uses 10.0.2.2 to access host machine
    // Physical devices need the actual local network IP
    if (Platform.OS === 'android') {
      // Try to detect if running on emulator or physical device
      // For physical devices, use local network IP (update this with your actual IP)
      // You can find your IP with: ipconfig (Windows) or ifconfig (Mac/Linux)
      // Common local IPs: 192.168.1.x, 192.168.0.x, 10.0.0.x
      const physicalDeviceIP = process.env.EXPO_PUBLIC_DEVICE_IP || '192.168.1.102';
      resolvedBase = `http://${physicalDeviceIP}:4000`;
    } else {
      // iOS simulator uses localhost
      // iOS physical device needs local network IP
      const physicalDeviceIP = process.env.EXPO_PUBLIC_DEVICE_IP || '192.168.1.102';
      resolvedBase = `http://${physicalDeviceIP}:4000`;
    }
  } else {
    resolvedBase = 'https://isci-takip-app-production-0f9e.up.railway.app';
  }
  return resolvedBase;
}

export function getApiBase(): string {
  return resolveBaseUrl();
}

// Base URL for PHP API (legacy removed intentionally)

