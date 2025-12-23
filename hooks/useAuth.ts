/**
 * useAuth Hook
 * Manages authentication, logout, and session handling
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { authFetch, clearToken } from '../utils/auth';
import { handleApiError } from '../utils/appErrorHandler';

export interface UseAuthReturn {
    loggingOut: boolean;
    logout: () => Promise<void>;
    changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
    deleteAccount: () => Promise<{ success: boolean; error?: string }>;
}

export const useAuth = (
    onSuccess?: (message: string) => void,
    onError?: (message: string) => void
): UseAuthReturn => {
    const router = useRouter();
    const [loggingOut, setLoggingOut] = useState(false);

    const logout = useCallback(async () => {
        setLoggingOut(true);
        try {
            console.log('[useAuth] Starting logout process...');

            // 1. Check if Google user and revoke session
            try {
                const { isGoogleUser, revokeGoogleSession } = await import('../utils/googleAuth');
                const isGoogle = await isGoogleUser();

                if (isGoogle) {
                    console.log('[useAuth] Google user detected, revoking session...');
                    await revokeGoogleSession();
                }
            } catch (googleError) {
                console.warn('[useAuth] Google session revoke failed (non-critical):', googleError);
            }

            // 2. Backend logout request
            try {
                await authFetch('/auth/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                console.log('[useAuth] Backend logout successful');
            } catch (backendError) {
                console.warn('[useAuth] Backend logout failed (non-critical):', backendError);
            }

            // 3. OneSignal cleanup
            try {
                const { removeOneSignalExternalUserId } = await import('../utils/onesignal');
                const { markUserInactive } = await import('../utils/onesignalSegments');
                removeOneSignalExternalUserId();
                markUserInactive();
                console.log('[useAuth] OneSignal cleanup successful');
            } catch (onesignalError) {
                console.warn('[useAuth] OneSignal cleanup failed (non-critical):', onesignalError);
            }

            // 4. Clear all local storage
            await clearToken?.();
            await SecureStore.deleteItemAsync('workerId');
            await SecureStore.deleteItemAsync('displayName');
            await SecureStore.deleteItemAsync('userEmail');
            await SecureStore.deleteItemAsync('activeGroupId');
            await SecureStore.deleteItemAsync('loginMethod');
            await SecureStore.deleteItemAsync('googleIdToken');
            await SecureStore.deleteItemAsync('googleAccessToken');
            await SecureStore.deleteItemAsync('avatarUrl');

            console.log('[useAuth] Local storage cleared');

            onSuccess?.('Çıkış yapıldı');

            // 5. Navigate to login
            setTimeout(() => {
                router.replace('/auth/login');
            }, 500);
        } catch (error) {
            console.error('[useAuth] Logout error:', error);
            onError?.('Çıkış yapılamadı. Lütfen tekrar deneyin.');
        } finally {
            setLoggingOut(false);
        }
    }, [router, onSuccess, onError]);

    const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
        try {
            const result = await handleApiError(
                () => authFetch('/users/me', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentPassword, newPassword })
                }),
                'useAuth.changePassword'
            );

            if (result.success) {
                onSuccess?.('Şifreniz başarıyla değiştirildi');
                return { success: true };
            } else {
                onError?.(result.error);
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('[useAuth] Change password error:', error);
            onError?.('Şifre değiştirilemedi');
            return { success: false, error: 'Şifre değiştirilemedi' };
        }
    }, [onSuccess, onError]);

    const deleteAccount = useCallback(async () => {
        try {
            // Check if Google user
            const { isGoogleUser } = await import('../utils/googleAuth');
            const isGoogle = await isGoogleUser();

            const endpoint = isGoogle ? '/auth/account/delete-google' : '/auth/account/delete-verify';

            const result = await handleApiError(
                () => authFetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }),
                'useAuth.deleteAccount'
            );

            if (result.success) {
                // Revoke Google session if applicable
                if (isGoogle) {
                    try {
                        const { revokeGoogleSession } = await import('../utils/googleAuth');
                        await revokeGoogleSession();
                    } catch (googleError) {
                        console.warn('[useAuth] Google session revoke failed:', googleError);
                    }
                }

                // Clear all local data
                await clearToken?.();
                await SecureStore.deleteItemAsync('workerId');
                await SecureStore.deleteItemAsync('displayName');
                await SecureStore.deleteItemAsync('userEmail');
                await SecureStore.deleteItemAsync('activeGroupId');
                await SecureStore.deleteItemAsync('loginMethod');
                await SecureStore.deleteItemAsync('googleIdToken');
                await SecureStore.deleteItemAsync('googleAccessToken');
                await SecureStore.deleteItemAsync('avatarUrl');

                try {
                    const keys = await AsyncStorage.getAllKeys();
                    if (keys.length) await AsyncStorage.multiRemove(keys);
                } catch (e) {
                    console.warn('AsyncStorage clear failed', e);
                }

                DeviceEventEmitter.emit('clearRecentActivities');
                DeviceEventEmitter.emit('app:dataCleared');

                onSuccess?.('Hesabınız başarıyla silindi');

                setTimeout(() => {
                    router.replace('/auth/login');
                }, 1500);

                return { success: true };
            } else {
                onError?.(result.error);
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('[useAuth] Delete account error:', error);
            onError?.('Hesap silinemedi');
            return { success: false, error: 'Hesap silinemedi' };
        }
    }, [router, onSuccess, onError]);

    return {
        loggingOut,
        logout,
        changePassword,
        deleteAccount
    };
};
