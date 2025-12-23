/**
 * Google Authentication Utilities
 * Handles Google Sign-In session management and cleanup
 */

import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

/**
 * Check if user logged in with Google
 */
export const isGoogleUser = async (): Promise<boolean> => {
    try {
        const loginMethod = await SecureStore.getItemAsync('loginMethod');
        return loginMethod === 'google';
    } catch (error) {
        console.error('[GoogleAuth] Error checking login method:', error);
        return false;
    }
};

/**
 * Revoke Google session and sign out
 * This ensures the user is fully logged out from Google
 */
export const revokeGoogleSession = async (): Promise<void> => {
    try {
        const isGoogle = await isGoogleUser();

        if (!isGoogle) {
            console.log('[GoogleAuth] Not a Google user, skipping Google session revoke');
            return;
        }

        console.log('[GoogleAuth] Revoking Google session...');

        // Get the Google ID token from secure storage
        const token = await SecureStore.getItemAsync('authToken');

        if (token) {
            try {
                // Revoke the token via Google's revoke endpoint
                const revokeUrl = `https://accounts.google.com/o/oauth2/revoke?token=${token}`;

                // Use WebBrowser to ensure proper cleanup
                await WebBrowser.openAuthSessionAsync(revokeUrl, 'bavaxe://');

                console.log('[GoogleAuth] Google session revoked successfully');
            } catch (revokeError) {
                console.warn('[GoogleAuth] Google token revoke failed (non-critical):', revokeError);
                // Non-critical error - continue with local cleanup
            }
        }

        // Clear Google-specific data
        await SecureStore.deleteItemAsync('loginMethod');
        await SecureStore.deleteItemAsync('googleIdToken');
        await SecureStore.deleteItemAsync('googleAccessToken');

        console.log('[GoogleAuth] Google session cleanup completed');
    } catch (error) {
        console.error('[GoogleAuth] Error during Google session revoke:', error);
        // Don't throw - we want logout to continue even if Google revoke fails
    }
};

/**
 * Save Google login method
 */
export const markAsGoogleUser = async (): Promise<void> => {
    try {
        await SecureStore.setItemAsync('loginMethod', 'google');
        console.log('[GoogleAuth] Marked as Google user');
    } catch (error) {
        console.error('[GoogleAuth] Error marking as Google user:', error);
    }
};

/**
 * Clear all Google authentication data
 */
export const clearGoogleAuthData = async (): Promise<void> => {
    try {
        await SecureStore.deleteItemAsync('loginMethod');
        await SecureStore.deleteItemAsync('googleIdToken');
        await SecureStore.deleteItemAsync('googleAccessToken');
        console.log('[GoogleAuth] Google auth data cleared');
    } catch (error) {
        console.error('[GoogleAuth] Error clearing Google auth data:', error);
    }
};
