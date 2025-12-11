import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import type { NotificationClickEvent, NotificationWillDisplayEvent } from 'react-native-onesignal';
import { OneSignal } from 'react-native-onesignal';

const ONESIGNAL_APP_ID = Constants.expoConfig?.extra?.oneSignalAppId || process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID;

let isInitialized = false;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

export const initializeOneSignal = async (): Promise<void> => {
  if (isInitialized) {
    return;
  }

  if (initializationAttempts >= MAX_INIT_ATTEMPTS) {
    console.error('[OneSignal] Max initialization attempts reached');
    return;
  }

  if (!ONESIGNAL_APP_ID || ONESIGNAL_APP_ID === 'YOUR_ONESIGNAL_APP_ID') {
    console.error('[OneSignal] App ID not configured');
    return;
  }

  try {
    initializationAttempts++;
    
    OneSignal.initialize(ONESIGNAL_APP_ID);
    isInitialized = true;

    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: NotificationWillDisplayEvent) => {
      const notification = event.getNotification();
      console.log('[OneSignal] Foreground notification received:', notification.title);
      notification.display();
    });

    OneSignal.Notifications.addEventListener('click', (event: NotificationClickEvent) => {
      const notification = event.notification;
      console.log('[OneSignal] Notification clicked:', notification.title);
      
      if (notification.additionalData) {
        const additionalData = notification.additionalData as Record<string, any>;
        const deepLink = additionalData.deepLink || additionalData.url || notification.launchURL;
        if (deepLink && typeof deepLink === 'string') {
          handleDeepLink(deepLink);
        }
      } else if (notification.launchURL) {
        handleDeepLink(notification.launchURL);
      }
    });

    const permissionResponse = await OneSignal.Notifications.requestPermission(true);
    console.log('[OneSignal] Permission response:', permissionResponse);
    
    if (permissionResponse) {
      try {
        const userId = await OneSignal.User.pushSubscription.getIdAsync();
        if (userId) {
          console.log('[OneSignal] Active - Subscription ID:', userId);
        } else {
          console.warn('[OneSignal] Subscription ID not available yet');
        }
      } catch (error) {
        console.error('[OneSignal] Error getting subscription ID:', error);
      }
    } else {
      console.warn('[OneSignal] Notification permission denied');
    }

    console.log('[OneSignal] Initialized and ready');
  } catch (error) {
    console.error('[OneSignal] Initialization failed:', error);
    isInitialized = false;
    
    if (initializationAttempts < MAX_INIT_ATTEMPTS) {
      setTimeout(() => {
        if (!isInitialized) {
          initializeOneSignal();
        }
      }, 3000);
    }
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

export const setOneSignalExternalUserId = async (userId: string): Promise<void> => {
  try {
    if (!isInitialized) {
      await initializeOneSignal();
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    if (isInitialized && userId) {
      OneSignal.login(userId);
      console.log('[OneSignal] External user ID set:', userId);
    } else {
      console.warn('[OneSignal] Cannot set external user ID - not initialized or userId missing');
      setTimeout(async () => {
        if (isInitialized && userId) {
          try {
            OneSignal.login(userId);
            console.log('[OneSignal] External user ID set (retry):', userId);
          } catch (retryError) {
            console.error('[OneSignal] Retry failed:', retryError);
          }
        }
      }, 2000);
    }
  } catch (error) {
    console.error('[OneSignal] Error setting external user ID:', error);
    setTimeout(async () => {
      if (isInitialized && userId) {
        try {
          OneSignal.login(userId);
          console.log('[OneSignal] External user ID set (error retry):', userId);
        } catch (retryError) {
          console.error('[OneSignal] Error retry failed:', retryError);
        }
      }
    }, 3000);
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

const handleDeepLink = async (url: string) => {
  try {
    console.log('[OneSignal] Deep link received:', url);
    if (url && typeof url === 'string') {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        const parsed = Linking.parse(url);
        if (parsed.scheme === 'bavaxe' || url.includes('bavaxe')) {
          console.log('[OneSignal] Handling bavaxe deep link:', parsed);
        }
      }
    }
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

