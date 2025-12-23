/**
 * Adaptive GPS Tracking Optimizer
 * World-class GPS tracking system - Intelligent tracking based on speed, battery, and movement
 */

import * as Location from 'expo-location';
import { Platform } from 'react-native';

// Optional import for expo-battery (may require native build)
// Using lazy loading to avoid Metro bundler errors if package is not available
// Note: If expo-battery is not installed, this will use fallback values
let BatteryModule: any = null;
let BatteryModuleChecked = false;

function getBatteryModule() {
  if (BatteryModuleChecked) {
    return BatteryModule;
  }
  
  BatteryModuleChecked = true;
  
  // Try to load expo-battery module
  // Metro bundler may fail if package is not installed, so we catch and use fallback
  try {
    // @ts-ignore - Optional dependency, may not be installed
    const batteryLib = require('expo-battery');
    if (batteryLib && typeof batteryLib.getBatteryLevelAsync === 'function') {
      BatteryModule = batteryLib;
      return BatteryModule;
    }
  } catch (e) {
    // Module not found or not available - use fallback
    // This is expected if expo-battery is not installed
  }
  
  // Fallback implementation when expo-battery is not available
  BatteryModule = {
    getBatteryLevelAsync: async () => 1.0,
    getBatteryStateAsync: async () => 1, // UNPLUGGED
    BatteryState: {
      UNKNOWN: 0,
      UNPLUGGED: 1,
      CHARGING: 2,
      FULL: 3,
    },
  };
  
  return BatteryModule;
}

export interface TrackingConfig {
  timeInterval: number; // milliseconds
  distanceInterval: number; // meters
  accuracy: Location.Accuracy;
}

export interface MovementState {
  speed: number | null; // km/h
  acceleration: number | null; // m/s²
  isMoving: boolean;
  lastUpdateTime: number;
}

export interface DeviceState {
  batteryLevel: number | null; // 0-1
  isCharging: boolean;
  isScreenOn: boolean;
}

/**
 * Calculate optimal tracking configuration based on current state
 */
export function calculateOptimalTracking(
  movementState: MovementState,
  deviceState: DeviceState
): TrackingConfig {
  const { speed, acceleration, isMoving } = movementState;
  const { batteryLevel, isCharging, isScreenOn } = deviceState;

  // Base configuration
  let timeInterval = 20000; // 20 seconds default
  let distanceInterval = 10; // 10 meters default
  let accuracy: Location.Accuracy = Location.Accuracy.Balanced;

  // Speed-based adjustments
  if (speed !== null) {
    if (speed > 50) {
      // High speed (driving): more frequent updates
      timeInterval = 5000; // 5 seconds
      distanceInterval = 50; // 50 meters
      accuracy = Location.Accuracy.Highest;
    } else if (speed > 20) {
      // Medium speed (cycling): moderate updates
      timeInterval = 10000; // 10 seconds
      distanceInterval = 20; // 20 meters
      accuracy = Location.Accuracy.High;
    } else if (speed > 5) {
      // Low speed (walking): less frequent updates
      timeInterval = 15000; // 15 seconds
      distanceInterval = 10; // 10 meters
      accuracy = Location.Accuracy.Balanced;
    } else if (speed < 1) {
      // Stationary: much less frequent updates
      timeInterval = 60000; // 60 seconds
      distanceInterval = 5; // 5 meters
      accuracy = Location.Accuracy.Low;
    }
  }

  // Acceleration-based adjustments
  if (acceleration !== null) {
    if (acceleration > 2) {
      // High acceleration: increase frequency
      timeInterval = Math.max(5000, timeInterval * 0.7);
    } else if (acceleration < 0.1) {
      // Low acceleration: decrease frequency
      timeInterval = Math.min(60000, timeInterval * 1.5);
    }
  }

  // Movement state adjustments
  if (!isMoving) {
    // Not moving: reduce frequency significantly
    timeInterval = Math.max(60000, timeInterval * 2);
    distanceInterval = Math.max(5, distanceInterval * 0.5);
    accuracy = Location.Accuracy.Low;
  }

  // Battery-based adjustments
  if (batteryLevel !== null) {
    if (batteryLevel < 0.2 && !isCharging) {
      // Low battery and not charging: reduce accuracy and frequency
      timeInterval = Math.min(120000, timeInterval * 2); // Max 2 minutes
      distanceInterval = Math.max(20, distanceInterval * 1.5);
      accuracy = Location.Accuracy.Low;
    } else if (batteryLevel < 0.5 && !isCharging) {
      // Medium battery: slight reduction
      timeInterval = Math.min(60000, timeInterval * 1.3);
      accuracy = Location.Accuracy.Balanced;
    } else if (isCharging) {
      // Charging: can use higher accuracy
      accuracy = Location.Accuracy.High;
    }
  }

  // Screen state adjustments
  if (!isScreenOn) {
    // Screen off: reduce frequency
    timeInterval = Math.min(120000, timeInterval * 1.5);
    accuracy = Location.Accuracy.Balanced;
  }

  // Platform-specific adjustments
  if (Platform.OS === 'ios') {
    // iOS is generally more battery efficient
    // Can use slightly higher accuracy
    if (accuracy === Location.Accuracy.Low) {
      accuracy = Location.Accuracy.Balanced;
    }
  } else if (Platform.OS === 'android') {
    // Android: be more conservative
    if (batteryLevel !== null && batteryLevel < 0.3) {
      accuracy = Location.Accuracy.Low;
    }
  }

  // Ensure minimum values
  timeInterval = Math.max(5000, timeInterval);
  distanceInterval = Math.max(5, distanceInterval);

  return {
    timeInterval: Math.round(timeInterval),
    distanceInterval: Math.round(distanceInterval),
    accuracy,
  };
}

/**
 * Detect if user is moving based on speed and acceleration
 */
export function detectMovement(
  currentSpeed: number | null,
  acceleration: number | null,
  previousSpeed: number | null = null
): boolean {
  // If speed is above threshold, definitely moving
  if (currentSpeed !== null && currentSpeed > 2) {
    return true;
  }

  // If acceleration is high, likely moving
  if (acceleration !== null && acceleration > 1) {
    return true;
  }

  // If speed changed significantly, likely moving
  if (previousSpeed !== null && currentSpeed !== null) {
    const speedChange = Math.abs(currentSpeed - previousSpeed);
    if (speedChange > 1) {
      return true;
    }
  }

  // Default: assume not moving if speed is very low
  return currentSpeed !== null && currentSpeed > 0.5;
}

/**
 * Calculate acceleration from speed changes
 */
export function calculateAcceleration(
  currentSpeed: number | null,
  previousSpeed: number | null,
  timeDelta: number // seconds
): number | null {
  if (currentSpeed === null || previousSpeed === null || timeDelta <= 0) {
    return null;
  }

  // Convert km/h to m/s
  const currentSpeedMs = (currentSpeed * 1000) / 3600;
  const previousSpeedMs = (previousSpeed * 1000) / 3600;

  // Acceleration = change in velocity / time
  return (currentSpeedMs - previousSpeedMs) / timeDelta;
}

/**
 * Get current device state (battery, charging, screen)
 */
export async function getDeviceState(): Promise<DeviceState> {
  try {
    const Battery = getBatteryModule();
    
    // Check if Battery module is available
    if (!Battery || typeof Battery.getBatteryLevelAsync !== 'function') {
      // Fallback if expo-battery is not available
      return {
        batteryLevel: null,
        isCharging: false,
        isScreenOn: true,
      };
    }

    const batteryLevel = await Battery.getBatteryLevelAsync();
    const batteryState = await Battery.getBatteryStateAsync();
    const isCharging = batteryState === Battery.BatteryState?.CHARGING || batteryState === 2;

    // Note: Screen state requires additional native module
    // For now, we'll assume screen is on (can be enhanced later)
    const isScreenOn = true;

    return {
      batteryLevel,
      isCharging,
      isScreenOn,
    };
  } catch (error) {
    console.warn('[TrackingOptimizer] Error getting device state:', error);
    return {
      batteryLevel: null,
      isCharging: false,
      isScreenOn: true,
    };
  }
}

/**
 * Stop detection: Check if user has stopped moving
 */
export function detectStop(
  movementHistory: Array<{ speed: number | null; timestamp: number }>,
  stopThresholdSeconds: number = 300 // 5 minutes
): boolean {
  if (movementHistory.length < 2) {
    return false;
  }

  const now = Date.now();
  const threshold = stopThresholdSeconds * 1000;

  // Check if all recent speeds are below threshold
  const recentMovements = movementHistory.filter(
    (m) => now - m.timestamp < threshold
  );

  if (recentMovements.length === 0) {
    return false;
  }

  // If all recent speeds are very low or null, user has stopped
  const allStopped = recentMovements.every(
    (m) => m.speed === null || m.speed < 1
  );

  return allStopped;
}

