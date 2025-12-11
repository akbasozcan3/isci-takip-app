const crypto = require('crypto');
const analyticsService = require('./analyticsService');
const analyticsProcessingService = require('./analyticsProcessingService');
const activityLogService = require('./activityLogService');

function generateUUID() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

class ReportsService {
  async generateReport(userId, reportType, dateRange = '7d', format = 'json') {
    if (!userId || !reportType) {
      throw new Error('user_id and report_type required');
    }

    try {
      const analytics = await analyticsProcessingService.fetchAnalyticsData(userId, dateRange);
      const predictions = await analyticsProcessingService.generatePredictions(userId, analytics);
      const insights = await analyticsProcessingService.generateInsights(userId, analytics);
      
      const report = {
        user_id: userId,
        report_type: reportType,
        generated_at: new Date().toISOString(),
        data: {
          summary: {
            total_records: analytics.summary?.total_locations || 0,
            date_range: dateRange,
            format: format
          },
          sections: [
            { name: 'Overview', count: Math.floor((analytics.summary?.total_locations || 0) * 0.3) },
            { name: 'Details', count: Math.floor((analytics.summary?.total_locations || 0) * 0.7) }
          ],
          analytics: analytics.summary,
          predictions,
          insights
        },
        download_url: `/api/reports/download/${generateUUID()}`
      };

      activityLogService.logActivity(userId, 'reports', 'generate_report', {
        reportType,
        dateRange,
        format
      });

      return report;
    } catch (error) {
      console.error('Generate report error:', error);
      throw error;
    }
  }

  async listReports(userId) {
    if (!userId) {
      throw new Error('user_id required');
    }

    try {
      const analytics = await analyticsProcessingService.fetchAnalyticsData(userId, '30d');
      
      const reports = {
        user_id: userId,
        available_reports: [
          {
            id: generateUUID(),
            type: 'daily',
            created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: generateUUID(),
            type: 'weekly',
            created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: generateUUID(),
            type: 'monthly',
            created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],
        analytics_summary: analytics.summary,
        timestamp: new Date().toISOString()
      };

      return reports;
    } catch (error) {
      console.error('List reports error:', error);
      return {
        user_id: userId,
        available_reports: [],
        timestamp: new Date().toISOString()
      };
    }
  }

  async downloadReport(reportId) {
    return {
      report_id: reportId,
      status: 'ready',
      download_url: `/api/reports/download/${reportId}/file`,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
  }
}

module.exports = new ReportsService();
