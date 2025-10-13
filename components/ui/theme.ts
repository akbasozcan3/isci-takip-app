export const theme = {
  colors: {
    bg: '#0f172a',
    card: '#111827',
    surface: '#1e293b',
    border: '#334155',
    primary: '#06b6d4',
    primaryDark: '#0ea5a4',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    text: '#e2e8f0',
    textMuted: '#94a3b8',
    white: '#ffffff',
  },
  radius: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
  },
  spacing: (n: number) => n * 8,
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 10,
    },
  },
};
export default theme;
