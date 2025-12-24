// Shared State Management Hooks
// Cross-screen synchronization using AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';

// Storage keys
export const STORAGE_KEYS = {
    SELECTED_GROUP: 'selectedGroup',
    WORKER_ID: 'workerId',
    DISPLAY_NAME: 'displayName',
    LAST_SYNC: 'lastSync',
    USER_PROFILE: 'userProfile',
};

// Group type
export interface Group {
    id: string;
    name: string;
    code: string;
    memberCount: number;
    onlineCount?: number;
    createdAt?: string;
}

// User profile type
export interface UserProfile {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
}

// Hook for selected group
export function useSelectedGroup() {
    const [selectedGroup, setSelectedGroupState] = useState<Group | null>(null);
    const [loading, setLoading] = useState(true);

    // Load from storage
    useEffect(() => {
        loadSelectedGroup();
    }, []);

    const loadSelectedGroup = async () => {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_GROUP);
            if (stored) {
                setSelectedGroupState(JSON.parse(stored));
            }
        } catch (error) {
            console.error('[SharedState] Load selected group error:', error);
        } finally {
            setLoading(false);
        }
    };

    const setSelectedGroup = useCallback(async (group: Group | null) => {
        try {
            if (group) {
                await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_GROUP, JSON.stringify(group));
            } else {
                await AsyncStorage.removeItem(STORAGE_KEYS.SELECTED_GROUP);
            }
            setSelectedGroupState(group);
        } catch (error) {
            console.error('[SharedState] Save selected group error:', error);
        }
    }, []);

    const clearSelectedGroup = useCallback(async () => {
        await setSelectedGroup(null);
    }, [setSelectedGroup]);

    return {
        selectedGroup,
        setSelectedGroup,
        clearSelectedGroup,
        loading,
        refresh: loadSelectedGroup,
    };
}

// Hook for user profile
export function useUserProfile() {
    const [profile, setProfileState] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
            if (stored) {
                setProfileState(JSON.parse(stored));
            }
        } catch (error) {
            console.error('[SharedState] Load profile error:', error);
        } finally {
            setLoading(false);
        }
    };

    const setProfile = useCallback(async (profile: UserProfile | null) => {
        try {
            if (profile) {
                await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
            } else {
                await AsyncStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
            }
            setProfileState(profile);
        } catch (error) {
            console.error('[SharedState] Save profile error:', error);
        }
    }, []);

    return {
        profile,
        setProfile,
        loading,
        refresh: loadProfile,
    };
}

// Hook for syncing data across screens
export function useCrossScreenSync(key: string, defaultValue: any = null) {
    const [value, setValueState] = useState(defaultValue);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadValue();
    }, [key]);

    const loadValue = async () => {
        try {
            const stored = await AsyncStorage.getItem(key);
            if (stored) {
                setValueState(JSON.parse(stored));
            }
        } catch (error) {
            console.error(`[SharedState] Load ${key} error:`, error);
        } finally {
            setLoading(false);
        }
    };

    const setValue = useCallback(async (newValue: any) => {
        try {
            if (newValue !== null && newValue !== undefined) {
                await AsyncStorage.setItem(key, JSON.stringify(newValue));
            } else {
                await AsyncStorage.removeItem(key);
            }
            setValueState(newValue);
        } catch (error) {
            console.error(`[SharedState] Save ${key} error:`, error);
        }
    }, [key]);

    return {
        value,
        setValue,
        loading,
        refresh: loadValue,
    };
}

// Utility to sync last update time
export async function updateLastSync() {
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    } catch (error) {
        console.error('[SharedState] Update last sync error:', error);
    }
}

// Utility to get last sync time
export async function getLastSync(): Promise<Date | null> {
    try {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
        return stored ? new Date(stored) : null;
    } catch (error) {
        console.error('[SharedState] Get last sync error:', error);
        return null;
    }
}
