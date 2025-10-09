import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function getApiBase(): string {
  // Order of precedence:
  // 1) EXPO_PUBLIC_API_BASE env
  // 2) app.json -> expo.extra.apiBase
  // 3) Platform heuristics (web host, localhost, Android emulator 10.0.2.2)
  const envBase = process.env.EXPO_PUBLIC_API_BASE;
  if (envBase && /^https?:\/\//i.test(envBase)) return envBase.replace(/\/$/, '');

  const extra = (Constants?.expoConfig as any)?.extra || {};
  const extraBase = extra.apiBase as string | undefined;
  if (extraBase && /^https?:\/\//i.test(extraBase)) {
    // If extraBase is Android emulator host but we are on iOS, ignore it
    if (extraBase.includes('10.0.2.2') && Platform.OS === 'ios') {
      // fall through to platform heuristics
    } else {
      return extraBase.replace(/\/$/, '');
    }
  }

  // Native (no window): default to localhost (iOS sim) and emulator host (Android)
  if (typeof window === 'undefined') {
    // Native: Prefer Expo dev server host (works on gerçek cihaz ve emülatör)
    const hostUri: string | undefined = (Constants as any)?.expoConfig?.hostUri
      || (Constants as any)?.manifest2?.extra?.expoClient?.hostUri
      || (Constants as any)?.manifest?.hostUri;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      if (host && /^[0-9a-zA-Z\.-]+$/.test(host)) {
        return `http://${host}:4000`;
      }
    }
    // Fallbacks
    if (Platform.OS === 'android') return 'http://10.0.2.2:4000';
    return 'http://localhost:4000';
  }
  try {
    const { protocol, hostname } = window.location as any;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return `${protocol}//${hostname}:4000`;
    return `${protocol}//${hostname}:4000`;
  } catch {
    return 'http://10.0.2.2:4000';
  }
}


