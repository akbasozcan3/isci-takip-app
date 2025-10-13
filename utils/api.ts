import Constants from 'expo-constants';

export function getApiBase(): string {
  const envBase = process.env.EXPO_PUBLIC_API_BASE;
  if (envBase && /^https?:\/\//i.test(envBase)) return envBase.replace(/\/$/, '');

  const extra = (Constants?.expoConfig as any)?.extra || {};
  const extraBase = extra.apiBase as string | undefined;
  if (extraBase && /^https?:\/\//i.test(extraBase)) {
    return extraBase.replace(/\/$/, '');
  }

  // Default: Render domain
  return 'https://isci-takip-paneli.onrender.com';
}


