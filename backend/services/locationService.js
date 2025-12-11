const db = require('../config/database');
const activityLogService = require('./activityLogService');

class LocationService {
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
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

  calculateRouteDistance(locations) {
    if (!Array.isArray(locations) || locations.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < locations.length; i++) {
      const prev = locations[i - 1];
      const curr = locations[i];
      if (prev.coords && curr.coords) {
        total += this.haversineDistance(
          prev.coords.latitude,
          prev.coords.longitude,
          curr.coords.latitude,
          curr.coords.longitude
        );
      }
    }
    return total;
  }

  calculateAverageSpeed(locations, timeWindowMs = 60000) {
    if (!Array.isArray(locations) || locations.length < 2) return 0;
    const now = Date.now();
    const windowStart = now - timeWindowMs;
    const recent = locations.filter(loc => loc.timestamp >= windowStart);
    if (recent.length < 2) return 0;

    let totalDistance = 0;
    let totalTime = 0;

    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1];
      const curr = recent[i];
      if (prev.coords && curr.coords) {
        const dist = this.haversineDistance(
          prev.coords.latitude,
          prev.coords.longitude,
          curr.coords.latitude,
          curr.coords.longitude
        );
        const time = (curr.timestamp - prev.timestamp) / 1000;
        if (time > 0) {
          totalDistance += dist;
          totalTime += time;
        }
      }
    }

    if (totalTime === 0) return 0;
    return (totalDistance / totalTime) * 3.6;
  }

  detectStopped(locations, thresholdMeters = 50, timeWindowMs = 300000) {
    if (!Array.isArray(locations) || locations.length < 2) return false;
    const now = Date.now();
    const windowStart = now - timeWindowMs;
    const recent = locations.filter(loc => loc.timestamp >= windowStart);
    if (recent.length < 2) return false;

    const first = recent[0];
    const last = recent[recent.length - 1];
    const distance = this.haversineDistance(
      first.coords.latitude,
      first.coords.longitude,
      last.coords.latitude,
      last.coords.longitude
    );

    return distance < thresholdMeters;
  }

  checkGeofence(lat, lng, centerLat, centerLng, radiusMeters) {
    const distance = this.haversineDistance(lat, lng, centerLat, centerLng);
    return distance <= radiusMeters;
  }

  getLocationStats(deviceId) {
    const locations = db.getStore(deviceId);
    if (!Array.isArray(locations) || locations.length === 0) {
      return {
        totalLocations: 0,
        totalDistance: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        isMoving: false,
        firstLocation: null,
        lastLocation: null,
        timeSpan: 0
      };
    }

    const totalDistance = this.calculateRouteDistance(locations);
    const averageSpeed = this.calculateAverageSpeed(locations);
    const maxSpeed = this.getMaxSpeed(locations);
    const isMoving = !this.detectStopped(locations);
    const firstLocation = locations[0];
    const lastLocation = locations[locations.length - 1];
    const timeSpan = lastLocation.timestamp - firstLocation.timestamp;

    return {
      totalLocations: locations.length,
      totalDistance,
      averageSpeed,
      maxSpeed,
      isMoving,
      firstLocation,
      lastLocation,
      timeSpan
    };
  }

  getMaxSpeed(locations) {
    if (!Array.isArray(locations) || locations.length < 2) return 0;
    let maxSpeed = 0;

    for (let i = 1; i < locations.length; i++) {
      const prev = locations[i - 1];
      const curr = locations[i];
      if (prev.coords && curr.coords && prev.timestamp && curr.timestamp) {
        const dist = this.haversineDistance(
          prev.coords.latitude,
          prev.coords.longitude,
          curr.coords.latitude,
          curr.coords.longitude
        );
        const time = (curr.timestamp - prev.timestamp) / 1000;
        if (time > 0) {
          const speed = (dist / time) * 3.6;
          if (speed > maxSpeed) maxSpeed = speed;
        }
      }
    }

    return maxSpeed;
  }

  filterValidLocations(locations) {
    return locations.filter(loc => {
      if (!loc || !loc.coords) return false;
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      return Number.isFinite(lat) && Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    });
  }

  optimizeRoute(locations, minDistanceMeters = 5) {
    if (!Array.isArray(locations) || locations.length < 2) return locations;
    const filtered = this.filterValidLocations(locations);
    if (filtered.length < 2) return filtered;

    const optimized = [filtered[0]];
    for (let i = 1; i < filtered.length; i++) {
      const prev = optimized[optimized.length - 1];
      const curr = filtered[i];
      const dist = this.haversineDistance(
        prev.coords.latitude,
        prev.coords.longitude,
        curr.coords.latitude,
        curr.coords.longitude
      );
      if (dist >= minDistanceMeters) {
        optimized.push(curr);
      }
    }

    return optimized;
  }
}

module.exports = new LocationService();

