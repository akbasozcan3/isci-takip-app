import Constants from 'expo-constants';
import type { NotificationClickEvent, NotificationWillDisplayEvent } from 'react-native-onesignal';
import { OneSignal } from 'react-native-onesignal';

const ONESIGNAL_APP_ID = Constants.expoConfig?.extra?.oneSignalAppId || process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID;

let isInitialized = false;

export const initializeOneSignal = () => {
  if (isInitialized) {
    console.log('[OneSignal] Already initialized');
    return;
  }

  if (!ONESIGNAL_APP_ID || ONESIGNAL_APP_ID === 'YOUR_ONESIGNAL_APP_ID') {
    console.warn('[OneSignal] App ID not configured. Please set oneSignalAppId in app.json or EXPO_PUBLIC_ONESIGNAL_APP_ID in environment variables.');
    return;
  }

  try {
    console.log('[OneSignal] Initializing with App ID:', ONESIGNAL_APP_ID);
    OneSignal.initialize(ONESIGNAL_APP_ID);
    isInitialized = true;

    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: NotificationWillDisplayEvent) => {
      console.log('[OneSignal] Notification received in foreground:', event);
      event.getNotification().display();
    });

    OneSignal.Notifications.addEventListener('click', (event: NotificationClickEvent) => {
      console.log('[OneSignal] Notification opened:', event);
      const notification = event.notification;
      
      // Deep linking handling
      if (notification.additionalData) {
        console.log('[OneSignal] Additional data:', notification.additionalData);
        
        // Handle deep link if present
        const additionalData = notification.additionalData as Record<string, any>;
        const deepLink = additionalData.deepLink || additionalData.url || notification.launchURL;
        if (deepLink && typeof deepLink === 'string') {
          handleDeepLink(deepLink);
        }
      } else if (notification.launchURL) {
        handleDeepLink(notification.launchURL);
      }
    });

    OneSignal.Notifications.requestPermission(true).then((response) => {
      console.log('[OneSignal] Push notification permission granted:', response);
      if (response) {
        OneSignal.User.pushSubscription.getIdAsync().then((userId) => {
          console.log('[OneSignal] Push Subscription ID:', userId);
        }).catch((err) => {
          console.error('[OneSignal] Error getting subscription ID:', err);
        });
      }
    }).catch((error) => {
      console.error('[OneSignal] Permission request error:', error);
    });

    console.log('[OneSignal] Initialized successfully');
  } catch (error) {
    console.error('[OneSignal] Initialization error:', error);
    isInitialized = false;
  }
};

export const getOneSignalUserId = async (): Promise<string | null> => {
  try {
    const userId = await OneSignal.User.pushSubscription.getIdAsync();
    return userId || null;
  } catch (error) {
    console.error('[OneSignal] Error getting user ID:', error);
    return null;
  }
};

export const setOneSignalExternalUserId = (userId: string): void => {
  try {
    OneSignal.login(userId);
    console.log('[OneSignal] External user ID set:', userId);
  } catch (error) {
    console.error('[OneSignal] Error setting external user ID:', error);
  }
};

export const removeOneSignalExternalUserId = (): void => {
  try {
    OneSignal.logout();
    console.log('[OneSignal] External user ID removed');
  } catch (error) {
    console.error('[OneSignal] Error removing external user ID:', error);
  }
};

export const sendTag = (key: string, value: string): void => {
  try {
    OneSignal.User.addTag(key, value);
    console.log('[OneSignal] Tag sent:', key, value);
  } catch (error) {
    console.error('[OneSignal] Error sending tag:', error);
  }
};

export const sendTags = (tags: Record<string, string>): void => {
  try {
    OneSignal.User.addTags(tags);
    console.log('[OneSignal] Tags sent:', tags);
  } catch (error) {
    console.error('[OneSignal] Error sending tags:', error);
  }
};

// Deep linking handler - will be handled by app/_layout.tsx
const handleDeepLink = (url: string) => {
  try {
    console.log('[OneSignal] Deep link received:', url);
    // Deep linking is handled in app/_layout.tsx via Linking API
    // This function is kept for compatibility but actual routing happens in _layout
  } catch (error) {
    console.error('[OneSignal] Error handling deep link:', error);
  }
};

// Segment management functions
export const setUserSegment = (segment: 'active' | 'inactive' | 'premium' | 'free'): void => {
  try {
    sendTag('user_segment', segment);
    console.log('[OneSignal] User segment set:', segment);
  } catch (error) {
    console.error('[OneSignal] Error setting user segment:', error);
  }
};

export const setUserLocation = (city: string, country?: string): void => {
  try {
    const tags: Record<string, string> = { city };
    if (country) {
      tags.country = country;
    }
    sendTags(tags);
    console.log('[OneSignal] User location set:', tags);
  } catch (error) {
    console.error('[OneSignal] Error setting user location:', error);
  }
};

export const setUserRole = (role: 'admin' | 'user' | 'manager'): void => {
  try {
    sendTag('user_role', role);
    console.log('[OneSignal] User role set:', role);
  } catch (error) {
    console.error('[OneSignal] Error setting user role:', error);
  }
};

export const setSubscriptionStatus = (status: 'free' | 'plus' | 'business'): void => {
  try {
    sendTag('subscription_status', status);
    console.log('[OneSignal] Subscription status set:', status);
  } catch (error) {
    console.error('[OneSignal] Error setting subscription status:', error);
  }
};

export const updateUserSegments = (data: {
  segment?: 'active' | 'inactive' | 'premium' | 'free';
  city?: string;
  country?: string;
  role?: 'admin' | 'user' | 'manager';
  subscription?: 'free' | 'plus' | 'business';
  lastActive?: string;
}): void => {
  try {
    const tags: Record<string, string> = {};
    
    if (data.segment) tags.user_segment = data.segment;
    if (data.city) tags.city = data.city;
    if (data.country) tags.country = data.country;
    if (data.role) tags.user_role = data.role;
    if (data.subscription) tags.subscription_status = data.subscription;
    if (data.lastActive) tags.last_active = data.lastActive;
    
    if (Object.keys(tags).length > 0) {
      sendTags(tags);
      console.log('[OneSignal] User segments updated:', tags);
    }
  } catch (error) {
    console.error('[OneSignal] Error updating user segments:', error);
  }
};

export default OneSignal;

