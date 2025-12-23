/**
 * Accessibility Utilities
 * Helper functions and components for better accessibility
 */

import { AccessibilityRole, AccessibilityState } from 'react-native';

/**
 * Accessibility props builder
 */
export interface A11yProps {
    accessible?: boolean;
    accessibilityLabel?: string;
    accessibilityHint?: string;
    accessibilityRole?: AccessibilityRole;
    accessibilityState?: AccessibilityState;
    accessibilityValue?: {
        min?: number;
        max?: number;
        now?: number;
        text?: string;
    };
}

/**
 * Create accessibility props for buttons
 */
export const createButtonA11y = (
    label: string,
    hint?: string,
    disabled?: boolean
): A11yProps => ({
    accessible: true,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityRole: 'button',
    accessibilityState: { disabled: disabled || false }
});

/**
 * Create accessibility props for text inputs
 */
export const createInputA11y = (
    label: string,
    hint?: string,
    value?: string
): A11yProps => ({
    accessible: true,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityRole: 'text',
    accessibilityValue: { text: value }
});

/**
 * Create accessibility props for images
 */
export const createImageA11y = (
    label: string,
    decorative: boolean = false
): A11yProps => ({
    accessible: !decorative,
    accessibilityLabel: decorative ? undefined : label,
    accessibilityRole: decorative ? 'none' : 'image'
});

/**
 * Create accessibility props for links
 */
export const createLinkA11y = (
    label: string,
    hint?: string
): A11yProps => ({
    accessible: true,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityRole: 'link'
});

/**
 * Create accessibility props for headers
 */
export const createHeaderA11y = (
    label: string,
    level: number = 1
): A11yProps => ({
    accessible: true,
    accessibilityLabel: label,
    accessibilityRole: 'header'
});

/**
 * Create accessibility props for progress indicators
 */
export const createProgressA11y = (
    label: string,
    current: number,
    total: number
): A11yProps => ({
    accessible: true,
    accessibilityLabel: label,
    accessibilityRole: 'progressbar',
    accessibilityValue: {
        min: 0,
        max: total,
        now: current,
        text: `${current} / ${total}`
    }
});

/**
 * Create accessibility props for toggles/switches
 */
export const createToggleA11y = (
    label: string,
    checked: boolean,
    hint?: string
): A11yProps => ({
    accessible: true,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityRole: 'switch',
    accessibilityState: { checked }
});

/**
 * Create accessibility props for checkboxes
 */
export const createCheckboxA11y = (
    label: string,
    checked: boolean,
    hint?: string
): A11yProps => ({
    accessible: true,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityRole: 'checkbox',
    accessibilityState: { checked }
});

/**
 * Create accessibility props for radio buttons
 */
export const createRadioA11y = (
    label: string,
    selected: boolean,
    hint?: string
): A11yProps => ({
    accessible: true,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityRole: 'radio',
    accessibilityState: { selected }
});

/**
 * Announce to screen readers
 */
export const announceForAccessibility = (message: string) => {
    // This would be implemented using AccessibilityInfo.announceForAccessibility
    // in the component that uses it
    if (__DEV__) {
        console.log('[A11y Announcement]', message);
    }
};

/**
 * Check if screen reader is enabled
 */
export const isScreenReaderEnabled = async (): Promise<boolean> => {
    try {
        const { AccessibilityInfo } = await import('react-native');
        return await AccessibilityInfo.isScreenReaderEnabled();
    } catch {
        return false;
    }
};

/**
 * Common accessibility labels (Turkish)
 */
export const A11yLabels = {
    // Navigation
    back: 'Geri',
    close: 'Kapat',
    menu: 'Menü',
    search: 'Ara',
    filter: 'Filtrele',

    // Actions
    save: 'Kaydet',
    cancel: 'İptal',
    delete: 'Sil',
    edit: 'Düzenle',
    share: 'Paylaş',
    refresh: 'Yenile',

    // Forms
    submit: 'Gönder',
    reset: 'Sıfırla',
    required: 'Zorunlu alan',
    optional: 'İsteğe bağlı',

    // Media
    play: 'Oynat',
    pause: 'Duraklat',
    stop: 'Durdur',
    mute: 'Sessiz',
    unmute: 'Sesi aç',

    // Common
    loading: 'Yükleniyor',
    error: 'Hata',
    success: 'Başarılı',
    warning: 'Uyarı',
    info: 'Bilgi'
};

/**
 * Common accessibility hints (Turkish)
 */
export const A11yHints = {
    // Navigation
    backButton: 'Önceki sayfaya dön',
    closeButton: 'Bu ekranı kapat',
    menuButton: 'Menüyü aç',

    // Actions
    tapToEdit: 'Düzenlemek için dokun',
    tapToDelete: 'Silmek için dokun',
    tapToShare: 'Paylaşmak için dokun',
    doubleTapToActivate: 'Etkinleştirmek için çift dokun',

    // Forms
    enterText: 'Metin girin',
    selectOption: 'Bir seçenek seçin',
    toggleSwitch: 'Açmak veya kapatmak için dokun',

    // Common
    required: 'Bu alan zorunludur',
    optional: 'Bu alan isteğe bağlıdır'
};

/**
 * Format number for screen readers
 */
export const formatNumberForA11y = (num: number): string => {
    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)} milyon`;
    }
    if (num >= 1000) {
        return `${(num / 1000).toFixed(1)} bin`;
    }
    return num.toString();
};

/**
 * Format date for screen readers
 */
export const formatDateForA11y = (date: Date): string => {
    const months = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];

    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

/**
 * Format time for screen readers
 */
export const formatTimeForA11y = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours} saat ${minutes} dakika`;
};
