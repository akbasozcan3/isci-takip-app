import * as SecureStore from 'expo-secure-store';
import { setSubscriptionStatus, setUserSegment, updateUserSegments } from './onesignal';

/**
 * Update OneSignal segments based on user data
 */
export const updateUserOneSignalSegments = async () => {
  try {
    const workerId = await SecureStore.getItemAsync('workerId');
    if (!workerId) return;

    // Get user data from storage
    const displayName = await SecureStore.getItemAsync('displayName');
    const userEmail = await SecureStore.getItemAsync('userEmail');
    
    // Update segments
    updateUserSegments({
      segment: 'active',
      lastActive: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[OneSignal Segments] Error updating segments:', error);
  }
};

/**
 * Update subscription segment when subscription changes
 */
export const updateSubscriptionSegment = async (subscriptionStatus: 'free' | 'plus' | 'business') => {
  try {
    setSubscriptionStatus(subscriptionStatus);
    console.log('[OneSignal Segments] Subscription segment updated:', subscriptionStatus);
  } catch (error) {
    console.error('[OneSignal Segments] Error updating subscription segment:', error);
  }
};

/**
 * Mark user as active (called on app open, login, etc.)
 */
export const markUserActive = async () => {
  try {
    setUserSegment('active');
    updateUserSegments({
      segment: 'active',
      lastActive: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[OneSignal Segments] Error marking user active:', error);
  }
};

/**
 * Mark user as inactive (called on logout)
 */
export const markUserInactive = async () => {
  try {
    setUserSegment('inactive');
  } catch (error) {
    console.error('[OneSignal Segments] Error marking user inactive:', error);
  }
};

