/**
 * Device Utilities
 * Helper functions for device identification
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Optional import for expo-device (may require native build)
// Using lazy loading to avoid Metro bundler errors if package is not available
let DeviceModule: any = null;
let DeviceModuleChecked = false;

function getDeviceModule() {
  if (DeviceModuleChecked) {
    return DeviceModule;
  }
  
  DeviceModuleChecked = true;
  
  // Try to load expo-device module
  // Metro bundler may fail if package is not installed, so we catch and use fallback
  try {
    // @ts-ignore - Optional dependency, may not be installed
    const deviceLib = require('expo-device');
    if (deviceLib) {
      DeviceModule = deviceLib;
      return DeviceModule;
    }
  } catch (e) {
    // Module not found or not available - use fallback
    // This is expected if expo-device is not installed
  }
  
  // Fallback implementation when expo-device is not available
  DeviceModule = {
    modelName: null,
    osVersion: null,
  };
  
  return DeviceModule;
}

const DEVICE_ID_KEY = 'device_id';

/**
 * Get or create device ID
 */
export async function getDeviceId(): Promise<string> {
  try {
    let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    
    if (!deviceId) {
      // Generate a unique device ID
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 15);
      deviceId = `${Platform.OS}_${timestamp}_${random}`;
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    }
    
    return deviceId;
  } catch (error) {
    console.warn('[Device] Error getting device ID:', error);
    // Fallback to a temporary ID
    return `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}

/**
 * Get device info
 */
export async function getDeviceInfo(): Promise<{
  deviceId: string;
  platform: string;
  model: string | null;
  osVersion: string | null;
}> {
  const deviceId = await getDeviceId();
  const Device = getDeviceModule();
  
  return {
    deviceId,
    platform: Platform.OS,
    model: Device?.modelName || null,
    osVersion: Device?.osVersion || null,
  };
}

