import { Platform } from 'react-native';

/**
 * API base resolver.
 * Gives priority to Expo env vars, then `app.json` extras, finally local defaults.
 * Works both on emulator and physical devices without code changes.
 */
let resolvedBase: string | null = null;

// Lazy require to avoid breaking web builds that tree shake different modules
let Constants: any;
try {
  Constants = require('expo-constants').default;
} catch {
  Constants = null;
}

function pickFromConstants(): string | undefined {
  const extra = Constants?.expoConfig?.extra || Constants?.manifest?.extra || {};
  if (Platform.OS === 'android') {
    return extra.apiBaseDev || extra.apiBase;
  }
  if (Platform.OS === 'ios') {
    return extra.apiBaseIOS || extra.apiBase;
  }
  return extra.apiBaseWeb || extra.apiBase;
}

function resolveBaseUrl(): string {
  if (resolvedBase) {
    console.log('[API] Using cached api base:', resolvedBase);
    return resolvedBase;
  }

  // 1) Expo public env vars (works with EAS + .env)
  const envBase =
    typeof process !== 'undefined'
      ? process.env?.EXPO_PUBLIC_API_BASE_URL || process.env?.EXPO_PUBLIC_API_URL
      : undefined;
  if (envBase?.trim()) {
    resolvedBase = envBase.trim().replace(/\/+$/, '');
    console.log('[API] ✅ Using EXPO_PUBLIC api base:', resolvedBase);
    return resolvedBase;
  }

  // 2) app.json -> extra section
  const extraBase = pickFromConstants();
  if (extraBase && extraBase.trim()) {
    resolvedBase = extraBase.trim().replace(/\/+$/, '');
    console.log('[API] ✅ Using app.json extra api base:', resolvedBase, 'Platform:', Platform.OS);
    return resolvedBase;
  }

  // 3) Local fallback (emulator vs iOS/web)
  if (Platform.OS === 'android') {
    resolvedBase = 'http://10.0.2.2:4000';
    console.log('[API] ⚠️  Falling back to Android emulator default:', resolvedBase);
  } else if (Platform.OS === 'ios') {
    resolvedBase = 'http://localhost:4000';
    console.log('[API] ⚠️  Falling back to iOS simulator default:', resolvedBase);
  } else {
    resolvedBase = 'http://127.0.0.1:4000';
    console.log('[API] ⚠️  Falling back to web default:', resolvedBase);
  }
  return resolvedBase;
}

export function getApiBase(): string {
  return resolveBaseUrl();
}

// Base URL for PHP API (legacy removed intentionally)

