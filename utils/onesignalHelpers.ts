/**
 * OneSignal Helper Functions
 * Utilities for getting player ID and managing OneSignal on client
 */

import { getOneSignalUserId } from './onesignal';

/**
 * Get the current OneSignal player ID (subscription ID)
 * This is the most reliable way to send push notifications
 */
export const getPlayerId = async (): Promise<string | null> => {
  try {
    const playerId = await getOneSignalUserId();
    if (playerId) {
      console.log('[OneSignalHelpers] Player ID retrieved:', playerId);
      return playerId;
    }
    console.warn('[OneSignalHelpers] Player ID not available');
    return null;
  } catch (error) {
    console.error('[OneSignalHelpers] Error getting player ID:', error);
    return null;
  }
};

// Cache to prevent duplicate sends
const playerIdCache = new Map<string, { timestamp: number; sent: boolean }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MIN_SEND_INTERVAL = 10 * 1000; // 10 seconds minimum between sends

/**
 * Send player ID to backend for storage/use
 * Throttled to prevent rate limit issues
 */
export const sendPlayerIdToBackend = async (playerId: string, userId: string): Promise<boolean> => {
  if (!playerId || !userId) {
    console.warn('[OneSignalHelpers] Missing playerId or userId');
    return false;
  }

  // Check cache to prevent duplicate sends
  const cacheKey = `${userId}:${playerId}`;
  const cached = playerIdCache.get(cacheKey);
  const now = Date.now();
  
  if (cached) {
    const timeSinceLastSend = now - cached.timestamp;
    if (cached.sent && timeSinceLastSend < CACHE_DURATION) {
      // Already sent recently, skip
      console.log('[OneSignalHelpers] Player ID already sent recently, skipping');
      return true;
    }
    if (timeSinceLastSend < MIN_SEND_INTERVAL) {
      // Too soon, skip
      console.log('[OneSignalHelpers] Rate limiting: too soon since last send');
      return false;
    }
  }

  let retries = 3;
  let lastError: any = null;

  while (retries > 0) {
    try {
      const { buildApiUrl } = await import('./auth');
      const { getToken } = await import('./auth');
      
      const token = await getToken();
      if (!token) {
        console.warn('[OneSignalHelpers] No auth token, cannot send player ID');
        return false;
      }

      const url = buildApiUrl('/users/update-onesignal-id');
      console.log('[OneSignalHelpers] Sending player ID to:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          playerId: String(playerId).trim(),
          userId: String(userId).trim(),
        }),
      });

      if (response.ok) {
        const result = await response.json().catch(() => ({}));
        console.log('[OneSignalHelpers] ✅ Player ID sent to backend successfully:', result);
        // Update cache
        playerIdCache.set(cacheKey, { timestamp: now, sent: true });
        return true;
      } else {
        const errorData = await response.json().catch(() => ({}));
        lastError = new Error(`HTTP ${response.status}: ${errorData.error || errorData.message || response.statusText}`);
        console.warn(`[OneSignalHelpers] Failed to send player ID (attempt ${4 - retries}/3):`, response.status, errorData);
        
        if (response.status === 401 || response.status === 403) {
          // Auth error, don't retry
          return false;
        }
        if (response.status === 429) {
          // Rate limit, don't retry immediately
          console.warn('[OneSignalHelpers] Rate limit hit, will retry later');
          // Update cache to prevent immediate retry
          playerIdCache.set(cacheKey, { timestamp: now, sent: false });
          return false;
        }
      }
    } catch (error: any) {
      lastError = error;
      console.warn(`[OneSignalHelpers] Error sending player ID (attempt ${4 - retries}/3):`, error.message);
    }

    retries--;
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries))); // Exponential backoff
    }
  }

  console.error('[OneSignalHelpers] ❌ Failed to send player ID after all retries:', lastError);
  return false;
};

/**
 * Initialize OneSignal and sync player ID with backend
 */
export const initializeAndSyncOneSignal = async (userId: string): Promise<void> => {
  try {
    const { initializeOneSignal } = await import('./onesignal');
    await initializeOneSignal();
    
    // Wait a bit for OneSignal to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const playerId = await getPlayerId();
    if (playerId) {
      await sendPlayerIdToBackend(playerId, userId);
    } else {
      // Retry after a delay
      setTimeout(async () => {
        const retryPlayerId = await getPlayerId();
        if (retryPlayerId) {
          await sendPlayerIdToBackend(retryPlayerId, userId);
        }
      }, 3000);
    }
  } catch (error) {
    console.error('[OneSignalHelpers] Error initializing and syncing OneSignal:', error);
  }
};

