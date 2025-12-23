/**
 * useProfile Hook
 * Manages profile data, avatar upload, and profile updates
 */

import { useState, useCallback, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authFetch } from '../utils/auth';
import { handleApiError } from '../utils/appErrorHandler';

export interface ProfileData {
    id: string;
    displayName: string;
    email: string;
    phone: string;
    createdAt: string;
    avatarUrl?: string | null;
    subscription?: {
        planId: string;
        planName: string;
        renewsAt?: string | null;
    };
    stats?: {
        totalLocations: number;
        totalSteps: number;
        activeDays: number;
        lastActive: string | null;
    };
}

export interface UseProfileReturn {
    profile: ProfileData | null;
    loading: boolean;
    error: string | null;
    refreshing: boolean;
    loadProfile: () => Promise<void>;
    updateProfile: (updates: Partial<ProfileData>) => Promise<{ success: boolean; error?: string }>;
    refresh: () => Promise<void>;
}

export const useProfile = (): UseProfileReturn => {
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const loadProfile = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Load from SecureStore first for immediate display
            const [storedId, storedName, storedEmail] = await Promise.all([
                SecureStore.getItemAsync('workerId'),
                SecureStore.getItemAsync('displayName'),
                SecureStore.getItemAsync('userEmail')
            ]);

            if (storedId && storedName && storedEmail) {
                setProfile({
                    id: storedId,
                    displayName: storedName,
                    email: storedEmail,
                    phone: '',
                    createdAt: ''
                });
            }

            // Then fetch from API for complete data
            const result = await handleApiError(
                () => authFetch('/users/me'),
                'useProfile.loadProfile'
            );

            if (result.success) {
                const data = await result.data.json();
                const userData = data.user || data;

                const profileData: ProfileData = {
                    id: userData.id || storedId || '',
                    displayName: userData.displayName || userData.name || storedName || '',
                    email: userData.email || storedEmail || '',
                    phone: userData.phone || '',
                    createdAt: userData.createdAt || '',
                    avatarUrl: userData.avatarUrl || null
                };

                setProfile(profileData);

                // Update SecureStore
                if (profileData.displayName) {
                    await SecureStore.setItemAsync('displayName', profileData.displayName);
                }
                if (profileData.email) {
                    await SecureStore.setItemAsync('userEmail', profileData.email);
                }
            } else {
                setError(result.error);
            }

            // Load stats
            const statsResult = await handleApiError(
                () => authFetch('/api/profile/stats'),
                'useProfile.loadStats'
            );

            if (statsResult.success) {
                const statsData = await statsResult.data.json();
                if (statsData.success && statsData.data) {
                    setProfile(prev => prev ? {
                        ...prev,
                        stats: {
                            totalLocations: statsData.data.totalLocations || 0,
                            totalSteps: statsData.data.totalSteps || 0,
                            activeDays: statsData.data.activeDays || 0,
                            lastActive: statsData.data.lastActive || null
                        }
                    } : null);
                }
            }

            // Load subscription
            const subResult = await handleApiError(
                () => authFetch('/me/subscription'),
                'useProfile.loadSubscription'
            );

            if (subResult.success) {
                const subData = await subResult.data.json();
                if (subData?.subscription) {
                    setProfile(prev => prev ? {
                        ...prev,
                        subscription: {
                            planId: subData.subscription.planId || 'free',
                            planName: subData.subscription.planName || 'Free',
                            renewsAt: subData.subscription.renewsAt || null
                        }
                    } : null);
                }
            }
        } catch (err) {
            console.error('[useProfile] Load error:', err);
            setError('Profil yüklenemedi');
        } finally {
            setLoading(false);
        }
    }, []);

    const updateProfile = useCallback(async (updates: Partial<ProfileData>) => {
        try {
            const result = await handleApiError(
                () => authFetch('/auth/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updates)
                }),
                'useProfile.updateProfile'
            );

            if (result.success) {
                const data = await result.data.json();
                if (data.user) {
                    setProfile(prev => prev ? { ...prev, ...data.user } : null);

                    // Update SecureStore
                    if (data.user.displayName) {
                        await SecureStore.setItemAsync('displayName', data.user.displayName);
                    }
                }
                return { success: true };
            } else {
                return { success: false, error: result.error };
            }
        } catch (err) {
            console.error('[useProfile] Update error:', err);
            return { success: false, error: 'Profil güncellenemedi' };
        }
    }, []);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await loadProfile();
        setRefreshing(false);
    }, [loadProfile]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    return {
        profile,
        loading,
        error,
        refreshing,
        loadProfile,
        updateProfile,
        refresh
    };
};
