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
      // Check if running on emulator (Android emulator always uses 10.0.2.2)
      // For emulator: use 10.0.2.2 (special IP that maps to host's localhost)
      // For physical device: use local network IP
      const isEmulator = process.env.EXPO_PUBLIC_IS_EMULATOR === 'true' ||
        !process.env.EXPO_PUBLIC_DEVICE_IP; // Default to emulator if IP not set

      if (isEmulator) {
        // Android Emulator: 10.0.2.2 maps to host machine's localhost
        resolvedBase = 'http://10.0.2.2:4000';
      } else {
        // Physical Android device: use local network IP
        const physicalDeviceIP = process.env.EXPO_PUBLIC_DEVICE_IP || '192.168.1.95';
        resolvedBase = `http://${physicalDeviceIP}:4000`;
      }
    } else if (Platform.OS === 'ios') {
      // iOS simulator uses localhost (works directly)
      // iOS physical device needs local network IP
      const isSimulator = process.env.EXPO_PUBLIC_IS_SIMULATOR === 'true' ||
        !process.env.EXPO_PUBLIC_DEVICE_IP;

      if (isSimulator) {
        // iOS Simulator: localhost works
        resolvedBase = 'http://localhost:4000';
      } else {
        // Physical iOS device: use local network IP
        const physicalDeviceIP = process.env.EXPO_PUBLIC_DEVICE_IP || '192.168.1.95';
        resolvedBase = `http://${physicalDeviceIP}:4000`;
      }
    } else {
      // Web or other platforms
      resolvedBase = 'http://localhost:4000';
    }
  } else {
    // Production: Use Render.com backend
    resolvedBase = 'https://isci-takip-app.onrender.com';
  }
  return resolvedBase;
}

// Helper to verify connectivity
export async function checkApiConnection(): Promise<string> {
  const current = resolveBaseUrl();
  const PROD_URL = 'https://isci-takip-app.onrender.com';

  // If already prod, no need to check
  if (current === PROD_URL) return current;

  try {
    // Try to reach the backend with a longer timeout for reliability
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000); // 5s timeout (increased from 2s)
    const res = await fetch(`${current}/api/health`, { method: 'HEAD', signal: controller.signal });
    clearTimeout(id);

    if (res.ok || res.status === 404) { // 404 means server is up but route missing, which is fine for connectivity check
      console.log('[API] ✅ Local backend is reachable:', current);
      return current;
    }
  } catch (e) {
    console.warn(`[API] ⚠️ Local backend (${current}) unreachable, switching to Production fallback.`);
    console.warn('[API] Error:', e instanceof Error ? e.message : 'Unknown error');
  }

  // Fallback to prod
  console.log('[API] 🌐 Using production backend:', PROD_URL);
  resolvedBase = PROD_URL;
  return PROD_URL;
}

export function getApiBase(): string {
  return resolveBaseUrl();
}


