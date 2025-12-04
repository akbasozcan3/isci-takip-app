export const theme = {
  colors: {
    bg: '#0f172a',
    bgSecondary: '#1e293b',
    card: '#1e293b',
    surface: '#334155',
    border: '#334155',
    borderLight: '#475569',
    
    primary: '#06b6d4',
    primaryDark: '#0891b2',
    primaryLight: '#22d3ee',
    
    accent: '#7c3aed',
    accentDark: '#6d28d9',
    
    success: '#10b981',
    successDark: '#059669',
    warning: '#f59e0b',
    warningDark: '#d97706',
    danger: '#ef4444',
    dangerDark: '#dc2626',
    info: '#06b6d4',
    infoDark: '#0891b2',
    
    text: '#ffffff',
    textSecondary: '#e2e8f0',
    textMuted: '#94a3b8',
    textLight: '#64748b',
    
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
    
    gps: {
      active: '#10b981',
      inactive: '#64748b',
      pulse: '#06b6d4',
      marker: '#06b6d4',
      path: '#06b6d4',
      accuracy: 'rgba(6,182,212,0.2)',
      group: '#7c3aed',
      user: '#06b6d4',
      center: '#ef4444',
    },
    
    gradient: {
      primary: ['#06b6d4', '#0891b2'],
      secondary: ['#7c3aed', '#6d28d9'],
      accent: ['#8b5cf6', '#ec4899'],
      dark: ['#1e293b', '#0f172a'],
      gps: ['#06b6d4', '#0ea5a4'],
      success: ['#10b981', '#059669'],
      danger: ['#ef4444', '#dc2626'],
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
