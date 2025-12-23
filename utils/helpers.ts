/**
 * Centralized Helper Utilities
 * Reduces code duplication and provides reusable functions
 */

import { authFetch } from './auth';

/**
 * User Profile Helpers
 */
export const userHelpers = {
    /**
     * Fetch user profile
     */
    async fetchProfile(userId?: string): Promise<any> {
        const endpoint = userId ? `/users/${userId}` : '/users/me';
        const response = await authFetch(endpoint);

        if (!response.ok) {
            throw new Error('Failed to fetch user profile');
        }

        return response.json();
    },

    /**
     * Update user profile
     */
    async updateProfile(data: {
        displayName?: string;
        phone?: string;
        email?: string;
    }): Promise<any> {
        const response = await authFetch('/auth/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to update profile');
        }

        return response.json();
    },

    /**
     * Upload avatar
     */
    async uploadAvatar(uri: string): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
        try {
            // Validate URI
            if (!uri || uri.trim() === '') {
                return { success: false, error: 'Geçersiz fotoğraf' };
            }

            // Create FormData
            const formData = new FormData();
            const filename = uri.split('/').pop() || `avatar_${Date.now()}.jpg`;

            // Detect file type
            const match = /\.(\w+)$/.exec(filename);
            let type = 'image/jpeg';

            if (match) {
                const ext = match[1].toLowerCase();
                if (ext === 'png') type = 'image/png';
                else if (ext === 'jpg' || ext === 'jpeg') type = 'image/jpeg';
                else if (ext === 'heic' || ext === 'heif') type = 'image/jpeg';
            }

            formData.append('avatar', {
                uri,
                name: filename,
                type,
            } as any);

            const response = await authFetch('/users/me/avatar', {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (response.ok) {
                const data = await response.json();
                return { success: true, avatarUrl: data.avatarUrl };
            } else {
                const error = await response.json().catch(() => ({}));
                return { success: false, error: error.error || 'Fotoğraf yüklenemedi' };
            }
        } catch (error) {
            console.error('[userHelpers] Upload avatar error:', error);
            return { success: false, error: 'Fotoğraf yüklenirken hata oluştu' };
        }
    },

    /**
     * Delete avatar
     */
    async deleteAvatar(): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await authFetch('/users/me/avatar', {
                method: 'DELETE',
            });

            if (response.ok) {
                return { success: true };
            } else {
                const error = await response.json().catch(() => ({}));
                return { success: false, error: error.error || 'Fotoğraf silinemedi' };
            }
        } catch (error) {
            console.error('[userHelpers] Delete avatar error:', error);
            return { success: false, error: 'Fotoğraf silinemedi' };
        }
    },
};

/**
 * Format Helpers
 */
export const formatHelpers = {
    /**
     * Format phone number (Turkish format)
     */
    formatPhone(phone: string): string {
        const cleaned = phone.replace(/\D/g, '');

        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
        }

        return phone;
    },

    /**
     * Format date
     */
    formatDate(date: string | Date, format: 'short' | 'long' = 'short'): string {
        const d = typeof date === 'string' ? new Date(date) : date;

        if (format === 'short') {
            return d.toLocaleDateString('tr-TR');
        }

        return d.toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    },

    /**
     * Format time
     */
    formatTime(date: string | Date): string {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    },

    /**
     * Format distance
     */
    formatDistance(meters: number): string {
        if (meters < 1000) {
            return `${Math.round(meters)} m`;
        }
        return `${(meters / 1000).toFixed(1)} km`;
    },

    /**
     * Format duration
     */
    formatDuration(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}s ${minutes}d`;
        }
        if (minutes > 0) {
            return `${minutes}d ${secs}s`;
        }
        return `${secs}s`;
    },
};

/**
 * Validation Helpers
 */
export const validationHelpers = {
    /**
     * Validate email
     */
    isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    /**
     * Validate phone (Turkish)
     */
    isValidPhone(phone: string): boolean {
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.length === 10 && cleaned.startsWith('5');
    },

    /**
     * Validate password strength
     */
    isStrongPassword(password: string): boolean {
        return (
            password.length >= 8 &&
            /[A-Z]/.test(password) &&
            /[a-z]/.test(password) &&
            /[0-9]/.test(password)
        );
    },
};

/**
 * Storage Helpers
 */
export const storageHelpers = {
    /**
     * Safe JSON parse
     */
    parseJSON<T>(value: string | null, fallback: T): T {
        if (!value) return fallback;

        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    },

    /**
     * Safe JSON stringify
     */
    stringifyJSON(value: any): string | null {
        try {
            return JSON.stringify(value);
        } catch {
            return null;
        }
    },
};

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            timeout = null;
            func(...args);
        };

        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;

    return function executedFunction(...args: Parameters<T>) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}
