const ResponseFormatter = require('../core/utils/responseFormatter');

class ProfileStatsController {
    async getStats(req, res) {
        try {
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json(
                    ResponseFormatter.error('Kullanıcı kimliği bulunamadı', 'UNAUTHORIZED')
                );
            }

            const db = req.db;

            // Get location count
            let totalLocations = 0;
            try {
                const locationResult = await db.query(
                    'SELECT COUNT(*) as count FROM location_points WHERE user_id = $1',
                    [userId]
                );
                totalLocations = parseInt(locationResult.rows[0]?.count || 0);
            } catch (err) {
                console.log('[ProfileStats] Location count error:', err.message);
            }

            // Get steps count
            let totalSteps = 0;
            try {
                const stepsResult = await db.query(
                    'SELECT SUM(steps) as total FROM step_daily WHERE user_id = $1',
                    [userId]
                );
                totalSteps = parseInt(stepsResult.rows[0]?.total || 0);
            } catch (err) {
                console.log('[ProfileStats] Steps count error:', err.message);
            }

            // Get active days
            let activeDays = 0;
            try {
                const activeDaysResult = await db.query(
                    'SELECT COUNT(DISTINCT DATE(timestamp)) as days FROM location_points WHERE user_id = $1',
                    [userId]
                );
                activeDays = parseInt(activeDaysResult.rows[0]?.days || 0);
            } catch (err) {
                console.log('[ProfileStats] Active days error:', err.message);
            }

            // Get last active
            let lastActive = null;
            try {
                const lastActiveResult = await db.query(
                    'SELECT MAX(timestamp) as last_active FROM location_points WHERE user_id = $1',
                    [userId]
                );
                lastActive = lastActiveResult.rows[0]?.last_active || null;
            } catch (err) {
                console.log('[ProfileStats] Last active error:', err.message);
            }

            return res.json(
                ResponseFormatter.success({
                    totalLocations,
                    totalSteps,
                    activeDays,
                    lastActive
                }, 'İstatistikler başarıyla yüklendi')
            );
        } catch (error) {
            console.error('[ProfileStats] Error:', error);
            return res.status(500).json(
                ResponseFormatter.error('İstatistikler yüklenemedi', 'STATS_ERROR')
            );
        }
    }
}

module.exports = new ProfileStatsController();
