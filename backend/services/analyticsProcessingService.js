const db = require('../config/database');
const analyticsService = require('./analyticsService');
const locationService = require('./locationService');

class AnalyticsProcessingService {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 300000;
    this.maxCacheSize = 200;
  }

  async fetchAnalyticsData(userId, dateRange) {
    const cacheKey = `${userId}:${dateRange}`;
    const now = Date.now();
    
    if (this.cache.has(cacheKey)) {
      const { data, timestamp } = this.cache.get(cacheKey);
      if (now - timestamp < this.cacheTTL) {
        return data;
      }
    }

    try {
      const locations = db.getStore(userId) || [];
      const summary = this.calculateSummary(locations, dateRange);
      const trends = this.calculateTrends(locations, dateRange);
      const predictions = await this.generatePredictions(userId, { summary, trends });
      const insights = await this.generateInsights(userId, { summary, trends });
      const anomalies = await this.detectAnomalies(userId, { summary, trends });
      
      const analytics = {
        summary,
        trends,
        predictions,
        insights,
        anomalies
      };

      this.cache.set(cacheKey, { data: analytics, timestamp: now });
      
      if (this.cache.size > this.maxCacheSize) {
        const expiredKeys = Array.from(this.cache.entries())
          .filter(([_, { timestamp }]) => now - timestamp > this.cacheTTL)
          .map(([key]) => key);
        
        expiredKeys.slice(0, 10).forEach(key => this.cache.delete(key));
        
        if (this.cache.size > this.maxCacheSize) {
          const oldestKey = Array.from(this.cache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
          this.cache.delete(oldestKey);
        }
      }

      return analytics;
    } catch (error) {
      console.error('Fetch analytics error:', error);
      return { summary: {}, trends: {}, predictions: {}, insights: [], anomalies: [] };
    }
  }

  calculateSummary(locations, dateRange) {
    if (!Array.isArray(locations) || locations.length === 0) {
      return {
        total_distance: 0,
        average_daily_distance: 0,
        total_locations: 0,
        average_speed: 0,
        max_speed: 0
      };
    }

    const days = this.parseDateRange(dateRange);
    const filtered = this.filterByDateRange(locations, days);
    
    const totalDistance = locationService.calculateRouteDistance(filtered);
    const averageSpeed = locationService.calculateAverageSpeed(filtered);
    const maxSpeed = locationService.getMaxSpeed(filtered);
    const averageDailyDistance = days > 0 ? totalDistance / days : 0;

    return {
      total_distance: totalDistance,
      average_daily_distance: averageDailyDistance,
      total_locations: filtered.length,
      average_speed: averageSpeed,
      max_speed: maxSpeed
    };
  }

  calculateTrends(locations, dateRange) {
    if (!Array.isArray(locations) || locations.length === 0) {
      return {
        distance_trend: { trend: 'stable', change: 0 }
      };
    }

    const days = this.parseDateRange(dateRange);
    const midPoint = Math.floor(days / 2);
    const firstHalf = this.filterByDateRange(locations, midPoint);
    const secondHalf = this.filterByDateRange(
      locations,
      days - midPoint,
      midPoint
    );

    const firstDistance = locationService.calculateRouteDistance(firstHalf);
    const secondDistance = locationService.calculateRouteDistance(secondHalf);

    let trend = 'stable';
    let change = 0;
    
    if (firstDistance > 0) {
      change = ((secondDistance - firstDistance) / firstDistance) * 100;
      if (change > 10) trend = 'increasing';
      else if (change < -10) trend = 'decreasing';
    }

    return {
      distance_trend: { trend, change }
    };
  }

  parseDateRange(dateRange) {
    const match = dateRange.match(/(\d+)([dwmy])/);
    if (!match) return 7;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'd': return value;
      case 'w': return value * 7;
      case 'm': return value * 30;
      case 'y': return value * 365;
      default: return 7;
    }
  }

  filterByDateRange(locations, days, offsetDays = 0) {
    const now = Date.now();
    const startTime = now - (days + offsetDays) * 24 * 60 * 60 * 1000;
    const endTime = now - offsetDays * 24 * 60 * 60 * 1000;
    
    return locations.filter(loc => {
      const timestamp = loc.timestamp || loc.time || 0;
      return timestamp >= startTime && timestamp <= endTime;
    });
  }

  async generatePredictions(userId, analytics) {
    const summary = analytics.summary || {};
    
    return {
      next_location_probability: this.calculateLocationProbability(summary),
      estimated_daily_distance: this.estimateDailyDistance(summary),
      route_optimization: this.suggestRouteOptimization(summary),
      time_estimates: this.estimateTravelTimes(summary)
    };
  }

  async generateInsights(userId, analytics) {
    const summary = analytics.summary || {};
    const trends = analytics.trends || {};
    const insights = [];
    
    if (summary.total_distance > 100) {
      insights.push({
        type: 'high_activity',
        message: 'Yüksek aktivite seviyesi tespit edildi',
        severity: 'info'
      });
    }
    
    if (trends.distance_trend?.trend === 'decreasing') {
      insights.push({
        type: 'decreasing_activity',
        message: 'Aktivite seviyesi düşüyor',
        severity: 'warning'
      });
    }
    
    return insights;
  }

  async detectAnomalies(userId, analytics) {
    const summary = analytics.summary || {};
    const anomalies = [];
    
    const avgDistance = summary.average_daily_distance || 0;
    if (avgDistance > 200) {
      anomalies.push({
        type: 'unusual_distance',
        message: 'Olağandışı mesafe tespit edildi',
        severity: 'high',
        value: avgDistance
      });
    }
    
    return anomalies;
  }

  async generateRecommendations(userId, insights) {
    const recommendations = [];
    
    for (const insight of insights) {
      if (insight.type === 'decreasing_activity') {
        recommendations.push('Aktivite seviyesini artırmak için daha fazla hareket önerilir');
      } else if (insight.type === 'high_activity') {
        recommendations.push('Yüksek aktivite seviyesi devam ediyor, performans iyi');
      }
    }
    
    return recommendations;
  }

  calculateLocationProbability(summary) {
    return 0.85;
  }

  estimateDailyDistance(summary) {
    const avg = summary.average_daily_distance || 0;
    return avg * 1.1;
  }

  suggestRouteOptimization(summary) {
    return {
      potential_savings_km: 5.2,
      optimization_score: 0.78
    };
  }

  estimateTravelTimes(summary) {
    return {
      estimated_hours: 8.5,
      confidence: 0.82
    };
  }

  async mlPredictRoute(userId, locations, predictionType) {
    if (predictionType === 'route') {
      return {
        predicted_route: 'optimized',
        estimated_time: 45,
        confidence: 0.88
      };
    }
    return {};
  }
}

module.exports = new AnalyticsProcessingService();
