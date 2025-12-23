import { Theme } from './types';

export const themeData: Theme = {
  colors: {
    primary: '#06b6d4', // Cyan 500
    primaryDark: '#0891b2',
    primaryLight: '#22d3ee',

    secondary: '#3b82f6', // Blue 500 (Changed from Purple for better harmony)
    secondaryDark: '#2563eb',
    secondaryLight: '#60a5fa',

    // Deep dark background for premium feel
    background: '#020617', // Slate 950
    backgroundSecondary: '#0f172a', // Slate 900
    backgroundTertiary: '#1e293b', // Slate 800
    backgroundElevated: '#334155', // Slate 700

    // Surface colors optimized for glassmorphism
    surface: 'rgba(30, 41, 59, 0.7)', // Glassy Slate 800
    surfaceSecondary: 'rgba(51, 65, 85, 0.6)',
    surfaceElevated: 'rgba(71, 85, 105, 0.8)',

    text: '#ffffff',
    textSecondary: '#94a3b8', // Slate 400
    textTertiary: '#64748b', // Slate 500
    textInverse: '#0f172a',

    // Subtle borders for glass effect
    border: 'rgba(255, 255, 255, 0.1)',
    borderSecondary: 'rgba(255, 255, 255, 0.05)',
    borderFocus: '#06b6d4',

    success: '#10b981',
    successLight: '#34d399',
    successDark: '#059669',

    warning: '#f59e0b',
    warningLight: '#fbbf24',
    warningDark: '#d97706',

    error: '#ef4444',
    errorLight: '#f87171',
    errorDark: '#dc2626',

    info: '#06b6d4',
    infoLight: '#22d3ee',
    infoDark: '#0891b2',

    accent: '#06b6d4',
    accentLight: '#22d3ee',
    accentDark: '#0891b2',

    overlay: 'rgba(2, 6, 23, 0.8)',
    overlayDark: 'rgba(2, 6, 23, 0.95)',

    gradients: {
      primary: ['#06b6d4', '#0891b2', '#0e7490'],
      secondary: ['#3b82f6', '#2563eb', '#1d4ed8'],
      success: ['#10b981', '#059669', '#047857'],
      warning: ['#f59e0b', '#d97706', '#b45309'],
      error: ['#ef4444', '#dc2626', '#b91c1c'],
      background: ['#020617', '#0f172a', '#1e293b'], // Site-wide background gradient
      glass: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)'], // Glass card gradient
    },

    gps: {
      active: '#06b6d4',
      inactive: '#475569',
      pulse: 'rgba(6, 182, 212, 0.3)',
      marker: '#06b6d4',
      path: '#06b6d4',
      accuracy: 'rgba(6, 182, 212, 0.1)',
      group: '#8b5cf6',
      user: '#10b981',
      center: '#f59e0b',
    },
  },

  typography: {
    fontFamily: {
      regular: 'Poppins-Regular',
      medium: 'Poppins-Medium',
      semiBold: 'Poppins-SemiBold',
      bold: 'Poppins-Bold',
      black: 'Poppins-Black',
    },
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
      '5xl': 48,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
      loose: 2,
    },
    fontWeight: {
      light: '300',
      regular: '400',
      medium: '500',
      semiBold: '600',
      bold: '700',
      black: '900',
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
    '4xl': 96,
  },

  borderRadius: {
    none: 0,
    sm: 6,
    md: 12,
    lg: 18, // Increased for modern look
    xl: 24,
    '2xl': 32,
    full: 9999,
  },

  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 4,
    },
    lg: { // Glow effect
      shadowColor: '#06b6d4',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 8,
    },
    xl: { // Strong glow
      shadowColor: '#06b6d4',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.35,
      shadowRadius: 30,
      elevation: 12,
    },
    '2xl': {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.5,
      shadowRadius: 40,
      elevation: 24,
    },
    inner: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 0,
    },
  },

  animation: {
    duration: {
      fast: 200,
      normal: 350, // Slightly slower for elegance
      slow: 600,
    },
    easing: {
      default: 'ease-in-out',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
    },
  },

  components: {
    button: {
      height: {
        sm: 40,
        md: 52, // Taller buttons
        lg: 60,
      },
      padding: {
        sm: { horizontal: 16, vertical: 8 },
        md: { horizontal: 24, vertical: 14 },
        lg: { horizontal: 32, vertical: 18 },
      },
    },
    input: {
      height: {
        sm: 40,
        md: 52, // Taller inputs
        lg: 60,
      },
      padding: {
        sm: { horizontal: 12, vertical: 8 },
        md: { horizontal: 16, vertical: 12 },
        lg: { horizontal: 20, vertical: 16 },
      },
    },
    card: {
      padding: {
        sm: 16,
        md: 20,
        lg: 28,
      },
      borderRadius: 24,
    },
  },
};
