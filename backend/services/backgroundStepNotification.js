/**
 * Background Step Notification Service
 * Handles persistent notifications for step tracking
 */

const notificationService = require('./notificationService');

class BackgroundStepNotificationService {
    /**
     * Send persistent steps notification
     * This notification stays visible even when app is closed
     */
    async sendPersistentUpdate(userId, steps, calories, goal = null) {
        try {
            const title = '🚶 Adım Sayacı Aktif';
            const message = `${steps.toLocaleString()} adım • ${Math.round(calories)} kcal${goal ? ` • Hedef: ${goal.toLocaleString()}` : ''}`;

            const result = await notificationService.send(
                userId,
                {
                    title,
                    message,
                    type: 'ongoing',
                    data: {
                        type: 'step_tracking_active',
                        steps,
                        calories,
                        goal,
                        persistent: true
                    },
                    priority: 'low', // Low priority for persistent notifications
                    category: 'progress'
                },
                ['database', 'onesignal']
            );

            console.log('[BackgroundStepNotification] Persistent notification sent:', {
                userId,
                steps,
                calories,
                result: result.success
            });

            return result;
        } catch (error) {
            console.error('[BackgroundStepNotification] Error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update persistent notification
     * Call this periodically to update the notification with current stats
     */
    async updatePersistentNotification(userId, steps, calories, goal = null) {
        return this.sendPersistentUpdate(userId, steps, calories, goal);
    }

    /**
     * Clear persistent notification
     * Call when user stops tracking
     */
    async clearPersistentNotification(userId) {
        try {
            // Send final summary notification
            const result = await notificationService.send(
                userId,
                {
                    title: '✅ Takip Durduruldu',
                    message: 'Adım takibi sonlandırıldı. İyi iş çıkardınız!',
                    type: 'success',
                    data: {
                        type: 'step_tracking_stopped'
                    }
                },
                ['database', 'onesignal']
            );

            return result;
        } catch (error) {
            console.error('[BackgroundStepNotification] Clear error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send goal achievement notification
     */
    async sendGoalAchievement(userId, steps, goal) {
        try {
            const result = await notificationService.send(
                userId,
                {
                    title: '🎉 Hedefe Ulaştınız!',
                    message: `Tebrikler! ${goal.toLocaleString()} adım hedefinizi tamamladınız!`,
                    type: 'success',
                    data: {
                        type: 'step_goal_achieved',
                        steps,
                        goal
                    },
                    priority: 'high'
                },
                ['database', 'onesignal']
            );

            return result;
        } catch (error) {
            console.error('[BackgroundStepNotification] Goal achievement error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send milestone notification
     */
    async sendMilestone(userId, steps, milestone) {
        try {
            const result = await notificationService.send(
                userId,
                {
                    title: `🏆 ${milestone.toLocaleString()} Adım!`,
                    message: `Harika! ${milestone.toLocaleString()} adım milestone'ına ulaştınız!`,
                    type: 'success',
                    data: {
                        type: 'step_milestone',
                        steps,
                        milestone
                    }
                },
                ['database', 'onesignal']
            );

            return result;
        } catch (error) {
            console.error('[BackgroundStepNotification] Milestone error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send daily summary
     */
    async sendDailySummary(userId, steps, calories, distance, goal) {
        try {
            const goalText = goal ? `Hedef: %${Math.round((steps / goal) * 100)}` : '';

            const result = await notificationService.send(
                userId,
                {
                    title: '📊 Günlük Özet',
                    message: `${steps.toLocaleString()} adım • ${Math.round(calories)} kcal • ${distance.toFixed(2)} km ${goalText}`,
                    type: 'info',
                    data: {
                        type: 'daily_summary',
                        steps,
                        calories,
                        distance,
                        goal
                    }
                },
                ['database', 'onesignal']
            );

            return result;
        } catch (error) {
            console.error('[BackgroundStepNotification] Daily summary error:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new BackgroundStepNotificationService();
