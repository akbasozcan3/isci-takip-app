const apiGatewayService = require('../services/apiGateway.service');

class MicroservicesController {
  async getServiceStatus(req, res) {
    try {
      const status = await apiGatewayService.getServiceStatus();
      res.json({
        success: true,
        services: status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getAnalytics(req, res) {
    try {
      const { userId } = req.params;
      const dateRange = req.query.date_range || req.headers['x-date-range'] || '7d';
      
      const analytics = await apiGatewayService.getAnalytics(userId, dateRange);
      
      res.json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async generateReport(req, res) {
    try {
      const { userId } = req.params;
      const { reportType } = req.body;
      
      const report = await apiGatewayService.getReports(userId, reportType);
      
      res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async processLocationBatch(req, res) {
    try {
      const { locations } = req.body;
      
      if (!Array.isArray(locations) || locations.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Locations array required'
        });
      }
      
      const result = await apiGatewayService.processLocationBatch(locations);
      
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async processNotifications(req, res) {
    try {
      const { user_id, notifications } = req.body;
      
      if (!user_id || !Array.isArray(notifications)) {
        return res.status(400).json({
          success: false,
          error: 'user_id and notifications array required'
        });
      }
      
      const result = await apiGatewayService.processNotifications(user_id, notifications);
      
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getNotificationStats(req, res) {
    try {
      const { userId } = req.params;
      
      const stats = await apiGatewayService.getNotificationStats(userId);
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async processBilling(req, res) {
    try {
      const { user_id, plan, amount } = req.body;
      
      if (!user_id || !plan || amount === undefined) {
        return res.status(400).json({
          success: false,
          error: 'user_id, plan, and amount required'
        });
      }
      
      const result = await apiGatewayService.processBilling(user_id, plan, amount);
      
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getBillingHistory(req, res) {
    try {
      const { userId } = req.params;
      
      const history = await apiGatewayService.getBillingHistory(userId);
      
      res.json({
        success: true,
        data: history,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async generateReportNew(req, res) {
    try {
      const { user_id, report_type, date_range, format } = req.body;
      
      if (!user_id || !report_type) {
        return res.status(400).json({
          success: false,
          error: 'user_id and report_type required'
        });
      }
      
      const report = await apiGatewayService.generateReport(user_id, report_type, date_range, format);
      
      res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async listReports(req, res) {
    try {
      const { userId } = req.params;
      
      const reports = await apiGatewayService.listReports(userId);
      
      res.json({
        success: true,
        data: reports,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new MicroservicesController();
