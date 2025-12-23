/**
 * Professional Font System for Bavaxe
 * Supports Poppins font family with fallback to system fonts
 */

export const FontWeights = {
    regular: '400',
    medium: '500',
    semiBold: '600',
    bold: '700',
    extraBold: '800',
    black: '900',
} as const;

export const FontFamily = {
    regular: 'Poppins-Regular',
    medium: 'Poppins-Medium',
    semiBold: 'Poppins-SemiBold',
    bold: 'Poppins-Bold',
    extraBold: 'Poppins-ExtraBold',
    black: 'Poppins-Black',
} as const;

// Fallback to system fonts if Poppins is not loaded
export const SystemFonts = {
    ios: 'System',
    android: 'Roboto',
    default: 'System',
} as const;

/**
 * Get font family based on weight
 * Automatically falls back to system font if Poppins is not available
 */
export const getFontFamily = (
    weight: keyof typeof FontFamily = 'regular',
    platform: 'ios' | 'android' | 'default' = 'default'
): string => {
    // Try to use Poppins first
    const poppinsFont = FontFamily[weight];

    // If font loading fails, system will automatically use fallback
    return poppinsFont;
};

/**
 * Text style presets for consistent typography
 */
export const TextStyles = {
    // Headings
    h1: {
        fontFamily: FontFamily.black,
        fontSize: 32,
        lineHeight: 40,
        letterSpacing: 0.5,
    },
    h2: {
        fontFamily: FontFamily.bold,
        fontSize: 28,
        lineHeight: 36,
        letterSpacing: 0.5,
    },
    h3: {
        fontFamily: FontFamily.bold,
        fontSize: 24,
        lineHeight: 32,
        letterSpacing: 0.3,
    },
    h4: {
        fontFamily: FontFamily.semiBold,
        fontSize: 20,
        lineHeight: 28,
        letterSpacing: 0.2,
    },
    h5: {
        fontFamily: FontFamily.semiBold,
        fontSize: 18,
        lineHeight: 24,
        letterSpacing: 0.2,
    },
    h6: {
        fontFamily: FontFamily.semiBold,
        fontSize: 16,
        lineHeight: 22,
        letterSpacing: 0.1,
    },

    // Body text
    bodyLarge: {
        fontFamily: FontFamily.regular,
        fontSize: 16,
        lineHeight: 24,
    },
    body: {
        fontFamily: FontFamily.regular,
        fontSize: 14,
        lineHeight: 20,
    },
    bodySmall: {
        fontFamily: FontFamily.regular,
        fontSize: 12,
        lineHeight: 18,
    },

    // Special
    button: {
        fontFamily: FontFamily.semiBold,
        fontSize: 16,
        lineHeight: 24,
        letterSpacing: 0.5,
    },
    caption: {
        fontFamily: FontFamily.medium,
        fontSize: 12,
        lineHeight: 16,
    },
    overline: {
        fontFamily: FontFamily.semiBold,
        fontSize: 10,
        lineHeight: 16,
        letterSpacing: 1.5,
        textTransform: 'uppercase' as const,
    },
} as const;

/**
 * Font loading configuration for expo-font
 */
export const FontAssets = {
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
    'Poppins-ExtraBold': require('../assets/fonts/Poppins-ExtraBold.ttf'),
    'Poppins-Black': require('../assets/fonts/Poppins-Black.ttf'),
};

export default {
    FontFamily,
    FontWeights,
    getFontFamily,
    TextStyles,
    FontAssets,
};
