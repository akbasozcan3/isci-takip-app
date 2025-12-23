/**
 * Route Recording and Playback System
 * World-class GPS tracking - Record routes and replay with timeline
 */

import * as Location from 'expo-location';
import { ActivityData } from './activityDetector';

export interface RoutePoint {
  timestamp: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  altitude?: number;
  activity?: ActivityData;
}

export interface Route {
  id: string;
  name: string;
  startTime: number;
  endTime: number | null;
  points: RoutePoint[];
  totalDistance: number; // meters
  totalDuration: number; // seconds
  averageSpeed: number; // km/h
  maxSpeed: number; // km/h
  activities: {
    walking: number; // seconds
    running: number;
    cycling: number;
    driving: number;
    stationary: number;
  };
  metadata?: {
    deviceId?: string;
    userId?: string;
    groupId?: string;
  };
}

class RouteRecorder {
  private currentRoute: Route | null = null;
  private isRecording = false;
  private playbackInterval: ReturnType<typeof setInterval> | null = null;
  private playbackCallback: ((point: RoutePoint, progress: number) => void) | null = null;
  private playbackIndex = 0;
  private playbackSpeed = 1; // 1x, 2x, 4x, etc.

  /**
   * Start recording a new route
   */
  startRecording(name?: string, metadata?: Route['metadata']): Route {
    if (this.isRecording && this.currentRoute) {
      return this.currentRoute;
    }

    const routeId = `route_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.currentRoute = {
      id: routeId,
      name: name || `Rota ${new Date().toLocaleString('tr-TR')}`,
      startTime: Date.now(),
      endTime: null,
      points: [],
      totalDistance: 0,
      totalDuration: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      activities: {
        walking: 0,
        running: 0,
        cycling: 0,
        driving: 0,
        stationary: 0,
      },
      metadata,
    };

    this.isRecording = true;
    return this.currentRoute;
  }

  /**
   * Add point to current route
   */
  addPoint(location: Location.LocationObject, activity?: ActivityData): void {
    if (!this.isRecording || !this.currentRoute) {
      return;
    }

    const point: RoutePoint = {
      timestamp: location.timestamp,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? undefined,
      heading: location.coords.heading ?? undefined,
      speed: location.coords.speed ?? undefined,
      altitude: location.coords.altitude ?? undefined,
      activity,
    };

    this.currentRoute.points.push(point);

    // Update route statistics
    this.updateRouteStats();
  }

  /**
   * Stop recording current route
   */
  stopRecording(): Route | null {
    if (!this.isRecording || !this.currentRoute) {
      return null;
    }

    this.currentRoute.endTime = Date.now();
    this.currentRoute.totalDuration =
      (this.currentRoute.endTime - this.currentRoute.startTime) / 1000;

    // Final stats update
    this.updateRouteStats();

    const route = { ...this.currentRoute };
    this.currentRoute = null;
    this.isRecording = false;

    return route;
  }

  /**
   * Get current route
   */
  getCurrentRoute(): Route | null {
    return this.currentRoute ? { ...this.currentRoute } : null;
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Update route statistics
   */
  private updateRouteStats(): void {
    if (!this.currentRoute || this.currentRoute.points.length < 2) {
      return;
    }

    let totalDistance = 0;
    let maxSpeed = 0;
    const activities: Record<string, number> = {
      walking: 0,
      running: 0,
      cycling: 0,
      driving: 0,
      stationary: 0,
    };

    for (let i = 1; i < this.currentRoute.points.length; i++) {
      const prev = this.currentRoute.points[i - 1];
      const curr = this.currentRoute.points[i];

      // Calculate distance
      const distance = this.haversineDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      );
      totalDistance += distance;

      // Update max speed
      if (curr.speed) {
        const speedKmh = curr.speed * 3.6;
        maxSpeed = Math.max(maxSpeed, speedKmh);
      }

      // Update activity duration
      if (curr.activity) {
        const timeDiff = (curr.timestamp - prev.timestamp) / 1000; // seconds
        const activityType = curr.activity.type;
        if (activityType in activities) {
          activities[activityType as keyof typeof activities] += timeDiff;
        }
      }
    }

    // Calculate average speed
    const totalTime = this.currentRoute.points.length > 1
      ? (this.currentRoute.points[this.currentRoute.points.length - 1].timestamp -
          this.currentRoute.points[0].timestamp) /
        1000
      : 0;
    const averageSpeed = totalTime > 0 ? (totalDistance / totalTime) * 3.6 : 0;

    this.currentRoute.totalDistance = totalDistance;
    this.currentRoute.averageSpeed = averageSpeed;
    this.currentRoute.maxSpeed = maxSpeed;
    this.currentRoute.activities = activities as Route['activities'];
  }

  /**
   * Start playback of a route
   */
  startPlayback(
    route: Route,
    callback: (point: RoutePoint, progress: number) => void,
    speed: number = 1
  ): void {
    if (this.playbackInterval) {
      this.stopPlayback();
    }

    if (route.points.length === 0) {
      return;
    }

    this.playbackCallback = callback;
    this.playbackIndex = 0;
    this.playbackSpeed = speed;

    // Calculate interval based on actual timestamps and playback speed
    const startTime = Date.now();
    let lastTimestamp = route.points[0].timestamp;

    this.playbackInterval = setInterval(() => {
      if (this.playbackIndex >= route.points.length) {
        this.stopPlayback();
        return;
      }

      const point = route.points[this.playbackIndex];
      const progress = this.playbackIndex / route.points.length;

      // Calculate when this point should be shown
      const timeSinceStart = (Date.now() - startTime) * this.playbackSpeed;
      const targetTime = point.timestamp - route.points[0].timestamp;

      if (timeSinceStart >= targetTime) {
        if (this.playbackCallback) {
          this.playbackCallback(point, progress);
        }
        this.playbackIndex++;
      }
    }, 100); // Check every 100ms
  }

  /**
   * Stop playback
   */
  stopPlayback(): void {
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }
    this.playbackCallback = null;
    this.playbackIndex = 0;
  }

  /**
   * Check if currently playing
   */
  isPlaying(): boolean {
    return this.playbackInterval !== null;
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
   * Export route to JSON
   */
  exportRoute(route: Route): string {
    return JSON.stringify(route, null, 2);
  }

  /**
   * Import route from JSON
   */
  importRoute(json: string): Route | null {
    try {
      return JSON.parse(json) as Route;
    } catch (error) {
      console.error('[RouteRecorder] Import error:', error);
      return null;
    }
  }
}

// Singleton instance
let recorderInstance: RouteRecorder | null = null;

export function getRouteRecorder(): RouteRecorder {
  if (!recorderInstance) {
    recorderInstance = new RouteRecorder();
  }
  return recorderInstance;
}

