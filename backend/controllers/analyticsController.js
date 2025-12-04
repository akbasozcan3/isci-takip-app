const analyticsService = require('../services/analyticsService');

class AnalyticsController {
  async getDailyStats(req, res) {
    try {
      const { deviceId } = req.params;
      const { date } = req.query;

      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const targetDate = date || new Date().toISOString().split('T')[0];
      const stats = analyticsService.getDailyStats(deviceId, targetDate);
      return res.json(stats);
    } catch (error) {
      console.error('Get daily stats error:', error);
      return res.status(500).json({ error: 'Failed to get daily stats' });
    }
  }

  async getWeeklyStats(req, res) {
    try {
      const { deviceId } = req.params;
      const { weekStart } = req.query;

      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const weekStartDate = weekStart || new Date().toISOString().split('T')[0];
      const stats = analyticsService.getWeeklyStats(deviceId, weekStartDate);
      return res.json(stats);
    } catch (error) {
      console.error('Get weekly stats error:', error);
      return res.status(500).json({ error: 'Failed to get weekly stats' });
    }
  }

  async getMonthlyStats(req, res) {
    try {
      const { deviceId } = req.params;
      const { year, month } = req.query;

      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const currentDate = new Date();
      const targetYear = year ? parseInt(year) : currentDate.getFullYear();
      const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;

      const stats = analyticsService.getMonthlyStats(deviceId, targetYear, targetMonth);
      return res.json(stats);
    } catch (error) {
      console.error('Get monthly stats error:', error);
      return res.status(500).json({ error: 'Failed to get monthly stats' });
    }
  }

  async getHeatmapData(req, res) {
    try {
      const { deviceId } = req.params;
      const { startDate, endDate } = req.query;

      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const end = endDate || new Date().toISOString();

      const heatmap = analyticsService.getHeatmapData(deviceId, start, end);
      return res.json(heatmap);
    } catch (error) {
      console.error('Get heatmap data error:', error);
      return res.status(500).json({ error: 'Failed to get heatmap data' });
    }
  }

  async getSpeedAnalysis(req, res) {
    try {
      const { deviceId } = req.params;
      const { timeWindow } = req.query;

      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const timeWindowMs = timeWindow ? parseInt(timeWindow) : 3600000;
      const analysis = analyticsService.getSpeedAnalysis(deviceId, timeWindowMs);
      return res.json(analysis);
    } catch (error) {
      console.error('Get speed analysis error:', error);
      return res.status(500).json({ error: 'Failed to get speed analysis' });
    }
  }
}

module.exports = new AnalyticsController();

