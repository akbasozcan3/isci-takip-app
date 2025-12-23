/**
 * Performance Optimizer Middleware
 * Dynamically adjusts backend performance based on user's subscription plan
 * Premium users get better cache, higher rate limits, and optimized processing
 */

const db = require('../config/database');
const SubscriptionModel = require('../core/database/models/subscription.model');

/**
 * Performance optimization middleware
 * Automatically applied to authenticated routes
 */
function performanceOptimizer(req, res, next) {
    try {
        const userId = req.user?.id;

        if (!userId) {
            // No user, use default (free) settings
            applyPerformanceSettings(req, res, 'free');
            return next();
        }

        // Get user's subscription
        const subscription = db.getUserSubscription(userId);
        const planId = subscription?.planId || 'free';
        const limits = SubscriptionModel.getPlanLimits(planId);

        // Apply performance settings based on plan
        applyPerformanceSettings(req, res, planId, limits);

        // Store plan info in request for downstream use
        req.performanceProfile = {
            planId,
            cacheTTL: limits.cacheTTL,
            rateLimit: limits.rateLimitRequests,
            batchSize: limits.batchSize,
            compression: limits.responseCompression,
            optimization: limits.queryOptimization,
            boost: limits.performanceBoost
        };

        next();
    } catch (error) {
        console.error('[PerformanceOptimizer] Error:', error);
        // On error, use default settings
        applyPerformanceSettings(req, res, 'free');
        next();
    }
}

/**
 * Apply performance settings based on plan
 */
function applyPerformanceSettings(req, res, planId, limits = null) {
    const planLimits = limits || SubscriptionModel.getPlanLimits(planId);

    // Set cache control headers
    if (planLimits.cacheTTL > 0) {
        const maxAge = Math.floor(planLimits.cacheTTL / 1000);
        res.setHeader('Cache-Control', `private, max-age=${maxAge}`);
    } else {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    // Enable compression for premium plans
    if (planLimits.responseCompression) {
        res.setHeader('X-Compression-Enabled', 'true');
    }

    // Add performance tier header
    res.setHeader('X-Performance-Tier', planId);
    res.setHeader('X-Performance-Boost', `${planLimits.performanceBoost}x`);

    // Store settings in request
    req.cacheTTL = planLimits.cacheTTL;
    req.batchSize = planLimits.batchSize;
    req.enableCompression = planLimits.responseCompression;
    req.enableOptimization = planLimits.queryOptimization;
    req.performanceBoost = planLimits.performanceBoost;
}

/**
 * Get optimized batch size for current user
 */
function getOptimizedBatchSize(req, defaultSize = 10) {
    const batchSize = req.batchSize || req.planLimits?.batchSize || defaultSize;
    return Math.min(batchSize, 200); // Cap at 200 for safety
}

/**
 * Get cache TTL for current user
 */
function getCacheTTL(req, defaultTTL = 60000) {
    return req.cacheTTL || req.planLimits?.cacheTTL || defaultTTL;
}

/**
 * Check if query optimization is enabled
 */
function shouldOptimizeQuery(req) {
    return req.enableOptimization || req.planLimits?.queryOptimization || false;
}

/**
 * Check if response compression is enabled
 */
function shouldCompressResponse(req) {
    return req.enableCompression || req.planLimits?.responseCompression || false;
}

/**
 * Get performance boost multiplier
 */
function getPerformanceBoost(req) {
    return req.performanceBoost || req.planLimits?.performanceBoost || 1.0;
}

/**
 * Middleware to enable smart caching based on plan
 */
function smartCache(req, res, next) {
    const userId = req.user?.id;

    if (!userId) {
        return next();
    }

    const subscription = db.getUserSubscription(userId);
    const planId = subscription?.planId || 'free';
    const limits = SubscriptionModel.getPlanLimits(planId);

    // Only enable smart caching for premium plans
    if (limits.smartCaching) {
        req.enableSmartCache = true;
        req.cacheTTL = limits.cacheTTL;

        // Add cache headers
        res.setHeader('X-Smart-Cache', 'enabled');
    }

    next();
}

/**
 * Middleware to enable prefetching for premium users
 */
function enablePrefetching(req, res, next) {
    const userId = req.user?.id;

    if (!userId) {
        return next();
    }

    const subscription = db.getUserSubscription(userId);
    const planId = subscription?.planId || 'free';
    const limits = SubscriptionModel.getPlanLimits(planId);

    if (limits.prefetching) {
        req.enablePrefetch = true;
        res.setHeader('X-Prefetch-Enabled', 'true');
    }

    next();
}

/**
 * Middleware to enable parallel processing for premium users
 */
function enableParallelProcessing(req, res, next) {
    const userId = req.user?.id;

    if (!userId) {
        return next();
    }

    const subscription = db.getUserSubscription(userId);
    const planId = subscription?.planId || 'free';
    const limits = SubscriptionModel.getPlanLimits(planId);

    if (limits.parallelProcessing) {
        req.enableParallel = true;
        req.maxConcurrent = limits.maxConcurrentRequests;
        res.setHeader('X-Parallel-Processing', 'enabled');
    }

    next();
}

/**
 * Get optimized query options based on plan
 */
function getQueryOptions(req) {
    const limits = req.planLimits || SubscriptionModel.getPlanLimits('free');

    return {
        limit: limits.batchSize || 10,
        enableOptimization: limits.queryOptimization || false,
        enableIndexHints: limits.queryOptimization || false,
        enableParallel: limits.parallelProcessing || false,
        maxConcurrent: limits.maxConcurrentRequests || 2,
        cacheTTL: limits.cacheTTL || 60000
    };
}

module.exports = {
    performanceOptimizer,
    smartCache,
    enablePrefetching,
    enableParallelProcessing,
    getOptimizedBatchSize,
    getCacheTTL,
    shouldOptimizeQuery,
    shouldCompressResponse,
    getPerformanceBoost,
    getQueryOptions
};
