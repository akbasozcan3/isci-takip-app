// Premium Design System
// Unified theme for consistent premium UI across all screens

export const colors = {
    primary: {
        purple: ['#8b5cf6', '#7c3aed'],
        cyan: ['#0EA5E9', '#06B6D4'],
        green: ['#10b981', '#059669'],
        red: ['#ef4444', '#dc2626'],
        orange: ['#f59e0b', '#d97706'],
    },
    background: {
        dark: '#0f172a',
        darker: '#020617',
        card: 'rgba(30, 41, 59, 0.97)',
        cardLight: 'rgba(30, 41, 59, 0.8)',
        input: 'rgba(15, 23, 42, 0.6)',
        modal: 'rgba(15, 23, 42, 0.95)',
    },
    text: {
        primary: '#e2e8f0',
        secondary: '#94a3b8',
        tertiary: '#64748b',
        disabled: '#475569',
    },
    border: {
        primary: 'rgba(99, 102, 241, 0.25)',
        secondary: 'rgba(148, 163, 184, 0.2)',
        cyan: 'rgba(14, 165, 233, 0.3)',
        purple: 'rgba(139, 92, 246, 0.3)',
    },
    status: {
        online: '#10b981',
        offline: '#64748b',
        away: '#f59e0b',
    }
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
};

export const typography = {
    h1: {
        fontSize: 28,
        fontWeight: '900' as const,
        fontFamily: 'Poppins-Black',
        color: colors.text.primary,
    },
    h2: {
        fontSize: 24,
        fontWeight: '800' as const,
        fontFamily: 'Poppins-ExtraBold',
        color: colors.text.primary,
    },
    h3: {
        fontSize: 20,
        fontWeight: '700' as const,
        fontFamily: 'Poppins-Bold',
        color: colors.text.primary,
    },
    h4: {
        fontSize: 18,
        fontWeight: '600' as const,
        fontFamily: 'Poppins-SemiBold',
        color: colors.text.primary,
    },
    body: {
        fontSize: 15,
        fontWeight: '400' as const,
        fontFamily: 'Poppins-Regular',
        color: colors.text.primary,
    },
    bodyBold: {
        fontSize: 15,
        fontWeight: '600' as const,
        fontFamily: 'Poppins-SemiBold',
        color: colors.text.primary,
    },
    caption: {
        fontSize: 12,
        fontWeight: '500' as const,
        fontFamily: 'Poppins-Medium',
        color: colors.text.secondary,
    },
    small: {
        fontSize: 11,
        fontWeight: '400' as const,
        fontFamily: 'Poppins-Regular',
        color: colors.text.tertiary,
    },
};

export const shadows = {
    none: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
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
        shadowRadius: 8,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    },
    xl: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 12,
    },
    colored: {
        cyan: {
            shadowColor: '#0EA5E9',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 3,
        },
        purple: {
            shadowColor: '#8b5cf6',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 3,
        },
        green: {
            shadowColor: '#10b981',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 3,
        },
    }
};

export const borderRadius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 9999,
};

export const animations = {
    fast: 200,
    normal: 300,
    slow: 500,
};

// Premium card style
export const premiumCard = {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1.5,
    borderColor: colors.border.primary,
    ...shadows.lg,
};

// Premium button style
export const premiumButton = {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    ...shadows.md,
};

// Premium input style
export const premiumInput = {
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.secondary,
    color: colors.text.primary,
    fontFamily: 'Poppins-Regular',
    fontSize: 15,
};

export default {
    colors,
    spacing,
    typography,
    shadows,
    borderRadius,
    animations,
    premiumCard,
    premiumButton,
    premiumInput,
};
