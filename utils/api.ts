import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function getApiBase(): string {
  const envBase = process.env.EXPO_PUBLIC_API_BASE;
  if (envBase && /^https?:\/\//i.test(envBase)) return envBase.replace(/\/$/, '');

  const extra = (Constants?.expoConfig as any)?.extra || {};
  // Prefer explicit dev base when running in development
  if (__DEV__) {
    const devBase = extra.apiBaseDev as string | undefined;
    if (devBase && /^https?:\/\//i.test(devBase)) {
      return devBase.replace(/\/$/, '');
    }
  }
  const extraBase = extra.apiBase as string | undefined;
  if (extraBase && /^https?:\/\//i.test(extraBase)) {
    return extraBase.replace(/\/$/, '');
  }

  // Default: Local development
  if (__DEV__) {
    // Use Android emulator loopback if needed
    const host = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
    return host;
  }
  // Production: Render domain
  return 'https://isci-takip-app.onrender.com';
}

// Base URL for PHP API (PHPMailer service)
// Priority: EXPO_PUBLIC_PHP_API_BASE -> extra.phpApiBaseDev (dev) / extra.phpApiBase -> fallback to getApiBase()
export function getPhpApiBase(): string {
  const envBase = process.env.EXPO_PUBLIC_PHP_API_BASE;
  if (envBase && /^https?:\/\//i.test(envBase)) return envBase.replace(/\/$/, '');

  const extra = (Constants?.expoConfig as any)?.extra || {};
  if (__DEV__) {
    const devBase = extra.phpApiBaseDev as string | undefined;
    if (devBase && /^https?:\/\//i.test(devBase)) return devBase.replace(/\/$/, '');
  }
  const extraBase = extra.phpApiBase as string | undefined;
  if (extraBase && /^https?:\/\//i.test(extraBase)) return extraBase.replace(/\/$/, '');

  // Fallback to main API base if PHP base not provided
  return getApiBase();
}


