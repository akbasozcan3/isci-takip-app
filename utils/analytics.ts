import Constants from 'expo-constants';

const FIREBASE_ANALYTICS_ENABLED = Constants.expoConfig?.extra?.firebaseAnalyticsEnabled !== false;

export const logEvent = (eventName: string, params?: Record<string, any>) => {
  if (!FIREBASE_ANALYTICS_ENABLED) {
    if (__DEV__) {
      console.log('[Analytics] Event:', eventName, params);
    }
    return;
  }

  try {
    // Firebase Analytics will be initialized via app.json plugin
    // For now, we'll use console logging as fallback
    if (__DEV__) {
      console.log('[Analytics] Event:', eventName, params);
    }
    
    // TODO: Add Firebase Analytics SDK when expo-firebase-analytics is available
    // import * as Analytics from 'expo-firebase-analytics';
    // Analytics.logEvent(eventName, params);
  } catch (error) {
    console.error('[Analytics] Error logging event:', error);
  }
};

export const setUserProperty = (name: string, value: string) => {
  if (!FIREBASE_ANALYTICS_ENABLED) {
    if (__DEV__) {
      console.log('[Analytics] User Property:', name, value);
    }
    return;
  }

  try {
    if (__DEV__) {
      console.log('[Analytics] User Property:', name, value);
    }
    
    // TODO: Add Firebase Analytics SDK
    // Analytics.setUserProperty(name, value);
  } catch (error) {
    console.error('[Analytics] Error setting user property:', error);
  }
};

export const setUserId = (userId: string) => {
  if (!FIREBASE_ANALYTICS_ENABLED) {
    if (__DEV__) {
      console.log('[Analytics] User ID:', userId);
    }
    return;
  }

  try {
    if (__DEV__) {
      console.log('[Analytics] User ID:', userId);
    }
    
    // TODO: Add Firebase Analytics SDK
    // Analytics.setUserId(userId);
  } catch (error) {
    console.error('[Analytics] Error setting user ID:', error);
  }
};

// Predefined events
export const AnalyticsEvents = {
  // Authentication
  LOGIN: 'user_login',
  LOGOUT: 'user_logout',
  REGISTER: 'user_register',
  EMAIL_VERIFIED: 'email_verified',
  
  // Location
  LOCATION_UPDATE: 'location_update',
  LOCATION_SHARED: 'location_shared',
  
  // Groups
  GROUP_CREATED: 'group_created',
  GROUP_JOINED: 'group_joined',
  GROUP_LEFT: 'group_left',
  
  // Notifications
  NOTIFICATION_RECEIVED: 'notification_received',
  NOTIFICATION_OPENED: 'notification_opened',
  
  // Payments
  PAYMENT_INITIATED: 'payment_initiated',
  PAYMENT_COMPLETED: 'payment_completed',
  SUBSCRIPTION_ACTIVATED: 'subscription_activated',
  
  // App
  APP_OPENED: 'app_opened',
  SCREEN_VIEW: 'screen_view',
  BUTTON_CLICKED: 'button_clicked',
};

