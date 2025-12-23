const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../core/middleware/auth.middleware');
const {
    syncSteps,
    getTodaySteps,
    getHistory,
    getStats,
    updateGoal,
    getGoal,
    deleteGoal,
    getStreak,
    getAchievements,
    startTracking,
    getLeaderboard
} = require('./steps.controller');
const {
    syncStepsSchema,
    updateGoalSchema,
    historyQuerySchema,
    statsQuerySchema
} = require('./steps.validation');

// Validation middleware
const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                error: error.details[0].message
            });
        }
        next();
    };
};

const validateQuery = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                error: error.details[0].message
            });
        }
        req.query = value;
        next();
    };
};

// All routes require authentication
router.use(requireAuth);

// Sync/Store step data
router.post('/store', validate(syncStepsSchema), syncSteps);
router.post('/sync', validate(syncStepsSchema), syncSteps); // Alias

// Get today's steps
router.get('/today', getTodaySteps);

// Get history
router.get('/history', validateQuery(historyQuerySchema), getHistory);

// Get statistics
router.get('/stats', validateQuery(statsQuerySchema), getStats);

// Get streak
router.get('/streak', getStreak);

// Goal management
router.get('/goal', getGoal);
router.post('/goal', validate(updateGoalSchema), updateGoal);
router.put('/goal', validate(updateGoalSchema), updateGoal); // Alias
router.delete('/goal', deleteGoal);

// Achievements
router.get('/achievements', getAchievements);

// Start tracking notification
router.post('/start-tracking', startTracking);

// Leaderboard
router.get('/leaderboard', getLeaderboard);

// ============= PREMIUM FEATURES =============
const {
    getWeeklyComparison,
    getInsights,
    getPrediction,
    getHealthScore,
    sendBackgroundNotification
} = require('./steps.controller');

// Premium Analytics
router.get('/analytics/weekly-comparison', getWeeklyComparison);
router.get('/analytics/insights', getInsights);
router.get('/analytics/prediction', getPrediction);
router.get('/analytics/health-score', getHealthScore);

// Background Notifications
router.post('/background-notification', sendBackgroundNotification);

module.exports = router;
