import Constants from 'expo-constants';

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
    return 'http://localhost:4000';
  }
  // Production: Render domain
  return 'https://isci-takip-app.onrender.com';
}


