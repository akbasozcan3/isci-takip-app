/**
 * Advanced Analytics Service
 * Enterprise-level analytics and insights
 */

const { logger } = require('../utils/logger');
const databaseService = require('./database.service');

class AnalyticsService {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 300000; // 5 minutes
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagement(userId, timeRange = '7d') {
    const cacheKey = `engagement:${userId}:${timeRange}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const user = await databaseService.findUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const now = Date.now();
      const rangeMs = this.parseTimeRange(timeRange);
      const startTime = now - rangeMs;

      // Calculate engagement metrics
      const engagement = {
        activeDays: this.calculateActiveDays(userId, startTime),
        averageSessionDuration: this.calculateAverageSessionDuration(userId, startTime),
        locationUpdates: this.countLocationUpdates(userId, startTime),
        groupInteractions: this.countGroupInteractions(userId, startTime),
        featuresUsed: this.getFeaturesUsed(userId, startTime),
        engagementScore: 0,
      };

      // Calculate engagement score (0-100)
      engagement.engagementScore = this.calculateEngagementScore(engagement);

      this.cache.set(cacheKey, { data: engagement, timestamp: Date.now() });
      return engagement;
    } catch (error) {
      logger.error('Get user engagement error', error);
      throw error;
    }
  }

  /**
   * Get location insights
   */
  async getLocationInsights(userId, timeRange = '30d') {
    const cacheKey = `insights:${userId}:${timeRange}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const rangeMs = this.parseTimeRange(timeRange);
      const startTime = Date.now() - rangeMs;

      const insights = {
        totalDistance: this.calculateTotalDistance(userId, startTime),
        averageSpeed: this.calculateAverageSpeed(userId, startTime),
        mostVisitedLocations: this.getMostVisitedLocations(userId, startTime),
        timeDistribution: this.getTimeDistribution(userId, startTime),
        movementPatterns: this.analyzeMovementPatterns(userId, startTime),
      };

      this.cache.set(cacheKey, { data: insights, timestamp: Date.now() });
      return insights;
    } catch (error) {
      logger.error('Get location insights error', error);
      throw error;
    }
  }

  /**
   * Get group analytics
   */
  async getGroupAnalytics(groupId, timeRange = '7d') {
    const cacheKey = `group:${groupId}:${timeRange}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const rangeMs = this.parseTimeRange(timeRange);
      const startTime = Date.now() - rangeMs;

      const analytics = {
        memberActivity: this.getMemberActivity(groupId, startTime),
        averageDistance: this.calculateAverageGroupDistance(groupId, startTime),
        activeMembers: this.countActiveMembers(groupId, startTime),
        locationHeatmap: this.generateLocationHeatmap(groupId, startTime),
      };

      this.cache.set(cacheKey, { data: analytics, timestamp: Date.now() });
      return analytics;
    } catch (error) {
      logger.error('Get group analytics error', error);
      throw error;
    }
  }

  /**
   * Parse time range string to milliseconds
   */
  parseTimeRange(range) {
    const match = range.match(/(\d+)([dhms])/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * (multipliers[unit] || multipliers.d);
  }

  /**
   * Calculate active days
   */
  calculateActiveDays(userId, startTime) {
    // Implementation would query location data
    return 5; // Placeholder
  }

  /**
   * Calculate average session duration
   */
  calculateAverageSessionDuration(userId, startTime) {
    // Implementation would track session data
    return 1800000; // 30 minutes in ms (placeholder)
  }

  /**
   * Count location updates
   */
  countLocationUpdates(userId, startTime) {
    const db = require('../../config/database');
    const locations = db.getUserLocations(userId) || [];
    return locations.filter(loc => loc.timestamp >= startTime).length;
  }

  /**
   * Count group interactions
   */
  countGroupInteractions(userId, startTime) {
    // Implementation would query activity logs
    return 10; // Placeholder
  }

  /**
   * Get features used
   */
  getFeaturesUsed(userId, startTime) {
    // Implementation would query activity logs
    return ['location-tracking', 'groups', 'analytics']; // Placeholder
  }

  /**
   * Calculate engagement score
   */
  calculateEngagementScore(engagement) {
    let score = 0;
    
    // Active days (max 30 points)
    score += Math.min(engagement.activeDays * 3, 30);
    
    // Session duration (max 20 points)
    const sessionHours = engagement.averageSessionDuration / (60 * 60 * 1000);
    score += Math.min(sessionHours * 5, 20);
    
    // Location updates (max 25 points)
    score += Math.min(engagement.locationUpdates / 10, 25);
    
    // Group interactions (max 15 points)
    score += Math.min(engagement.groupInteractions * 1.5, 15);
    
    // Features used (max 10 points)
    score += Math.min(engagement.featuresUsed.length * 3, 10);
    
    return Math.min(Math.round(score), 100);
  }

  /**
   * Calculate total distance
   */
  calculateTotalDistance(userId, startTime) {
    const db = require('../../config/database');
    const locations = db.getUserLocations(userId) || [];
    const filtered = locations.filter(loc => loc.timestamp >= startTime);
    
    let totalDistance = 0;
    for (let i = 1; i < filtered.length; i++) {
      const prev = filtered[i - 1];
      const curr = filtered[i];
      totalDistance += this.calculateDistance(
        prev.coords.latitude,
        prev.coords.longitude,
        curr.coords.latitude,
        curr.coords.longitude
      );
    }
    
    return totalDistance; // in kilometers
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate average speed
   */
  calculateAverageSpeed(userId, startTime) {
    const db = require('../../config/database');
    const locations = db.getUserLocations(userId) || [];
    const filtered = locations.filter(loc => loc.timestamp >= startTime && loc.coords.speed);
    
    if (filtered.length === 0) return 0;
    
    const totalSpeed = filtered.reduce((sum, loc) => sum + (loc.coords.speed || 0), 0);
    return totalSpeed / filtered.length; // m/s
  }

  /**
   * Get most visited locations
   */
  getMostVisitedLocations(userId, startTime) {
    const db = require('../../config/database');
    const locations = db.getUserLocations(userId) || [];
    const filtered = locations.filter(loc => loc.timestamp >= startTime);
    
    // Group by rounded coordinates (within 100m)
    const locationGroups = new Map();
    filtered.forEach(loc => {
      const key = `${Math.round(loc.coords.latitude * 1000)}_${Math.round(loc.coords.longitude * 1000)}`;
      if (!locationGroups.has(key)) {
        locationGroups.set(key, {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          count: 0,
        });
      }
      locationGroups.get(key).count++;
    });
    
    return Array.from(locationGroups.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Get time distribution
   */
  getTimeDistribution(userId, startTime) {
    const db = require('../../config/database');
    const locations = db.getUserLocations(userId) || [];
    const filtered = locations.filter(loc => loc.timestamp >= startTime);
    
    const distribution = {
      morning: 0, // 6-12
      afternoon: 0, // 12-18
      evening: 0, // 18-24
      night: 0, // 0-6
    };
    
    filtered.forEach(loc => {
      const hour = new Date(loc.timestamp).getHours();
      if (hour >= 6 && hour < 12) distribution.morning++;
      else if (hour >= 12 && hour < 18) distribution.afternoon++;
      else if (hour >= 18 && hour < 24) distribution.evening++;
      else distribution.night++;
    });
    
    return distribution;
  }

  /**
   * Analyze movement patterns
   */
  analyzeMovementPatterns(userId, startTime) {
    // Placeholder - would analyze movement patterns
    return {
      stationary: 0.3,
      walking: 0.4,
      driving: 0.2,
      other: 0.1,
    };
  }

  /**
   * Get member activity
   */
  getMemberActivity(groupId, startTime) {
    const db = require('../../config/database');
    const members = db.getMembers(groupId) || [];
    
    return members.map(member => ({
      userId: member.userId,
      activeDays: this.calculateActiveDays(member.userId, startTime),
      locationUpdates: this.countLocationUpdates(member.userId, startTime),
    }));
  }

  /**
   * Calculate average group distance
   */
  calculateAverageGroupDistance(groupId, startTime) {
    // Placeholder
    return 5.2; // km
  }

  /**
   * Count active members
   */
  countActiveMembers(groupId, startTime) {
    const db = require('../../config/database');
    const members = db.getMembers(groupId) || [];
    return members.filter(m => this.calculateActiveDays(m.userId, startTime) > 0).length;
  }

  /**
   * Generate location heatmap
   */
  generateLocationHeatmap(groupId, startTime) {
    // Placeholder - would generate heatmap data
    return [];
  }
}

module.exports = new AnalyticsService();

