/**
 * useSubscription Hook
 * Centralized subscription state management for the mobile app
 * Provides feature checking, upgrade prompting, and real-time subscription status
 */

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/auth';

interface Subscription {
    planId: string;
    planName: string;
    status: string;
    renewsAt?: string | null;
    limits?: any;
}

interface UsageStats {
    planId: string;
    usage: any;
    nearingLimits: any[];
    upgradeRecommended: boolean;
}

export const useSubscription = () => {
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [loading, setLoading] = useState(true);
    const [usageStats, setUsageStats] = useState<UsageStats | null>(null);

    // Fetch subscription status
    const refreshSubscription = useCallback(async () => {
        try {
            setLoading(true);
            const response = await authFetch('/me/subscription');

            if (response.ok) {
                const data = await response.json();
                setSubscription(data.subscription || data.data?.subscription);
            }
        } catch (error) {
            console.error('[useSubscription] Error fetching subscription:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch usage statistics
    const refreshUsageStats = useCallback(async () => {
        try {
            const response = await authFetch('/subscription/usage');

            if (response.ok) {
                const data = await response.json();
                setUsageStats(data.data || data);
            }
        } catch (error) {
            console.error('[useSubscription] Error fetching usage stats:', error);
        }
    }, []);

    // Check if user can access a feature
    const checkFeature = useCallback((feature: string): boolean => {
        if (!subscription?.limits) return false;

        const featureValue = subscription.limits[feature];
        return featureValue === true || featureValue === -1;
    }, [subscription]);

    // Check if user is on a specific plan or higher
    const isPlanOrHigher = useCallback((planId: string): boolean => {
        const planOrder: Record<string, number> = { free: 0, plus: 1, business: 2 };
        const currentPlanLevel = planOrder[subscription?.planId || 'free'] || 0;
        const requiredPlanLevel = planOrder[planId] || 0;

        return currentPlanLevel >= requiredPlanLevel;
    }, [subscription]);

    // Get feature access with upgrade info
    const getFeatureAccess = useCallback(async (feature: string) => {
        try {
            const response = await authFetch('/subscription/check-feature', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feature })
            });

            const data = await response.json();

            return {
                allowed: response.ok,
                ...data.data
            };
        } catch (error) {
            console.error('[useSubscription] Error checking feature:', error);
            return { allowed: false };
        }
    }, []);

    // Check if near any limits
    const isNearLimits = useCallback((): boolean => {
        return (usageStats?.nearingLimits?.length || 0) > 0;
    }, [usageStats]);

    // Get upgrade recommendation
    const getUpgradeRecommendation = useCallback(async () => {
        try {
            const response = await authFetch('/subscription/upgrade-eligibility');

            if (response.ok) {
                const data = await response.json();
                return data.data || data;
            }
        } catch (error) {
            console.error('[useSubscription] Error getting upgrade recommendation:', error);
        }

        return null;
    }, []);

    // Initial load
    useEffect(() => {
        refreshSubscription();
        refreshUsageStats();
    }, [refreshSubscription, refreshUsageStats]);

    // Refresh every 5 minutes
    useEffect(() => {
        const interval = setInterval(() => {
            refreshSubscription();
            refreshUsageStats();
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [refreshSubscription, refreshUsageStats]);

    return {
        subscription,
        loading,
        usageStats,
        checkFeature,
        isPlanOrHigher,
        getFeatureAccess,
        isNearLimits,
        getUpgradeRecommendation,
        refreshSubscription,
        refreshUsageStats,
        isPremium: subscription?.planId !== 'free',
        planId: subscription?.planId || 'free'
    };
};
