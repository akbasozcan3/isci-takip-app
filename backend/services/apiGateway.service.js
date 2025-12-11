const analyticsProcessingService = require('./analyticsProcessingService');
const locationProcessingService = require('./locationProcessingService');
const billingProcessingService = require('./billingProcessingService');
const notificationsProcessingService = require('./notificationsProcessingService');
const reportsService = require('./reportsService');

class ApiGatewayService {
  constructor() {
    this.services = {
      nodejs: {
        baseUrl: process.env.NODEJS_SERVICE_URL || 'http://localhost:4000',
        health: '/api/health',
        timeout: 5000
      }
    };
    this.circuitBreakers = {};
    this.initializeCircuitBreakers();
  }

  initializeCircuitBreakers() {
    Object.keys(this.services).forEach(serviceName => {
      this.circuitBreakers[serviceName] = {
        state: 'closed',
        failures: 0,
        lastFailure: null,
        successCount: 0,
        threshold: 5,
        timeout: 60000
      };
    });
  }

  async getAnalytics(userId, dateRange) {
    try {
      const analytics = await analyticsProcessingService.fetchAnalyticsData(userId, dateRange);
      return {
        user_id: userId,
        date_range: dateRange,
        summary: analytics.summary,
        trends: analytics.trends,
        predictions: analytics.predictions,
        insights: analytics.insights,
        anomalies: analytics.anomalies
      };
    } catch (error) {
      throw new Error(`Analytics processing failed: ${error.message}`);
    }
  }

  async processLocationBatch(locations) {
    try {
      return await locationProcessingService.processBatchLocations(locations);
    } catch (error) {
      throw new Error(`Location processing failed: ${error.message}`);
    }
  }

  async processNotifications(userId, notifications) {
    try {
      return await notificationsProcessingService.processNotifications(userId, notifications);
    } catch (error) {
      throw new Error(`Notifications processing failed: ${error.message}`);
    }
  }

  async getNotificationStats(userId) {
    try {
      return await notificationsProcessingService.getNotificationStats(userId);
    } catch (error) {
      throw new Error(`Notification stats failed: ${error.message}`);
    }
  }

  async processBilling(userId, plan, amount) {
    try {
      return await billingProcessingService.processBilling(userId, plan, amount);
    } catch (error) {
      throw new Error(`Billing processing failed: ${error.message}`);
    }
  }

  async getBillingHistory(userId) {
    try {
      return await billingProcessingService.getBillingHistory(userId);
    } catch (error) {
      throw new Error(`Billing history failed: ${error.message}`);
    }
  }

  async generateReport(userId, reportType, dateRange, format) {
    try {
      return await reportsService.generateReport(userId, reportType, dateRange, format);
    } catch (error) {
      throw new Error(`Report generation failed: ${error.message}`);
    }
  }

  async listReports(userId) {
    try {
      return await reportsService.listReports(userId);
    } catch (error) {
      throw new Error(`List reports failed: ${error.message}`);
    }
  }

  async getServiceStatus() {
    return {
      nodejs: {
        name: 'nodejs',
        healthy: true,
        circuitBreaker: 'closed',
        failures: 0,
        successCount: 0,
        baseUrl: this.services.nodejs.baseUrl
      },
      analytics: {
        name: 'analytics',
        healthy: true,
        service: 'internal-javascript'
      },
      location: {
        name: 'location',
        healthy: true,
        service: 'internal-javascript'
      },
      billing: {
        name: 'billing',
        healthy: true,
        service: 'internal-javascript'
      },
      notifications: {
        name: 'notifications',
        healthy: true,
        service: 'internal-javascript'
      },
      reports: {
        name: 'reports',
        healthy: true,
        service: 'internal-javascript'
      }
    };
  }
}

module.exports = new ApiGatewayService();
