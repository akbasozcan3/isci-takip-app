import * as SecureStore from 'expo-secure-store';
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

export async function authFetch(path: string, init: RequestInit = {}) {
  const token = await getToken();
  const headers = Object.assign({}, init.headers || {}, token ? { Authorization: `Bearer ${token}` } : {});
  const res = await fetch(`${getApiBase()}${path}`, { ...init, headers });
  return res;
}


