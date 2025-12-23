import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/auth';
import { getApiBase } from '../utils/api';

const API_BASE = getApiBase();

interface ProfileContextType {
    avatarUrl: string | null;
    userName: string | null;
    userEmail: string | null;
    setAvatarUrl: (url: string | null) => void;
    updateAvatarUrl: (url: string) => Promise<void>;
    loadAvatar: () => Promise<void>;
    deleteAvatar: () => Promise<{ success: boolean; error?: string }>;
    uploading: boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const updateAvatarUrl = useCallback(async (url: string) => {
        try {
            // Update state immediately for instant UI feedback
            const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
            setAvatarUrl(fullUrl);

            // Save to SecureStore
            await SecureStore.setItemAsync('avatarUrl', fullUrl);

            console.log('[ProfileContext] Avatar updated:', fullUrl);
        } catch (error) {
            console.error('[ProfileContext] Failed to update avatar:', error);
        }
    }, []);

    const loadAvatar = useCallback(async () => {
        try {
            // Try to load from backend first
            const response = await authFetch('/users/me');
            if (response.ok) {
                const data = await response.json();
                const userData = data.user || data.data?.user;
                if (userData?.avatar) {
                    const fullAvatarUrl = `${API_BASE}${userData.avatar}`;
                    setAvatarUrl(fullAvatarUrl);
                    await SecureStore.setItemAsync('avatarUrl', fullAvatarUrl);
                }
                // Also load userName
                if (userData?.displayName || userData?.name) {
                    const name = userData.displayName || userData.name;
                    setUserName(name);
                    await SecureStore.setItemAsync('displayName', name);
                }
                return;
            }
        } catch (error) {
            console.log('[ProfileContext] Failed to load avatar from backend:', error);
        }

        // Fallback to SecureStore
        try {
            const saved = await SecureStore.getItemAsync('avatarUrl');
            if (saved) setAvatarUrl(saved);

            const savedName = await SecureStore.getItemAsync('displayName');
            if (savedName) setUserName(savedName);
        } catch (error) {
            console.log('[ProfileContext] Failed to load avatar from SecureStore:', error);
        }
    }, []);

    const deleteAvatar = useCallback(async () => {
        setUploading(true);
        try {
            const response = await authFetch('/users/me/avatar', {
                method: 'DELETE',
            });

            if (response.ok) {
                setAvatarUrl(null);
                await SecureStore.deleteItemAsync('avatarUrl');
                return { success: true };
            } else {
                const errorData = await response.json().catch(() => ({}));
                return {
                    success: false,
                    error: errorData.message || 'Profil fotoğrafı silinemedi'
                };
            }
        } catch (error) {
            console.error('[ProfileContext] Delete avatar error:', error);
            return {
                success: false,
                error: 'Profil fotoğrafı silinirken hata oluştu'
            };
        } finally {
            setUploading(false);
        }
    }, []);

    // Load avatar on mount
    useEffect(() => {
        loadAvatar();
    }, [loadAvatar]);

    return (
        <ProfileContext.Provider
            value={{
                avatarUrl,
                userName,
                userEmail,
                setAvatarUrl,
                updateAvatarUrl,
                loadAvatar,
                deleteAvatar,
                uploading
            }}
        >
            {children}
        </ProfileContext.Provider>
    );
}

export function useProfile() {
    const context = useContext(ProfileContext);
    if (!context) {
        // Return default values instead of throwing - ProfileProvider might not be mounted yet
        console.warn('[useProfile] ProfileProvider not available, returning defaults');
        return {
            avatarUrl: null,
            userName: null,
            userEmail: null,
            setAvatarUrl: () => { },
            updateAvatarUrl: async () => { },
            loadAvatar: async () => { },
            deleteAvatar: async () => ({ success: false, error: 'ProfileProvider not available' }),
            uploading: false
        };
    }
    return context;
}
