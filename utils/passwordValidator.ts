/**
 * Password Validation Utilities
 * Centralized password strength calculation and validation
 */

export interface PasswordStrength {
    score: number; // 0-4
    label: string;
    color: string;
    suggestions: string[];
}

/**
 * Calculate password strength score
 * @param password - Password to evaluate
 * @returns Score from 0 (weakest) to 4 (strongest)
 */
export const calculatePasswordStrength = (password: string): number => {
    if (!password) return 0;

    let score = 0;

    // Length checks
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (password.length >= 14) score++;

    // Character variety checks
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    // Cap at 4
    return Math.min(score, 4);
};

/**
 * Get password strength label
 */
export const getPasswordStrengthLabel = (score: number): string => {
    switch (score) {
        case 0:
            return 'Şifre Giriniz';
        case 1:
            return 'Çok Zayıf';
        case 2:
            return 'Zayıf';
        case 3:
            return 'Orta';
        case 4:
            return 'Güçlü';
        default:
            return 'Bilinmiyor';
    }
};

/**
 * Get password strength color
 */
export const getPasswordStrengthColor = (score: number): string => {
    switch (score) {
        case 0:
        case 1:
            return '#ef4444'; // Red
        case 2:
            return '#f59e0b'; // Orange
        case 3:
            return '#0EA5E9'; // Blue
        case 4:
            return '#10b981'; // Green
        default:
            return '#64748b'; // Gray
    }
};

/**
 * Get password improvement suggestions
 */
export const getPasswordSuggestions = (password: string): string[] => {
    const suggestions: string[] = [];

    if (password.length < 6) {
        suggestions.push('En az 6 karakter kullanın');
    }

    if (password.length < 10) {
        suggestions.push('Daha uzun bir şifre daha güvenlidir');
    }

    if (!/[A-Z]/.test(password)) {
        suggestions.push('Büyük harf ekleyin');
    }

    if (!/[a-z]/.test(password)) {
        suggestions.push('Küçük harf ekleyin');
    }

    if (!/[0-9]/.test(password)) {
        suggestions.push('Rakam ekleyin');
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        suggestions.push('Özel karakter ekleyin (!@#$%^&*)');
    }

    return suggestions;
};

/**
 * Get complete password strength analysis
 */
export const analyzePassword = (password: string): PasswordStrength => {
    const score = calculatePasswordStrength(password);

    return {
        score,
        label: getPasswordStrengthLabel(score),
        color: getPasswordStrengthColor(score),
        suggestions: getPasswordSuggestions(password)
    };
};

/**
 * Validate password meets minimum requirements
 */
export const validatePassword = (password: string): { valid: boolean; error?: string } => {
    if (!password) {
        return { valid: false, error: 'Şifre gereklidir' };
    }

    if (password.length < 6) {
        return { valid: false, error: 'Şifre en az 6 karakter olmalıdır' };
    }

    const score = calculatePasswordStrength(password);
    if (score < 2) {
        return { valid: false, error: 'Şifre çok zayıf. Daha güçlü bir şifre seçin' };
    }

    return { valid: true };
};

/**
 * Check if passwords match
 */
export const passwordsMatch = (password: string, confirmPassword: string): boolean => {
    return password === confirmPassword && password.length > 0;
};
