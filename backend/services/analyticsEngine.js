class AnalyticsEngine {
  constructor() {
    this.aggregations = new Map();
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  calculateSpeed(lat1, lon1, time1, lat2, lon2, time2) {
    const distance = this.calculateDistance(lat1, lon1, lat2, lon2);
    const timeDiff = (time2 - time1) / 1000;
    if (timeDiff === 0) return 0;
    return (distance / timeDiff) * 3.6;
  }

  aggregateLocationData(deviceId, locations) {
    if (!locations || locations.length === 0) return null;

    let totalDistance = 0;
    let maxSpeed = 0;
    let totalTime = 0;
    let activeTime = 0;
    const speeds = [];

    for (let i = 1; i < locations.length; i++) {
      const prev = locations[i - 1];
      const curr = locations[i];

      if (!prev.coords || !curr.coords) continue;

      const distance = this.calculateDistance(
        prev.coords.latitude,
        prev.coords.longitude,
        curr.coords.latitude,
        curr.coords.longitude
      );

      totalDistance += distance;

      const timeDiff = curr.timestamp - prev.timestamp;
      totalTime += timeDiff;

      if (distance > 10) {
        activeTime += timeDiff;
        const speed = this.calculateSpeed(
          prev.coords.latitude,
          prev.coords.longitude,
          prev.timestamp,
          curr.coords.latitude,
          curr.coords.longitude,
          curr.timestamp
        );
        speeds.push(speed);
        maxSpeed = Math.max(maxSpeed, speed);
      }
    }

    const avgSpeed = speeds.length > 0
      ? speeds.reduce((a, b) => a + b, 0) / speeds.length
      : 0;

    return {
      deviceId,
      totalDistance: Math.round(totalDistance),
      totalDistanceKm: Math.round(totalDistance / 1000 * 100) / 100,
      maxSpeed: Math.round(maxSpeed * 100) / 100,
      avgSpeed: Math.round(avgSpeed * 100) / 100,
      totalTime,
      activeTime,
      locationCount: locations.length,
      timestamp: Date.now()
    };
  }

  generateHeatmapData(locations, gridSize = 0.01) {
    const grid = new Map();

    for (const loc of locations) {
      if (!loc.coords) continue;

      const lat = Math.floor(loc.coords.latitude / gridSize) * gridSize;
      const lng = Math.floor(loc.coords.longitude / gridSize) * gridSize;
      const key = `${lat},${lng}`;

      grid.set(key, (grid.get(key) || 0) + 1);
    }

    const heatmap = [];
    for (const [key, intensity] of grid.entries()) {
      const [lat, lng] = key.split(',').map(Number);
      heatmap.push({ lat, lng, intensity });
    }

    return heatmap.sort((a, b) => b.intensity - a.intensity);
  }

  calculateRouteEfficiency(route) {
    if (!route || route.length < 2) return null;

    let totalDistance = 0;
    let straightLineDistance = 0;

    for (let i = 1; i < route.length; i++) {
      const prev = route[i - 1];
      const curr = route[i];
      totalDistance += this.calculateDistance(
        prev.lat,
        prev.lng,
        curr.lat,
        curr.lng
      );
    }

    if (route.length > 1) {
      straightLineDistance = this.calculateDistance(
        route[0].lat,
        route[0].lng,
        route[route.length - 1].lat,
        route[route.length - 1].lng
      );
    }

    const efficiency = straightLineDistance > 0
      ? (straightLineDistance / totalDistance) * 100
      : 100;

    return {
      totalDistance: Math.round(totalDistance),
      straightLineDistance: Math.round(straightLineDistance),
      efficiency: Math.round(efficiency * 100) / 100,
      waypoints: route.length
    };
  }
}

module.exports = new AnalyticsEngine();

