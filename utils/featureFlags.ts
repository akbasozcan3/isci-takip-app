/**
 * Feature Flags Utility
 * Client-side feature gating based on subscription plans
 */

export const FEATURE_MATRIX: Record<string, string[]> = {
    // Tracking features
    realtimeTracking: ['plus', 'business'],
    advancedReports: ['plus', 'business'],

    // API & Integration
    apiAccess: ['business'],
    webhooks: ['business'],

    // Support
    prioritySupport: ['plus', 'business'],
    dedicatedManager: ['business'],

    // Data & Storage
    unlimitedStorage: ['business'],
    extendedRetention: ['plus', 'business'],

    // Team features
    teamManagement: ['plus', 'business'],
    roleBasedAccess: ['business'],

    // Notifications
    smsNotifications: ['plus', 'business'],
    pushNotifications: ['free', 'plus', 'business'],

    // Performance
    highPriorityProcessing: ['plus', 'business'],
    advancedCaching: ['plus', 'business'],

    // Analytics
    advancedAnalytics: ['plus', 'business'],
    customReports: ['business'],
    exportData: ['plus', 'business']
};

/**
 * Check if a plan allows a specific feature
 */
export const canUseFeature = (feature: string, planId: string): boolean => {
    const allowedPlans = FEATURE_MATRIX[feature];

    if (!allowedPlans) {
        // Feature not defined, allow for all plans
        console.warn(`[FeatureFlags] Feature "${feature}" not defined in FEATURE_MATRIX`);
        return true;
    }

    return allowedPlans.includes(planId);
};

/**
 * Get minimum plan required for a feature
 */
export const getMinimumPlanForFeature = (feature: string): string => {
    const allowedPlans = FEATURE_MATRIX[feature];

    if (!allowedPlans || allowedPlans.length === 0) {
        return 'free';
    }

    const planOrder: Record<string, number> = { free: 0, plus: 1, business: 2 };
    const sortedPlans = allowedPlans.sort((a, b) => planOrder[a] - planOrder[b]);

    return sortedPlans[0];
};

/**
 * Get all features available for a plan
 */
export const getFeaturesForPlan = (planId: string): string[] => {
    const features: string[] = [];

    for (const [feature, plans] of Object.entries(FEATURE_MATRIX)) {
        if (plans.includes(planId)) {
            features.push(feature);
        }
    }

    return features;
};

/**
 * Get features that would be unlocked by upgrading to a plan
 */
export const getUnlockedFeatures = (currentPlan: string, targetPlan: string): string[] => {
    const currentFeatures = getFeaturesForPlan(currentPlan);
    const targetFeatures = getFeaturesForPlan(targetPlan);

    return targetFeatures.filter(f => !currentFeatures.includes(f));
};

/**
 * Check if plan upgrade would unlock any features
 */
export const wouldUnlockFeatures = (currentPlan: string, targetPlan: string): boolean => {
    return getUnlockedFeatures(currentPlan, targetPlan).length > 0;
};

/**
 * Get user-friendly feature names
 */
export const FEATURE_NAMES: Record<string, string> = {
    realtimeTracking: 'Gerçek Zamanlı Takip',
    advancedReports: 'Gelişmiş Raporlar',
    apiAccess: 'API Erişimi',
    webhooks: 'Webhook Entegrasyonu',
    prioritySupport: 'Öncelikli Destek',
    dedicatedManager: 'Özel Müşteri Yöneticisi',
    unlimitedStorage: 'Sınırsız Depolama',
    extendedRetention: 'Uzun Süreli Veri Saklama',
    teamManagement: 'Takım Yönetimi',
    roleBasedAccess: 'Rol Bazlı Erişim',
    smsNotifications: 'SMS Bildirimleri',
    pushNotifications: 'Push Bildirimleri',
    highPriorityProcessing: 'Yüksek Öncelikli İşleme',
    advancedCaching: 'Gelişmiş Önbellekleme',
    advancedAnalytics: 'Gelişmiş Analitik',
    customReports: 'Özel Raporlar',
    exportData: 'Veri Dışa Aktarma'
};

/**
 * Get user-friendly name for a feature
 */
export const getFeatureName = (feature: string): string => {
    return FEATURE_NAMES[feature] || feature;
};
