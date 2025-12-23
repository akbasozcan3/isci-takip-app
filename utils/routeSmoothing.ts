/**
 * Route Smoothing with Kalman Filter
 * World-class GPS tracking - Reduce GPS noise and improve accuracy
 */

import { RoutePoint } from './routeRecorder';

/**
 * Kalman Filter for GPS smoothing
 */
class KalmanFilter {
  private Q: number; // Process noise
  private R: number; // Measurement noise
  private P: number; // Estimation error
  private X: number; // State estimate
  private K: number; // Kalman gain

  constructor(processNoise: number = 0.01, measurementNoise: number = 0.25) {
    this.Q = processNoise;
    this.R = measurementNoise;
    this.P = 1.0;
    this.X = 0;
    this.K = 0;
  }

  /**
   * Update filter with new measurement
   */
  update(measurement: number): number {
    // Prediction
    this.P = this.P + this.Q;

    // Update
    this.K = this.P / (this.P + this.R);
    this.X = this.X + this.K * (measurement - this.X);
    this.P = (1 - this.K) * this.P;

    return this.X;
  }

  /**
   * Reset filter
   */
  reset(): void {
    this.P = 1.0;
    this.X = 0;
    this.K = 0;
  }
}

/**
 * Smooth route using Kalman filter
 */
export function smoothRoute(points: RoutePoint[]): RoutePoint[] {
  if (points.length < 3) {
    return points;
  }

  const latFilter = new KalmanFilter(0.01, 0.25);
  const lonFilter = new KalmanFilter(0.01, 0.25);

  return points.map((point, index) => {
    // First and last points remain unchanged
    if (index === 0 || index === points.length - 1) {
      return point;
    }

    // Apply Kalman filter
    const smoothedLat = latFilter.update(point.latitude);
    const smoothedLon = lonFilter.update(point.longitude);

    return {
      ...point,
      latitude: smoothedLat,
      longitude: smoothedLon,
    };
  });
}

/**
 * Simplify route using Douglas-Peucker algorithm
 */
export function simplifyRoute(points: RoutePoint[], epsilon: number = 0.0001): RoutePoint[] {
  if (points.length < 3) {
    return points;
  }

  // Find the point with maximum distance
  let maxDistance = 0;
  let maxIndex = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const distance = perpendicularDistance(
      points[i],
      points[0],
      points[end]
    );

    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    // Recursive call
    const left = simplifyRoute(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyRoute(points.slice(maxIndex), epsilon);

    // Combine results (remove duplicate point)
    return [...left.slice(0, -1), ...right];
  } else {
    // Return endpoints only
    return [points[0], points[end]];
  }
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(
  point: RoutePoint,
  lineStart: RoutePoint,
  lineEnd: RoutePoint
): number {
  const dx = lineEnd.longitude - lineStart.longitude;
  const dy = lineEnd.latitude - lineStart.latitude;

  if (dx === 0 && dy === 0) {
    // Line is a point
    return Math.sqrt(
      Math.pow(point.longitude - lineStart.longitude, 2) +
        Math.pow(point.latitude - lineStart.latitude, 2)
    );
  }

  const t =
    ((point.longitude - lineStart.longitude) * dx +
      (point.latitude - lineStart.latitude) * dy) /
    (dx * dx + dy * dy);

  const closestPoint = {
    longitude: lineStart.longitude + t * dx,
    latitude: lineStart.latitude + t * dy,
  };

  return Math.sqrt(
    Math.pow(point.longitude - closestPoint.longitude, 2) +
      Math.pow(point.latitude - closestPoint.latitude, 2)
  );
}

/**
 * Remove duplicate points (same location within threshold)
 */
export function removeDuplicates(points: RoutePoint[], threshold: number = 5): RoutePoint[] {
  if (points.length < 2) {
    return points;
  }

  const filtered: RoutePoint[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = filtered[filtered.length - 1];
    const curr = points[i];

    const distance = haversineDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );

    if (distance >= threshold) {
      filtered.push(curr);
    }
  }

  return filtered;
}

/**
 * Haversine distance calculation
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Complete route processing pipeline
 */
export function processRoute(points: RoutePoint[]): RoutePoint[] {
  // 1. Remove duplicates
  let processed = removeDuplicates(points, 5);

  // 2. Apply Kalman filter for smoothing
  processed = smoothRoute(processed);

  // 3. Simplify using Douglas-Peucker
  processed = simplifyRoute(processed, 0.0001);

  return processed;
}

