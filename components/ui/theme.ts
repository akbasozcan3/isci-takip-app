export const theme = {
  colors: {
    // Dark theme with professional gradients
    bg: '#0a0a0a',
    bgSecondary: '#111111',
    card: '#1a1a1a',
    surface: '#262626',
    border: '#404040',
    borderLight: '#525252',
    
    // Primary brand colors
    primary: '#3b82f6',
    primaryDark: '#2563eb',
    primaryLight: '#60a5fa',
    
    // Accent colors
    accent: '#8b5cf6',
    accentDark: '#7c3aed',
    
    // Status colors
    success: '#10b981',
    successDark: '#059669',
    warning: '#f59e0b',
    warningDark: '#d97706',
    danger: '#ef4444',
    dangerDark: '#dc2626',
    info: '#06b6d4',
    infoDark: '#0891b2',
    
    // Text colors
    text: '#ffffff',
    textSecondary: '#e5e5e5',
    textMuted: '#a3a3a3',
    textLight: '#737373',
    
    // Utility colors
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
    
    // Gradient colors
    gradient: {
      primary: ['#3b82f6', '#8b5cf6'],
      secondary: ['#06b6d4', '#3b82f6'],
      accent: ['#8b5cf6', '#ec4899'],
      dark: ['#1a1a1a', '#0a0a0a'],
    }
  },
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 9999,
  },
  spacing: (n: number) => n * 4,
  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 12,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.5,
      shadowRadius: 24,
      elevation: 16,
    },
  },
  typography: {
    h1: { fontSize: 32, fontWeight: '800' as const, lineHeight: 40 },
    h2: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
    h3: { fontSize: 24, fontWeight: '600' as const, lineHeight: 32 },
    h4: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
    body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
    bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  },
  animation: {
    fast: 200,
    normal: 300,
    slow: 500,
  }
};
export default theme;
