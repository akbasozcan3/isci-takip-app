/**
 * useAvatar Hook
 * Manages avatar upload, deletion, and loading
 */

import { useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useProfile } from '../contexts/ProfileContext';
import { userHelpers } from '../utils/helpers';

// Lazy load ImagePicker
let ImagePicker: any = null;
try {
    ImagePicker = require('expo-image-picker');
} catch (e) {
    console.warn('[useAvatar] ImagePicker not available');
}

export interface UseAvatarReturn {
    avatarUrl: string | null;
    uploading: boolean;
    pickFromGallery: () => Promise<void>;
    takePhoto: () => Promise<void>;
    deleteAvatar: () => Promise<{ success: boolean; error?: string }>;
    uploadAvatar: (uri: string) => Promise<{ success: boolean; error?: string }>;
}

export const useAvatar = (
    onSuccess?: (message: string) => void,
    onError?: (message: string) => void
): UseAvatarReturn => {
    const { avatarUrl, setAvatarUrl, loadAvatar } = useProfile();
    const [uploading, setUploading] = useState(false);

    const uploadAvatar = useCallback(async (uri: string) => {
        if (!uri) {
            return { success: false, error: 'Geçersiz fotoğraf' };
        }

        setUploading(true);
        try {
            const formData = new FormData();
            const filename = uri.split('/').pop();
            const match = /\.(\w+)$/.exec(filename || '');
            const type = match ? `image/${match[1]}` : 'image/jpeg';

            formData.append('avatar', {
                uri,
                name: filename || 'avatar.jpg',
                type
            } as any);

            const result = await handleApiError(
                () => authFetch('/users/me/avatar', {
                    method: 'POST',
                    body: formData,
                    headers: { 'Content-Type': 'multipart/form-data' }
                }),
                'useAvatar.uploadAvatar'
            );

            if (result.success) {
                const data = await result.data.json();
                const newAvatarUrl = data.avatarUrl || data.data?.avatarUrl;

                if (newAvatarUrl) {
                    setAvatarUrl(newAvatarUrl);
                    await SecureStore.setItemAsync('avatarUrl', newAvatarUrl);
                    onSuccess?.('Profil fotoğrafı başarıyla yüklendi!');
                    return { success: true };
                } else {
                    onError?.('Fotoğraf yüklenemedi');
                    return { success: false, error: 'Fotoğraf yüklenemedi' };
                }
            } else {
                onError?.(result.error);
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('[useAvatar] Upload error:', error);
            onError?.('Fotoğraf yüklenirken hata oluştu');
            return { success: false, error: 'Fotoğraf yüklenirken hata oluştu' };
        } finally {
            setUploading(false);
        }
    }, [setAvatarUrl, onSuccess, onError]);

    const pickFromGallery = useCallback(async () => {
        if (!ImagePicker) {
            onError?.('Galeri modülü eksik');
            return;
        }

        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                onError?.('Galeri izni gerekli');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8
            });

            if (!result.canceled && result.assets[0]) {
                await uploadAvatar(result.assets[0].uri);
            }
        } catch (error) {
            console.error('[useAvatar] Gallery error:', error);
            onError?.('Fotoğraf seçilemedi');
        }
    }, [uploadAvatar, onError]);

    const takePhoto = useCallback(async () => {
        if (!ImagePicker) {
            onError?.('Kamera modülü eksik');
            return;
        }

        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                onError?.('Kamera izni gerekli');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8
            });

            if (!result.canceled && result.assets[0]) {
                await uploadAvatar(result.assets[0].uri);
            }
        } catch (error) {
            console.error('[useAvatar] Camera error:', error);
            onError?.('Fotoğraf çekilemedi');
        }
    }, [uploadAvatar, onError]);

    const deleteAvatar = useCallback(async () => {
        try {
            const result = await handleApiError(
                () => authFetch('/users/me/avatar', {
                    method: 'DELETE'
                }),
                'useAvatar.deleteAvatar'
            );

            if (result.success) {
                setAvatarUrl(null);
                await SecureStore.deleteItemAsync('avatarUrl');
                onSuccess?.('Profil fotoğrafı silindi');
                return { success: true };
            } else {
                onError?.(result.error);
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('[useAvatar] Delete error:', error);
            onError?.('Fotoğraf silinemedi');
            return { success: false, error: 'Fotoğraf silinemedi' };
        }
    }, [setAvatarUrl, onSuccess, onError]);

    return {
        avatarUrl,
        uploading,
        pickFromGallery,
        takePhoto,
        deleteAvatar,
        uploadAvatar
    };
};
