// Minimal Dashboard Controller to avoid 404s and provide sane defaults
const db = require('../config/database');

class DashboardController {
  async getDashboard(req, res) {
    try {
      const { userId } = req.params;
      // Compose basic stats; real impl can aggregate from db
      const groups = db.getUserGroups(userId || '') || [];
      const activeWorkers = groups.reduce((sum, g) => sum + (g.memberCount || 0), 0);
      const payload = {
        activeWorkers,
        totalGroups: groups.length,
        todayDistance: 0,
        activeAlerts: 0,
      };
      return res.json(payload);
    } catch (e) {
      console.error('getDashboard error:', e);
      return res.status(200).json({ activeWorkers: 0, totalGroups: 0, todayDistance: 0, activeAlerts: 0 });
    }
  }

  async getActivities(req, res) {
    try {
      const limit = Number(req.query.limit || 10);
      // Provide a small list of sample activities; replace with real data source
      const now = Date.now();
      const items = [
        { id: 'a1', type: 'location', message: 'Konum güncellendi', timestamp: now - 30_000 },
        { id: 'a2', type: 'join', message: 'Yeni üye gruba katıldı', timestamp: now - 120_000 },
      ].slice(0, limit);
      return res.json(items);
    } catch (e) {
      console.error('getActivities error:', e);
      return res.json([]);
    }
  }
}

module.exports = new DashboardController();


