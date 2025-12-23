/**
 * Plan Feature Gate Middleware
 * Enforces plan-based feature access across the application
 * Returns 402 Payment Required for premium features on free plans
 */

const db = require('../config/database');
const SubscriptionModel = require('../core/database/models/subscription.model');
const ResponseFormatter = require('../core/utils/responseFormatter');

/**
 * Middleware factory to gate features based on subscription plan
 * @param {string} feature - Feature name from PLAN_LIMITS
 * @param {object} options - Configuration options
 * @returns {Function} Express middleware
 */
function planFeatureGate(feature, options = {}) {
    const {
        customMessage = null,
        logAccess = true,
        includeUpgradeInfo = true
    } = options;

    return async (req, res, next) => {
        try {
            // Get user from request (set by requireAuth middleware)
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json(
                    ResponseFormatter.error('Authentication required', 'AUTH_REQUIRED')
                );
            }

            // Get user's subscription
            const subscription = db.getUserSubscription(userId);
            const planId = subscription?.planId || 'free';
            const limits = SubscriptionModel.getPlanLimits(planId);

            // Check if feature is allowed
            const featureValue = limits[feature];
            const isAllowed = featureValue === true || featureValue === -1;

            // Log feature access attempt
            if (logAccess) {
                const activityLogService = require('../services/activityLogService');
                activityLogService.logActivity(userId, 'feature_access', feature, {
                    planId,
                    allowed: isAllowed,
                    path: req.path,
                    method: req.method
                });
            }

            if (!isAllowed) {
                // Feature not allowed - return 402 Payment Required
                const upgradeInfo = includeUpgradeInfo
                    ? getUpgradeInformation(feature, planId)
                    : null;

                const message = customMessage || `Bu özellik ${planId} planında mevcut değil`;

                return res.status(402).json(
                    ResponseFormatter.error(message, 'FEATURE_REQUIRES_UPGRADE', {
                        feature,
                        currentPlan: planId,
                        featureAvailableIn: upgradeInfo?.availablePlans || [],
                        suggestedPlan: upgradeInfo?.suggestedPlan || null,
                        upgradeUrl: '/api/plans',
                        upgradeMessage: upgradeInfo?.message || 'Planınızı yükselterek bu özelliğe erişebilirsiniz'
                    })
                );
            }

            // Feature allowed - continue to next middleware
            req.userPlan = planId;
            req.planLimits = limits;
            next();
        } catch (error) {
            console.error('[PlanFeatureGate] Error:', error);
            // On error, allow access but log the issue
            next();
        }
    };
}

/**
 * Get upgrade information for a specific feature
 * @param {string} feature - Feature name
 * @param {string} currentPlan - Current plan ID
 * @returns {object} Upgrade information
 */
function getUpgradeInformation(feature, currentPlan) {
    const PLAN_HIERARCHY = ['free', 'plus', 'business'];
    const currentIndex = PLAN_HIERARCHY.indexOf(currentPlan);

    // Find which plans have this feature
    const availablePlans = [];
    for (const planId of PLAN_HIERARCHY) {
        const limits = SubscriptionModel.getPlanLimits(planId);
        const featureValue = limits[feature];
        if (featureValue === true || featureValue === -1) {
            availablePlans.push(planId);
        }
    }

    // Suggest the lowest plan that has this feature
    const suggestedPlan = availablePlans.find(
        plan => PLAN_HIERARCHY.indexOf(plan) > currentIndex
    );

    // Create user-friendly message
    const featureMessages = {
        realtimeTracking: 'Gerçek zamanlı takip için Plus veya Business planına geçin',
        advancedReports: 'Gelişmiş raporlama için Plus veya Business planına geçin',
        apiAccess: 'API erişimi için Business planına geçin',
        prioritySupport: 'Öncelikli destek için Plus veya Business planına geçin',
        smsEnabled: 'SMS bildirimleri için Plus veya Business planına geçin',
        advancedAnalytics: 'Gelişmiş analitik için Plus veya Business planına geçin'
    };

    return {
        availablePlans,
        suggestedPlan,
        message: featureMessages[feature] || `${feature} özelliği için planınızı yükseltin`
    };
}

/**
 * Check if user can perform action based on limit count
 * @param {string} limitType - Limit type (e.g., 'maxGroups')
 * @param {number} currentCount - Current usage count
 * @returns {Function} Express middleware
 */
function checkLimit(limitType, getCurrentCount) {
    return async (req, res, next) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json(
                    ResponseFormatter.error('Authentication required', 'AUTH_REQUIRED')
                );
            }

            const subscription = db.getUserSubscription(userId);
            const planId = subscription?.planId || 'free';
            const limits = SubscriptionModel.getPlanLimits(planId);
            const limit = limits[limitType];

            // -1 means unlimited
            if (limit === -1) {
                req.userPlan = planId;
                req.planLimits = limits;
                return next();
            }

            // Get current count
            const currentCount = typeof getCurrentCount === 'function'
                ? await getCurrentCount(userId, req)
                : 0;

            if (currentCount >= limit) {
                const upgradeInfo = getUpgradeInformation(limitType, planId);

                return res.status(402).json(
                    ResponseFormatter.error(
                        `${limitType} limiti aşıldı (${currentCount}/${limit})`,
                        'LIMIT_EXCEEDED',
                        {
                            limitType,
                            currentCount,
                            limit,
                            currentPlan: planId,
                            suggestedPlan: upgradeInfo?.suggestedPlan,
                            upgradeMessage: `Daha fazla ${limitType} için planınızı yükseltin`
                        }
                    )
                );
            }

            req.userPlan = planId;
            req.planLimits = limits;
            req.currentCount = currentCount;
            req.remaining = limit - currentCount;
            next();
        } catch (error) {
            console.error('[CheckLimit] Error:', error);
            next();
        }
    };
}

/**
 * Middleware to attach subscription info to request
 */
function attachSubscriptionInfo(req, res, next) {
    try {
        const userId = req.user?.id;
        if (userId) {
            const subscription = db.getUserSubscription(userId);
            const planId = subscription?.planId || 'free';
            const limits = SubscriptionModel.getPlanLimits(planId);

            req.subscription = subscription;
            req.userPlan = planId;
            req.planLimits = limits;
        }
        next();
    } catch (error) {
        console.error('[AttachSubscriptionInfo] Error:', error);
        next();
    }
}

module.exports = {
    planFeatureGate,
    checkLimit,
    attachSubscriptionInfo,
    getUpgradeInformation
};
