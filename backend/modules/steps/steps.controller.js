const Step = require('./steps.model');
const premiumAnalytics = require('../../services/premiumStepAnalytics');
const backgroundNotification = require('../../services/backgroundStepNotification');

/**
 * Sync/Store step data for today
 */
const syncSteps = async (req, res) => {
    try {
        const { steps, distance, calories, duration, date, timestamp } = req.body;
        const userId = req.userId;

        // Use provided date or today's date
        const stepDate = date || new Date().toISOString().split('T')[0];

        // Find or create today's step record
        let stepRecord = await Step.findOne({ userId, date: stepDate });

        if (stepRecord) {
            // Update existing record
            stepRecord.steps = steps;
            stepRecord.distance = distance;
            stepRecord.calories = calories;
            stepRecord.duration = duration;
            stepRecord.lastUpdated = new Date();

            // Check if goal achieved
            if (stepRecord.goal && steps >= stepRecord.goal && !stepRecord.goalAchieved) {
                stepRecord.goalAchieved = true;
            }

            await stepRecord.save();
        } else {
            // Create new record
            stepRecord = await Step.create({
                userId,
                date: stepDate,
                steps,
                distance,
                calories,
                duration,
                lastUpdated: new Date()
            });
        }

        res.json({
            success: true,
            data: {
                saved: true,
                goalAchieved: stepRecord.goalAchieved,
                streak: await calculateStreak(userId)
            }
        });
    } catch (error) {
        console.error('[Steps] Sync error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sync steps',
            error: error.message
        });
    }
};

/**
 * Get today's step data
 */
const getTodaySteps = async (req, res) => {
    try {
        const userId = req.userId;
        const today = new Date().toISOString().split('T')[0];

        const stepRecord = await Step.findOne({ userId, date: today });

        if (!stepRecord) {
            return res.json({
                success: true,
                data: {
                    steps: 0,
                    distance: 0,
                    calories: 0,
                    duration: 0,
                    goal: null,
                    goalAchieved: false
                }
            });
        }

        res.json({
            success: true,
            data: {
                steps: stepRecord.steps,
                distance: stepRecord.distance,
                calories: stepRecord.calories,
                duration: stepRecord.duration,
                goal: stepRecord.goal,
                goalAchieved: stepRecord.goalAchieved,
                streak: await calculateStreak(userId)
            }
        });
    } catch (error) {
        console.error('[Steps] Get today error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get today steps',
            error: error.message
        });
    }
};

/**
 * Get step history
 */
const getHistory = async (req, res) => {
    try {
        const userId = req.userId;
        const days = parseInt(req.query.days) || 7;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];

        const history = await Step.find({
            userId,
            date: { $gte: startDateStr }
        }).sort({ date: -1 }).limit(days);

        res.json({
            success: true,
            data: history.map(record => ({
                date: record.date,
                steps: record.steps,
                distance: record.distance,
                calories: record.calories,
                duration: record.duration,
                goal: record.goal,
                goalAchieved: record.goalAchieved
            }))
        });
    } catch (error) {
        console.error('[Steps] Get history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get history',
            error: error.message
        });
    }
};

/**
 * Get statistics
 */
const getStats = async (req, res) => {
    try {
        const userId = req.userId;
        const period = req.query.period || 'week';

        let days = 7;
        if (period === 'month') days = 30;
        if (period === 'year') days = 365;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];

        const records = await Step.find({
            userId,
            date: { $gte: startDateStr }
        }).sort({ date: -1 });

        const totalSteps = records.reduce((sum, r) => sum + r.steps, 0);
        const totalDistance = records.reduce((sum, r) => sum + r.distance, 0);
        const totalCalories = records.reduce((sum, r) => sum + r.calories, 0);
        const averageSteps = records.length > 0 ? Math.round(totalSteps / records.length) : 0;

        const bestDay = records.reduce((best, current) => {
            return (best && best.steps > current.steps) ? best : current;
        }, null);

        // Calculate trend
        let trend = 'stable';
        if (records.length >= 7) {
            const recentAvg = records.slice(0, 3).reduce((sum, r) => sum + r.steps, 0) / 3;
            const olderAvg = records.slice(-3).reduce((sum, r) => sum + r.steps, 0) / 3;
            if (recentAvg > olderAvg * 1.1) trend = 'increasing';
            else if (recentAvg < olderAvg * 0.9) trend = 'decreasing';
        }

        res.json({
            success: true,
            data: {
                totalSteps,
                averageSteps,
                totalDistance,
                totalCalories,
                bestDay: bestDay ? {
                    date: bestDay.date,
                    steps: bestDay.steps
                } : null,
                trend
            }
        });
    } catch (error) {
        console.error('[Steps] Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get stats',
            error: error.message
        });
    }
};

/**
 * Update daily goal
 */
const updateGoal = async (req, res) => {
    try {
        const { goal } = req.body;
        const userId = req.userId;
        const today = new Date().toISOString().split('T')[0];

        // Update or create today's record with goal
        const stepRecord = await Step.findOneAndUpdate(
            { userId, date: today },
            {
                goal,
                $setOnInsert: {
                    steps: 0,
                    distance: 0,
                    calories: 0,
                    duration: 0
                }
            },
            { upsert: true, new: true }
        );

        // Check if goal already achieved
        if (stepRecord.steps >= goal) {
            stepRecord.goalAchieved = true;
            await stepRecord.save();
        }

        res.json({
            success: true,
            data: {
                goal,
                goalAchieved: stepRecord.goalAchieved
            }
        });
    } catch (error) {
        console.error('[Steps] Update goal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update goal',
            error: error.message
        });
    }
};

/**
 * Get daily goal
 */
const getGoal = async (req, res) => {
    try {
        const userId = req.userId;
        const today = new Date().toISOString().split('T')[0];

        const stepRecord = await Step.findOne({ userId, date: today });

        res.json({
            success: true,
            data: {
                goal: stepRecord?.goal || null
            }
        });
    } catch (error) {
        console.error('[Steps] Get goal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get goal',
            error: error.message
        });
    }
};

/**
 * Delete goal
 */
const deleteGoal = async (req, res) => {
    try {
        const userId = req.userId;
        const today = new Date().toISOString().split('T')[0];

        await Step.findOneAndUpdate(
            { userId, date: today },
            { goal: null, goalAchieved: false }
        );

        res.json({
            success: true,
            data: { deleted: true }
        });
    } catch (error) {
        console.error('[Steps] Delete goal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete goal',
            error: error.message
        });
    }
};

/**
 * Calculate streak
 */
const calculateStreak = async (userId) => {
    try {
        const records = await Step.find({ userId }).sort({ date: -1 }).limit(365);

        if (records.length === 0) {
            return { current: 0, longest: 0, lastDate: null };
        }

        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        const today = new Date().toISOString().split('T')[0];
        let expectedDate = new Date();

        for (const record of records) {
            const recordDate = new Date(record.date + 'T00:00:00'); // Add time to avoid timezone issues
            const expected = expectedDate.toISOString().split('T')[0];

            if (record.date === expected) {
                tempStreak++;
                if (record.date === today || tempStreak === 1) {
                    currentStreak = tempStreak;
                }
                expectedDate.setDate(expectedDate.getDate() - 1);
            } else {
                longestStreak = Math.max(longestStreak, tempStreak);
                tempStreak = 0;
                break;
            }
        }

        longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

        return {
            current: currentStreak,
            longest: longestStreak,
            lastDate: records[0].date
        };
    } catch (error) {
        console.error('[Steps] Calculate streak error:', error);
        return { current: 0, longest: 0, lastDate: null };
    }
};

/**
 * Get streak
 */
const getStreak = async (req, res) => {
    try {
        const userId = req.userId;
        const streak = await calculateStreak(userId);

        res.json({
            success: true,
            data: streak
        });
    } catch (error) {
        console.error('[Steps] Get streak error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get streak',
            error: error.message
        });
    }
};

/**
 * Send background notification with step count
 */
const sendStepNotification = async (req, res) => {
    try {
        const userId = req.userId;
        const today = new Date().toISOString().split('T')[0];

        const stepRecord = await Step.findOne({ userId, date: today });
        const steps = stepRecord?.steps || 0;
        const calories = stepRecord?.calories || 0;

        // Send notification
        await sendNotification(userId, {
            title: '🚶 Adım Sayacı',
            body: `${steps.toLocaleString()} adım • ${Math.round(calories)} kcal`,
            data: {
                type: 'step_update',
                steps,
                calories
            }
        });

        res.json({
            success: true,
            data: {
                notificationSent: true,
                steps,
                calories
            }
        });
    } catch (error) {
        console.error('[Steps] Send notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send notification',
            error: error.message
        });
    }
};

/**
 * PREMIUM: Get weekly comparison
 */
const getWeeklyComparison = async (req, res) => {
    try {
        const userId = req.userId;
        const comparison = await premiumAnalytics.getWeeklyComparison(userId);

        res.json({
            success: true,
            data: comparison
        });
    } catch (error) {
        console.error('[Steps] Weekly comparison error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get weekly comparison',
            error: error.message
        });
    }
};

/**
 * PREMIUM: Get personalized insights
 */
const getInsights = async (req, res) => {
    try {
        const userId = req.userId;
        const insights = await premiumAnalytics.getInsights(userId);

        res.json({
            success: true,
            data: insights
        });
    } catch (error) {
        console.error('[Steps] Insights error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get insights',
            error: error.message
        });
    }
};

/**
 * PREMIUM: Get next week prediction
 */
const getPrediction = async (req, res) => {
    try {
        const userId = req.userId;
        const prediction = await premiumAnalytics.predictNextWeek(userId);

        res.json({
            success: true,
            data: prediction
        });
    } catch (error) {
        console.error('[Steps] Prediction error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get prediction',
            error: error.message
        });
    }
};

/**
 * PREMIUM: Get health score
 */
const getHealthScore = async (req, res) => {
    try {
        const userId = req.userId;
        const healthScore = await premiumAnalytics.getHealthScore(userId);

        res.json({
            success: true,
            data: healthScore
        });
    } catch (error) {
        console.error('[Steps] Health score error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get health score',
            error: error.message
        });
    }
};

/**
 * Send background notification update
 */
const sendBackgroundNotification = async (req, res) => {
    try {
        const userId = req.userId;
        const { steps, calories, goal } = req.body;

        const result = await backgroundNotification.sendPersistentUpdate(
            userId,
            steps || 0,
            calories || 0,
            goal || null
        );

        res.json({
            success: true,
            data: {
                notificationSent: result.success
            }
        });
    } catch (error) {
        console.error('[Steps] Background notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send notification',
            error: error.message
        });
    }
};

/**
 * Get user achievements
 */
const getAchievements = async (req, res) => {
    try {
        const userId = req.userId;

        // Get all step records for achievement calculation
        const records = await Step.find({ userId }).sort({ date: -1 });

        const achievements = [];

        if (records.length > 0) {
            // Calculate totals
            const totalSteps = records.reduce((sum, r) => sum + r.steps, 0);
            const totalDistance = records.reduce((sum, r) => sum + r.distance, 0);
            const maxSteps = Math.max(...records.map(r => r.steps));

            // Step achievements
            if (totalSteps >= 1000) achievements.push('first_1000');
            if (totalSteps >= 5000) achievements.push('first_5000');
            if (totalSteps >= 10000) achievements.push('first_10000');
            if (maxSteps >= 10000) achievements.push('daily_10k');

            // Distance achievements
            if (totalDistance >= 1) achievements.push('first_km');
            if (totalDistance >= 5) achievements.push('first_5km');
            if (totalDistance >= 10) achievements.push('first_10km');

            // Streak achievements
            const streak = await calculateStreak(userId);
            if (streak.current >= 7) achievements.push('week_streak_7');
            if (streak.current >= 30) achievements.push('week_streak_30');
            if (streak.longest >= 7) achievements.push('longest_week_7');
        }

        res.json({
            success: true,
            data: achievements
        });
    } catch (error) {
        console.error('[Steps] Get achievements error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get achievements',
            error: error.message
        });
    }
};

/**
 * Start tracking notification
 */
const startTracking = async (req, res) => {
    try {
        const userId = req.userId;

        console.log('[Steps] 📤 Start tracking notification requested for user:', userId);

        // Send OneSignal notification
        const notificationChannels = [];

        try {
            const OneSignal = require('onesignal-node');
            const client = new OneSignal.Client(
                process.env.ONESIGNAL_APP_ID,
                process.env.ONESIGNAL_REST_API_KEY
            );

            const notification = {
                contents: {
                    en: '🚶 Adım sayacı başlatıldı! Hadi harekete geç!',
                    tr: '🚶 Adım sayacı başlatıldı! Hadi harekete geç!'
                },
                headings: {
                    en: 'Bavaxe Steps',
                    tr: 'Bavaxe Adım Sayacı'
                },
                include_external_user_ids: [userId.toString()],
                data: {
                    type: 'step_tracking_started',
                    timestamp: Date.now()
                },
                android_channel_id: process.env.ONESIGNAL_ANDROID_CHANNEL_ID || 'bavaxe-steps'
            };

            const response = await client.createNotification(notification);
            console.log('[Steps] ✅ OneSignal notification sent:', response.body);

            notificationChannels.push({
                channel: 'onesignal',
                success: true,
                response: response.body
            });
        } catch (onesignalError) {
            console.error('[Steps] ⚠️ OneSignal error:', onesignalError.message);
            notificationChannels.push({
                channel: 'onesignal',
                success: false,
                error: onesignalError.message
            });
        }

        const notificationSent = notificationChannels.some(c => c.success);

        res.json({
            success: true,
            data: {
                notificationSent,
                notificationChannels
            }
        });
    } catch (error) {
        console.error('[Steps] Start tracking error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start tracking',
            error: error.message
        });
    }
};

/**
 * Get leaderboard
 */
const getLeaderboard = async (req, res) => {
    try {
        const period = req.query.period || 'week'; // week, month, all-time
        const limit = parseInt(req.query.limit) || 10;

        let startDate;
        if (period === 'week') {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
        } else if (period === 'month') {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
        }

        const startDateStr = startDate ? startDate.toISOString().split('T')[0] : null;

        // Aggregate steps by user
        const pipeline = [
            ...(startDateStr ? [{ $match: { date: { $gte: startDateStr } } }] : []),
            {
                $group: {
                    _id: '$userId',
                    totalSteps: { $sum: '$steps' },
                    totalDistance: { $sum: '$distance' },
                    totalCalories: { $sum: '$calories' },
                    activeDays: { $sum: 1 }
                }
            },
            { $sort: { totalSteps: -1 } },
            { $limit: limit }
        ];

        const leaderboard = await Step.aggregate(pipeline);

        // Get user details (you might want to join with users collection)
        const enrichedLeaderboard = leaderboard.map((entry, index) => ({
            rank: index + 1,
            userId: entry._id,
            totalSteps: entry.totalSteps,
            totalDistance: Math.round(entry.totalDistance * 100) / 100,
            totalCalories: Math.round(entry.totalCalories),
            activeDays: entry.activeDays,
            averageSteps: Math.round(entry.totalSteps / entry.activeDays)
        }));

        res.json({
            success: true,
            data: {
                period,
                leaderboard: enrichedLeaderboard
            }
        });
    } catch (error) {
        console.error('[Steps] Get leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get leaderboard',
            error: error.message
        });
    }
};

module.exports = {
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
    getLeaderboard,
    // Premium features
    getWeeklyComparison,
    getInsights,
    getPrediction,
    getHealthScore,
    sendBackgroundNotification
};
