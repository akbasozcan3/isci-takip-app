/**
 * Advanced Activity Detection System
 * World-class GPS tracking - ML-based activity recognition
 * Detects: walking, running, cycling, driving, stationary
 */

import * as Location from 'expo-location';
import * as Accelerometer from 'expo-sensors/build/Accelerometer';

export interface ActivityData {
  type: 'stationary' | 'walking' | 'running' | 'cycling' | 'driving' | 'unknown';
  confidence: number; // 0-100
  speed: number; // km/h
  icon: string;
  name: string;
  color: string;
  metadata?: {
    stepsPerMinute?: number;
    cadence?: number;
    acceleration?: number;
    heading?: number;
  };
}

export interface LocationPoint {
  timestamp: number;
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    heading?: number;
    speed?: number;
    altitude?: number;
  };
}

export interface AccelerometerData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

class ActivityDetector {
  private locationHistory: LocationPoint[] = [];
  private accelerometerHistory: AccelerometerData[] = [];
  private readonly MAX_HISTORY = 50;
  private readonly MIN_POINTS_FOR_DETECTION = 5;

  /**
   * Detect activity type from location and accelerometer data
   */
  detectActivity(
    currentLocation: LocationPoint,
    accelerometerData?: AccelerometerData
  ): ActivityData {
    // Add to history
    this.locationHistory.push(currentLocation);
    if (this.locationHistory.length > this.MAX_HISTORY) {
      this.locationHistory.shift();
    }

    if (accelerometerData) {
      this.accelerometerHistory.push(accelerometerData);
      if (this.accelerometerHistory.length > this.MAX_HISTORY) {
        this.accelerometerHistory.shift();
      }
    }

    // Need minimum points for accurate detection
    if (this.locationHistory.length < this.MIN_POINTS_FOR_DETECTION) {
      return this.getDefaultActivity(currentLocation);
    }

    // Calculate speed from location history
    const speed = this.calculateSpeed();
    const speedKmh = speed * 3.6;

    // Calculate acceleration pattern
    const accelerationPattern = this.calculateAccelerationPattern();

    // Calculate step pattern (if accelerometer available)
    const stepPattern = accelerometerData
      ? this.calculateStepPattern()
      : null;

    // ML-based detection using multiple features
    return this.classifyActivity(speedKmh, accelerationPattern, stepPattern, currentLocation);
  }

  /**
   * Calculate average speed from location history
   */
  private calculateSpeed(): number {
    if (this.locationHistory.length < 2) return 0;

    const recent = this.locationHistory.slice(-10); // Last 10 points
    let totalDistance = 0;
    let totalTime = 0;

    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1];
      const curr = recent[i];

      const distance = this.haversineDistance(
        prev.coords.latitude,
        prev.coords.longitude,
        curr.coords.latitude,
        curr.coords.longitude
      );

      const time = (curr.timestamp - prev.timestamp) / 1000; // seconds

      if (time > 0 && distance > 0) {
        totalDistance += distance;
        totalTime += time;
      }
    }

    return totalTime > 0 ? totalDistance / totalTime : 0; // m/s
  }

  /**
   * Calculate acceleration pattern for activity detection
   */
  private calculateAccelerationPattern(): {
    avgAcceleration: number;
    variance: number;
    maxAcceleration: number;
  } {
    if (this.locationHistory.length < 3) {
      return { avgAcceleration: 0, variance: 0, maxAcceleration: 0 };
    }

    const speeds: number[] = [];
    const recent = this.locationHistory.slice(-10);

    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1];
      const curr = recent[i];
      const time = (curr.timestamp - prev.timestamp) / 1000;

      if (time > 0) {
        const distance = this.haversineDistance(
          prev.coords.latitude,
          prev.coords.longitude,
          curr.coords.latitude,
          curr.coords.longitude
        );
        const speed = distance / time; // m/s
        speeds.push(speed);
      }
    }

    if (speeds.length < 2) {
      return { avgAcceleration: 0, variance: 0, maxAcceleration: 0 };
    }

    const accelerations: number[] = [];
    for (let i = 1; i < speeds.length; i++) {
      const time = (recent[i].timestamp - recent[i - 1].timestamp) / 1000;
      if (time > 0) {
        const accel = Math.abs((speeds[i] - speeds[i - 1]) / time);
        accelerations.push(accel);
      }
    }

    const avgAccel = accelerations.reduce((a, b) => a + b, 0) / accelerations.length;
    const variance =
      accelerations.reduce((sum, val) => sum + Math.pow(val - avgAccel, 2), 0) /
      accelerations.length;
    const maxAccel = Math.max(...accelerations);

    return {
      avgAcceleration: avgAccel,
      variance,
      maxAcceleration: maxAccel,
    };
  }

  /**
   * Calculate step pattern from accelerometer data
   */
  private calculateStepPattern(): {
    stepsPerMinute: number;
    cadence: number;
    regularity: number;
  } | null {
    if (this.accelerometerHistory.length < 10) return null;

    const recent = this.accelerometerHistory.slice(-30);
    const magnitudes: number[] = [];

    for (const acc of recent) {
      const magnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
      magnitudes.push(magnitude);
    }

    // Detect peaks (steps)
    let peaks = 0;
    const threshold = 1.2; // Adjust based on device
    for (let i = 1; i < magnitudes.length - 1; i++) {
      if (
        magnitudes[i] > magnitudes[i - 1] &&
        magnitudes[i] > magnitudes[i + 1] &&
        magnitudes[i] > threshold
      ) {
        peaks++;
      }
    }

    const timeSpan = (recent[recent.length - 1].timestamp - recent[0].timestamp) / 1000; // seconds
    const stepsPerMinute = timeSpan > 0 ? (peaks / timeSpan) * 60 : 0;

    // Calculate cadence (steps per minute for walking/running)
    const cadence = stepsPerMinute;

    // Calculate regularity (variance of step intervals)
    const intervals: number[] = [];
    let lastPeak = 0;
    for (let i = 1; i < magnitudes.length - 1; i++) {
      if (
        magnitudes[i] > magnitudes[i - 1] &&
        magnitudes[i] > magnitudes[i + 1] &&
        magnitudes[i] > threshold
      ) {
        if (lastPeak > 0) {
          intervals.push(i - lastPeak);
        }
        lastPeak = i;
      }
    }

    const avgInterval =
      intervals.length > 0
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : 0;
    const variance =
      intervals.length > 0
        ? intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) /
          intervals.length
        : 0;
    const regularity = avgInterval > 0 ? 1 - Math.min(variance / avgInterval, 1) : 0;

    return {
      stepsPerMinute,
      cadence,
      regularity,
    };
  }

  /**
   * Classify activity using ML-like features
   */
  private classifyActivity(
    speedKmh: number,
    accelerationPattern: { avgAcceleration: number; variance: number; maxAcceleration: number },
    stepPattern: { stepsPerMinute: number; cadence: number; regularity: number } | null,
    currentLocation: LocationPoint
  ): ActivityData {
    const { avgAcceleration, variance, maxAcceleration } = accelerationPattern;

    // Stationary detection
    if (speedKmh < 1 && avgAcceleration < 0.5) {
      return {
        type: 'stationary',
        confidence: 95,
        speed: speedKmh,
        icon: '📍',
        name: 'Duruyor',
        color: '#64748b',
      };
    }

    // Walking detection
    if (speedKmh >= 1 && speedKmh < 7) {
      if (stepPattern && stepPattern.stepsPerMinute > 80 && stepPattern.stepsPerMinute < 140) {
        return {
          type: 'walking',
          confidence: 90,
          speed: speedKmh,
          icon: '🚶',
          name: 'Yürüyor',
          color: '#06b6d4',
          metadata: {
            stepsPerMinute: stepPattern.stepsPerMinute,
            cadence: stepPattern.cadence,
          },
        };
      }
      // Fallback: speed-based walking
      return {
        type: 'walking',
        confidence: 75,
        speed: speedKmh,
        icon: '🚶',
        name: 'Yürüyor',
        color: '#06b6d4',
      };
    }

    // Running detection
    if (speedKmh >= 7 && speedKmh < 15) {
      if (stepPattern && stepPattern.stepsPerMinute > 140 && stepPattern.regularity > 0.7) {
        return {
          type: 'running',
          confidence: 92,
          speed: speedKmh,
          icon: '🏃',
          name: 'Koşuyor',
          color: '#10b981',
          metadata: {
            stepsPerMinute: stepPattern.stepsPerMinute,
            cadence: stepPattern.cadence,
          },
        };
      }
      // High acceleration variance indicates running
      if (variance > 2 && maxAcceleration > 3) {
        return {
          type: 'running',
          confidence: 80,
          speed: speedKmh,
          icon: '🏃',
          name: 'Koşuyor',
          color: '#10b981',
        };
      }
    }

    // Cycling detection
    if (speedKmh >= 15 && speedKmh < 30) {
      // Cycling has moderate acceleration variance
      if (variance > 0.5 && variance < 2 && avgAcceleration < 1.5) {
        return {
          type: 'cycling',
          confidence: 85,
          speed: speedKmh,
          icon: '🚴',
          name: 'Bisiklet',
          color: '#10b981',
        };
      }
      // Motorcycle (higher variance)
      if (variance > 2) {
        return {
          type: 'driving',
          confidence: 75,
          speed: speedKmh,
          icon: '🏍️',
          name: 'Motor',
          color: '#f59e0b',
        };
      }
    }

    // Driving detection
    if (speedKmh >= 30) {
      // Low acceleration variance indicates smooth driving
      if (variance < 1 && avgAcceleration < 1) {
        return {
          type: 'driving',
          confidence: 95,
          speed: speedKmh,
          icon: '🚗',
          name: 'Araba',
          color: '#3b82f6',
        };
      }
      // Higher variance might be motorcycle or city driving
      return {
        type: 'driving',
        confidence: 85,
        speed: speedKmh,
        icon: speedKmh > 60 ? '🚗' : '🏍️',
        name: speedKmh > 60 ? 'Araba' : 'Motor',
        color: speedKmh > 60 ? '#3b82f6' : '#f59e0b',
      };
    }

    // Unknown/transition state
    return {
      type: 'unknown',
      confidence: 50,
      speed: speedKmh,
      icon: '❓',
      name: 'Bilinmiyor',
      color: '#94a3b8',
    };
  }

  /**
   * Get default activity for initial state
   */
  private getDefaultActivity(location: LocationPoint): ActivityData {
    const speed = location.coords.speed
      ? location.coords.speed * 3.6
      : 0;

    if (speed < 1) {
      return {
        type: 'stationary',
        confidence: 60,
        speed,
        icon: '📍',
        name: 'Duruyor',
        color: '#64748b',
      };
    }

    return {
      type: 'walking',
      confidence: 50,
      speed,
      icon: '🚶',
      name: 'Yürüyor',
      color: '#06b6d4',
    };
  }

  /**
   * Haversine distance calculation
   */
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
   * Reset detector (clear history)
   */
  reset(): void {
    this.locationHistory = [];
    this.accelerometerHistory = [];
  }
}

// Singleton instance
let detectorInstance: ActivityDetector | null = null;

export function getActivityDetector(): ActivityDetector {
  if (!detectorInstance) {
    detectorInstance = new ActivityDetector();
  }
  return detectorInstance;
}

/**
 * Convenience function to detect activity
 */
export function detectActivity(
  location: LocationPoint,
  accelerometerData?: AccelerometerData
): ActivityData {
  const detector = getActivityDetector();
  return detector.detectActivity(location, accelerometerData);
}

