/**
 * BAVAXE Design System
 * Centralized theme constants for consistent UI/UX
 */

export const theme = {
    // Color Palette
    colors: {
        // Primary Colors (Cyan/Blue)
        primary: {
            50: '#f0f9ff',
            100: '#e0f2fe',
            200: '#bae6fd',
            300: '#7dd3fc',
            400: '#38bdf8',
            500: '#0EA5E9', // Main primary
            600: '#0284c7',
            700: '#0369a1',
            800: '#075985',
            900: '#0c4a6e',
        },

        // Secondary Colors (Purple)
        secondary: {
            50: '#f5f3ff',
            100: '#ede9fe',
            200: '#ddd6fe',
            300: '#c4b5fd',
            400: '#a78bfa',
            500: '#6366F1', // Main secondary
            600: '#4f46e5',
            700: '#4338ca',
            800: '#3730a3',
            900: '#312e81',
        },

        // Semantic Colors
        success: {
            light: '#4ade80',
            main: '#10b981',
            dark: '#059669',
        },
        error: {
            light: '#f87171',
            main: '#ef4444',
            dark: '#dc2626',
        },
        warning: {
            light: '#fbbf24',
            main: '#f59e0b',
            dark: '#d97706',
        },
        info: {
            light: '#60a5fa',
            main: '#3b82f6',
            dark: '#2563eb',
        },

        // Background Colors (Dark Theme)
        background: {
            primary: '#0f172a',     // Main background
            secondary: '#1e293b',   // Card background
            tertiary: '#334155',    // Elevated background
            quaternary: '#475569',  // Hover states
        },

        // Text Colors
        text: {
            primary: '#ffffff',     // Main text
            secondary: '#cbd5e1',   // Secondary text
            tertiary: '#94a3b8',    // Muted text
            disabled: '#64748b',    // Disabled text
            inverse: '#0f172a',     // Text on light background
        },

        // Border Colors
        border: {
            light: 'rgba(255, 255, 255, 0.06)',
            medium: 'rgba(255, 255, 255, 0.1)',
            strong: 'rgba(255, 255, 255, 0.2)',
        },

        // Overlay Colors
        overlay: {
            light: 'rgba(0, 0, 0, 0.3)',
            medium: 'rgba(0, 0, 0, 0.5)',
            strong: 'rgba(0, 0, 0, 0.7)',
        },
    },

    // Spacing Scale (4px base)
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
        xxxl: 64,
    },

    // Border Radius
    borderRadius: {
        xs: 4,
        sm: 8,
        md: 12,
        lg: 16,
        xl: 24,
        xxl: 32,
        full: 9999,
    },

    // Typography
    typography: {
        // Font Families
        fontFamily: {
            regular: 'Poppins-Regular',
            medium: 'Poppins-Medium',
            semiBold: 'Poppins-SemiBold',
            bold: 'Poppins-Bold',
            extraBold: 'Poppins-ExtraBold',
        },

        // Font Sizes
        fontSize: {
            xs: 12,
            sm: 14,
            base: 16,
            lg: 18,
            xl: 20,
            '2xl': 24,
            '3xl': 28,
            '4xl': 32,
            '5xl': 36,
        },

        // Line Heights
        lineHeight: {
            tight: 1.2,
            normal: 1.5,
            relaxed: 1.75,
        },

        // Font Weights
        fontWeight: {
            regular: '400',
            medium: '500',
            semiBold: '600',
            bold: '700',
            extraBold: '800',
            black: '900',
        },

        // Predefined Text Styles
        styles: {
            h1: {
                fontSize: 32,
                fontWeight: '900',
                lineHeight: 1.2,
                fontFamily: 'Poppins-ExtraBold',
            },
            h2: {
                fontSize: 24,
                fontWeight: '800',
                lineHeight: 1.3,
                fontFamily: 'Poppins-Bold',
            },
            h3: {
                fontSize: 20,
                fontWeight: '700',
                lineHeight: 1.4,
                fontFamily: 'Poppins-Bold',
            },
            h4: {
                fontSize: 18,
                fontWeight: '600',
                lineHeight: 1.4,
                fontFamily: 'Poppins-SemiBold',
            },
            body: {
                fontSize: 16,
                fontWeight: '400',
                lineHeight: 1.5,
                fontFamily: 'Poppins-Regular',
            },
            bodyMedium: {
                fontSize: 16,
                fontWeight: '500',
                lineHeight: 1.5,
                fontFamily: 'Poppins-Medium',
            },
            caption: {
                fontSize: 14,
                fontWeight: '400',
                lineHeight: 1.5,
                fontFamily: 'Poppins-Regular',
            },
            small: {
                fontSize: 12,
                fontWeight: '400',
                lineHeight: 1.5,
                fontFamily: 'Poppins-Regular',
            },
        },
    },

    // Shadows
    shadows: {
        sm: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
        },
        md: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        lg: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 6,
        },
        xl: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 16,
            elevation: 10,
        },
        colored: {
            primary: {
                shadowColor: '#0EA5E9',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
            },
            secondary: {
                shadowColor: '#6366F1',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
            },
        },
    },

    // Animation Durations
    animation: {
        fast: 150,
        normal: 300,
        slow: 500,
    },

    // Z-Index Scale
    zIndex: {
        base: 0,
        dropdown: 1000,
        sticky: 1100,
        modal: 1200,
        popover: 1300,
        tooltip: 1400,
        toast: 1500,
    },
} as const;

// Type exports for TypeScript
export type Theme = typeof theme;
export type ThemeColors = typeof theme.colors;
export type ThemeSpacing = typeof theme.spacing;
export type ThemeTypography = typeof theme.typography;
