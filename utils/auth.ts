import * as SecureStore from 'expo-secure-store';
import { DeviceEventEmitter } from 'react-native';
import { getApiBase } from './api';

const TOKEN_KEY = 'auth_token';

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function buildApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  // Ensure path starts with a single leading slash
  let normalized = path.startsWith('/') ? path : `/${path}`;

  // Automatically prefix missing /api segment for convenience
  if (!normalized.startsWith('/api')) {
    normalized = `/api${normalized}`;
  }

  return `${getApiBase()}${normalized}`;
}

export async function authFetch(path: string, init: RequestInit = {}) {
  const token = await getToken();
  const headers = Object.assign({}, init.headers || {}, token ? { Authorization: `Bearer ${token}` } : {});
  const res = await fetch(buildApiUrl(path), { ...init, headers });
  // Auto-logout on invalid/expired token
  try {
    if (res.status === 401 || res.status === 403) {
      await clearToken();
      DeviceEventEmitter.emit('app:dataCleared');
    }
  } catch {}
  return res;
}


