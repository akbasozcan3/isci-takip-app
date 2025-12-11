const https = require('https');

class OneSignalService {
  constructor() {
    this.appId = (process.env.ONESIGNAL_APP_ID || '4a846145-621c-4a0d-a29f-0598da946c50').trim();
    
    // Get API key from environment - NO default fallback for security
    const rawApiKey = process.env.ONESIGNAL_REST_API_KEY;
    
    if (!rawApiKey || rawApiKey === 'YOUR_ONESIGNAL_REST_API_KEY' || rawApiKey.trim().length === 0) {
      console.warn('[OneSignalService] ⚠️ ONESIGNAL_REST_API_KEY not configured in .env file');
      console.warn('[OneSignalService] ⚠️ OneSignal notifications will be disabled');
      console.warn('[OneSignalService] 💡 To enable: Add ONESIGNAL_REST_API_KEY=your_key_here to backend/.env');
      this.apiKey = null;
      this.enabled = false;
      return;
    }
    
    // Clean API key: remove quotes, spaces, and trim
    this.apiKey = rawApiKey.trim().replace(/^["']|["']$/g, '').trim(); // Remove surrounding quotes if present
    
    // Validate API key format
    if (this.apiKey && !this.apiKey.startsWith('os_v2_app_') && !this.apiKey.startsWith('YOUR_')) {
      console.warn('[OneSignalService] ⚠️ API Key does not start with "os_v2_app_" - this may be incorrect');
      console.warn('[OneSignalService] ⚠️ Expected format: os_v2_app_...');
    }
    
    // Log cleaned API key info for debugging
    if (rawApiKey !== this.apiKey) {
      console.log('[OneSignalService] 🔧 API Key was cleaned (removed quotes/spaces)');
      console.log('[OneSignalService] 🔧 Original length:', rawApiKey.length, '→ Cleaned length:', this.apiKey.length);
    }
    
    // Log API key format validation
    if (this.apiKey.length < 50) {
      console.warn('[OneSignalService] ⚠️ API Key seems too short (expected ~100+ characters)');
    }
    this.baseUrl = 'https://onesignal.com/api/v1';
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.requestTimeout = 30000;
    this.enabled = true;
    
    // Validate app ID
    if (!this.appId || this.appId === 'YOUR_ONESIGNAL_APP_ID' || this.appId.length < 10) {
      console.error('[OneSignalService] ❌ Invalid App ID:', this.appId);
      this.enabled = false;
      return;
    }
    
    // Validate API Key
    if (!this.apiKey || this.apiKey === 'YOUR_ONESIGNAL_REST_API_KEY' || this.apiKey.length < 20) {
      console.warn('[OneSignalService] ❌ API Key not configured, OneSignal will be disabled');
      this.enabled = false;
      return;
    }
    
    console.log('[OneSignalService] ✅ Initialized with App ID:', this.appId);
    console.log('[OneSignalService] ✅ API Key configured:', this.apiKey.substring(0, 20) + '...');
    console.log('[OneSignalService] ✅ Service enabled:', this.enabled);
    
    // Test API key validity on startup (non-blocking, delayed)
    setTimeout(() => {
      this.testApiKey().then(result => {
        if (result.success) {
          console.log('[OneSignalService] ✅ API Key validation successful');
        } else {
          console.warn('[OneSignalService] ⚠️ API Key validation failed:', result.error);
          console.warn('[OneSignalService] ⚠️ Notifications may not work until API Key is fixed');
        }
      }).catch(err => {
        console.warn('[OneSignalService] ⚠️ API Key test error (non-blocking):', err.message);
      });
    }, 2000); // Wait 2 seconds after startup to test
  }

  async sendWithRetry(fn, retries = this.maxRetries) {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        const isLastAttempt = i === retries - 1;
        const shouldRetry = error.message.includes('timeout') || 
                          error.message.includes('ECONNRESET') || 
                          error.message.includes('network') ||
                          (error.message.includes('5') && !isLastAttempt);
        
        if (!shouldRetry || isLastAttempt) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (i + 1)));
      }
    }
  }

  async sendNotification({
    userIds = [],
    playerIds = [],
    segments = [],
    title,
    message,
    data = {},
    url = null,
    deepLink = null,
    imageUrl = null,
    buttons = null,
    priority = 10,
    sound = 'default',
    badge = null
  }) {
    // Validate service is enabled
    if (!this.enabled) {
      return { success: false, error: 'OneSignal is disabled - Configuration invalid' };
    }
    
    // Validate app ID
    if (!this.appId || this.appId === 'YOUR_ONESIGNAL_APP_ID' || this.appId.length < 10) {
      console.error('[OneSignalService] ❌ Invalid App ID:', this.appId);
      return { success: false, error: 'OneSignal App ID is invalid or not configured' };
    }
    
    // Validate API Key
    if (!this.apiKey || this.apiKey === 'YOUR_ONESIGNAL_REST_API_KEY' || this.apiKey.length < 20) {
      return { success: false, error: 'OneSignal API Key not configured' };
    }

    // Validate recipients
    if (!userIds.length && !playerIds.length && !segments.length) {
      return { success: false, error: 'Either userIds, playerIds, or segments must be provided' };
    }

    // Validate content
    if (!title || !message) {
      return { success: false, error: 'Title and message are required' };
    }

    // Build notification payload according to OneSignal REST API v1
    // IMPORTANT: app_id MUST be the first field and MUST be valid
    const notification = {
      app_id: String(this.appId).trim(), // Ensure it's a string and trimmed
      headings: { en: String(title).substring(0, 100) },
      contents: { en: String(message).substring(0, 500) },
      priority: Math.min(Math.max(priority, 0), 10),
      sound: sound || 'default',
      // Android specific settings
      // Note: android_channel_id removed - OneSignal will use default channel
      android_visibility: 1, // Public visibility
      android_accent_color: 'FF06b6d4', // BAVAXE primary color
      android_sound: sound || 'default',
      // iOS specific settings
      ios_sound: sound || 'default',
      // Additional data
      data: {
        ...data,
        ...(deepLink ? { deepLink, url: deepLink } : {}),
        ...(url ? { url } : {}),
        timestamp: Date.now()
      },
      // Optional fields
      ...(imageUrl ? { big_picture: imageUrl, large_icon: imageUrl } : {}),
      ...(buttons ? { buttons } : {}),
      ...(badge ? { badge } : {})
    };

    // Priority: playerIds > external_user_ids > segments
    if (playerIds.length > 0) {
      // Use include_player_ids for direct delivery (most reliable)
      notification.include_player_ids = playerIds.map(String).filter(id => id && id.length > 0).slice(0, 2000);
      console.log(`[OneSignalService] Using include_player_ids: ${notification.include_player_ids.length} players`);
    } else if (userIds.length > 0) {
      // Fallback to external_user_ids (requires OneSignal.login() on client)
      notification.include_external_user_ids = userIds.map(String).filter(id => id && id.length > 0).slice(0, 2000);
      console.log(`[OneSignalService] Using include_external_user_ids: ${notification.include_external_user_ids.length} users`);
    }

    if (segments.length > 0) {
      notification.included_segments = segments.slice(0, 10);
      console.log(`[OneSignalService] Using included_segments: ${segments.join(', ')}`);
    }

    // Deep link handling
    if (deepLink) {
      notification.url = deepLink;
    } else if (url) {
      notification.url = url;
    }

    try {
      // Validate notification payload before sending
      if (!notification.app_id || notification.app_id.length < 10) {
        console.error('[OneSignalService] ❌ Invalid app_id in notification payload:', notification.app_id);
        return { success: false, error: 'Invalid app_id in notification payload' };
      }
      
      console.log(`[OneSignalService] 📤 Sending notification with app_id: ${notification.app_id}`);
      console.log(`[OneSignalService] Payload:`, JSON.stringify(notification, null, 2));
      
      const response = await this.sendWithRetry(() => 
        this.makeRequest('/notifications', 'POST', notification)
      );
      
      console.log(`[OneSignalService] 📥 Notification API response:`, JSON.stringify(response, null, 2));
      
      // Check for errors in response
      if (response.errors && response.errors.length > 0) {
        console.error(`[OneSignalService] ❌ OneSignal API returned errors:`, response.errors);
        return { 
          success: false, 
          error: response.errors.join(', '),
          data: response 
        };
      }
      
      // Check delivery status
      if (response.id) {
        console.log(`[OneSignalService] ✅ Notification queued successfully. ID: ${response.id}, Recipients: ${response.recipients || 'N/A'}`);
      }
      
      return { success: true, data: response };
    } catch (error) {
      console.error(`[OneSignalService] ❌ Notification send error:`, error);
      console.error(`[OneSignalService] Error details:`, {
        message: error.message,
        stack: error.stack,
        appId: this.appId,
        apiKeyLength: this.apiKey?.length
      });
      return { success: false, error: error.message };
    }
  }

  async sendToUser(userId, title, message, options = {}) {
    console.log(`[OneSignalService] 📤 sendToUser called:`, { userId, title, message, options });
    
    if (!this.enabled) {
      console.error(`[OneSignalService] ❌ Service is disabled, cannot send notification`);
      return { success: false, error: 'OneSignal service is disabled' };
    }
    
    // Try to get player ID from database if available
    let playerIds = [];
    if (options.playerId) {
      playerIds = [String(options.playerId)];
      delete options.playerId;
      console.log(`[OneSignalService] ✅ Using provided player ID: ${playerIds[0]}`);
    } else {
      // Try to get player ID from database
      try {
        const db = require('../config/database');
        const user = db.findUserById(userId);
        console.log(`[OneSignalService] 🔍 Looking for user ${userId}, found:`, user ? 'yes' : 'no');
        
        if (user) {
          console.log(`[OneSignalService] 🔍 User onesignalPlayerId:`, user.onesignalPlayerId || 'not set');
        }
        
        const storedPlayerId = db.getUserOnesignalPlayerId(userId);
        if (storedPlayerId) {
          playerIds = [String(storedPlayerId)];
          console.log(`[OneSignalService] ✅ Found stored player ID for user ${userId}: ${storedPlayerId}`);
        } else {
          console.warn(`[OneSignalService] ⚠️ No stored player ID for user ${userId}, will use external_user_id`);
        }
      } catch (dbError) {
        console.error(`[OneSignalService] ❌ Could not get player ID from database:`, dbError.message);
        console.error(`[OneSignalService] Stack:`, dbError.stack);
      }
    }
    
    // Build notification options - prioritize playerIds, fallback to external_user_ids
    const notificationOptions = {
      title,
      message,
      ...options
    };
    
    // If we have player IDs, use them (most reliable)
    if (playerIds.length > 0) {
      notificationOptions.playerIds = playerIds;
      console.log(`[OneSignalService] 📤 Sending with playerIds: ${playerIds.join(', ')}`);
    } else {
      // Fallback to external_user_ids (requires OneSignal.login() on client)
      notificationOptions.userIds = [String(userId)];
      console.log(`[OneSignalService] 📤 Sending with external_user_id: ${userId}`);
      console.warn(`[OneSignalService] ⚠️ Using external_user_id - make sure OneSignal.login() is called on client`);
    }
    
    const result = await this.sendNotification(notificationOptions);
    
    console.log(`[OneSignalService] 📥 sendToUser result:`, JSON.stringify(result, null, 2));
    return result;
  }
  
  async sendToPlayer(playerId, title, message, options = {}) {
    console.log(`[OneSignalService] sendToPlayer called:`, { playerId, title, message, options });
    
    const result = await this.sendNotification({
      playerIds: [String(playerId)],
      title,
      message,
      ...options
    });
    
    console.log(`[OneSignalService] sendToPlayer result:`, result);
    return result;
  }

  async sendToSegment(segment, title, message, options = {}) {
    return this.sendNotification({
      segments: [segment],
      title,
      message,
      ...options
    });
  }

  async sendToAll(title, message, options = {}) {
    return this.sendNotification({
      segments: ['All'],
      title,
      message,
      ...options
    });
  }

  async sendWithDeepLink(userIds, title, message, deepLink, options = {}) {
    return this.sendNotification({
      userIds: Array.isArray(userIds) ? userIds : [userIds],
      title,
      message,
      deepLink,
      ...options
    });
  }

  async makeRequest(endpoint, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      // Validate required fields
      if (!this.appId || this.appId.length < 10) {
        reject(new Error('OneSignal App ID is invalid'));
        return;
      }
      
      if (!this.apiKey || this.apiKey.length < 20) {
        reject(new Error('OneSignal API Key is invalid'));
        return;
      }
      
      const url = new URL(`${this.baseUrl}${endpoint}`);
      
      // OneSignal REST API authentication
      // For v2 API keys (os_v2_app_...), use "Key" prefix format
      // Format: Authorization: Key YOUR_REST_API_KEY
      // IMPORTANT: API key should NOT have any spaces, quotes, or special characters
      // Remove ALL non-printable characters, quotes, and whitespace
      const cleanApiKey = this.apiKey
        .trim()
        .replace(/^["']|["']$/g, '') // Remove surrounding quotes
        .replace(/[\r\n\t]/g, '') // Remove line breaks and tabs
        .replace(/[^\x20-\x7E]/g, '') // Remove non-printable characters
        .trim();
      
      // Validate cleaned key
      if (cleanApiKey.length !== this.apiKey.trim().replace(/^["']|["']$/g, '').trim().length) {
        console.warn('[OneSignalService] ⚠️ API Key contained hidden characters that were removed');
      }
      
      // OneSignal REST API authentication
      // Try multiple formats for compatibility
      // Format 1: Authorization: Key YOUR_REST_API_KEY (v2 API keys)
      // Format 2: Authorization: Basic base64(app_id:rest_api_key) (legacy)
      
      // Primary: Use "Key" prefix for v2 API keys
      let authHeader = `Key ${cleanApiKey}`;
      
      // Fallback: Try Basic Auth format if Key format fails (will be handled in error handler)
      const basicAuth = Buffer.from(`${this.appId}:${cleanApiKey}`).toString('base64');
      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        // Add User-Agent for better compatibility
        'User-Agent': 'BAVAXE-Backend/2.0.0'
      };
      
      // Log authentication details for debugging (only for notification requests or test calls)
      if (endpoint === '/notifications' || endpoint.includes('/apps/')) {
        console.log('[OneSignalService] 🔐 Auth header format:', `Key ${cleanApiKey.substring(0, 15)}...`);
        console.log('[OneSignalService] 🔐 API Key length:', cleanApiKey.length);
        console.log('[OneSignalService] 🔐 API Key starts with:', cleanApiKey.substring(0, 10));
        console.log('[OneSignalService] 🔐 API Key ends with:', '...' + cleanApiKey.substring(cleanApiKey.length - 10));
        console.log('[OneSignalService] 🔐 Full API Key (first 50 chars):', cleanApiKey.substring(0, 50) + '...');
        console.log('[OneSignalService] 🔐 Full API Key (last 50 chars):', '...' + cleanApiKey.substring(cleanApiKey.length - 50));
        console.log('[OneSignalService] 🔐 Auth Header:', `Key ${cleanApiKey.substring(0, 20)}...`);
      }

      let bodyString = null;
      if (body) {
        try {
          // Ensure app_id is in body if it's a POST request to /notifications
          if (method === 'POST' && endpoint === '/notifications' && body && !body.app_id) {
            body.app_id = this.appId;
            console.log('[OneSignalService] Added app_id to body:', this.appId);
          }
          
          bodyString = JSON.stringify(body);
          headers['Content-Length'] = Buffer.byteLength(bodyString);
          
          // Log request for debugging
          console.log('[OneSignalService] Request body length:', bodyString.length);
          console.log('[OneSignalService] Request body preview:', bodyString.substring(0, 200));
        } catch (error) {
          reject(new Error(`Failed to stringify request body: ${error.message}`));
          return;
        }
      }
      
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + (url.search || ''),
        method: method,
        headers: headers,
        timeout: this.requestTimeout
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (!data) {
              reject(new Error(`OneSignal API returned empty response (${res.statusCode})`));
              return;
            }
            
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              const errorMsg = parsed.errors?.join(', ') || parsed.message || data || 'Unknown error';
              console.error('[OneSignalService] ❌ API Error Response:', {
                statusCode: res.statusCode,
                errors: parsed.errors,
                message: parsed.message,
                endpoint: endpoint,
                method: method,
                apiKeyPrefix: this.apiKey.substring(0, 20) + '...',
                appId: this.appId
              });
              
              // Special handling for 403 errors (authentication issues)
              if (res.statusCode === 403) {
                console.error('[OneSignalService] ❌ 403 Forbidden - Authentication failed');
                console.error('[OneSignalService] 💡 Troubleshooting Steps:');
                console.error('[OneSignalService]   1. Go to OneSignal Dashboard → Settings → Keys & IDs');
                console.error('[OneSignalService]   2. Copy the REST API Key (starts with "os_v2_app_" or similar)');
                console.error('[OneSignalService]   3. Set environment variable: ONESIGNAL_REST_API_KEY=your_key_here');
                console.error('[OneSignalService]   4. Restart backend server');
                console.error('[OneSignalService]   5. Verify App ID matches: ' + this.appId);
                console.error('[OneSignalService]   6. Current API Key prefix:', this.apiKey.substring(0, 30) + '...');
                console.error('[OneSignalService]   7. API Key length:', this.apiKey.length);
                console.error('[OneSignalService]   8. Make sure API Key is NOT wrapped in quotes in .env file');
              }
              
              reject(new Error(`OneSignal API error (${res.statusCode}): ${errorMsg}`));
            }
          } catch (error) {
            console.error('[OneSignalService] Failed to parse response:', {
              error: error.message,
              responseData: data.substring(0, 500),
              statusCode: res.statusCode
            });
            reject(new Error(`Failed to parse response: ${data.substring(0, 200)}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('[OneSignalService] Request error:', error);
        reject(new Error(`OneSignal request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('OneSignal request timeout'));
      });

      if (bodyString) {
        req.write(bodyString);
      }

      req.end();
    });
  }

  async getNotificationStatus(notificationId) {
    try {
      const response = await this.makeRequest(`/notifications/${notificationId}?app_id=${this.appId}`);
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testApiKey() {
    try {
      if (!this.enabled) {
        return { success: false, error: 'OneSignal service is disabled' };
      }
      
      // First, try to get app info (simpler endpoint)
      // If that fails, the API key is definitely wrong
      console.log('[OneSignalService] 🧪 Testing API key with app info endpoint...');
      const response = await this.makeRequest(`/apps/${this.appId}`, 'GET');
      console.log('[OneSignalService] ✅ API Key test successful - App is accessible');
      return { success: true, data: response };
    } catch (error) {
      console.error('[OneSignalService] ❌ API Key test failed:', error.message);
      
      // Provide more specific error guidance
      if (error.message.includes('403') || error.message.includes('Access denied')) {
        console.error('\n[OneSignalService] ⚠️  ⚠️  ⚠️  API KEY AUTHENTICATION FAILED ⚠️  ⚠️  ⚠️');
        console.error('[OneSignalService]');
        console.error('[OneSignalService] 🔴 CRITICAL: OneSignal API key is invalid or expired');
        console.error('[OneSignalService]');
        console.error('[OneSignalService] 📋 Current Configuration:');
        console.error(`[OneSignalService]    App ID: ${this.appId}`);
        console.error(`[OneSignalService]    API Key Prefix: ${this.apiKey.substring(0, 25)}...`);
        console.error(`[OneSignalService]    API Key Length: ${this.apiKey.length} characters`);
        console.error('[OneSignalService]');
        console.error('[OneSignalService] 🔍 Possible Causes:');
        console.error('[OneSignalService]    1. ❌ API Key is incorrect or expired');
        console.error('[OneSignalService]    2. ❌ API Key was copied incorrectly (extra spaces/characters)');
        console.error('[OneSignalService]    3. ❌ API Key belongs to a different OneSignal app');
        console.error('[OneSignalService]    4. ❌ API Key has been revoked in OneSignal dashboard');
        console.error('[OneSignalService]    5. ❌ App ID and API Key do not match');
        console.error('[OneSignalService]');
        console.error('[OneSignalService] ✅ SOLUTION - Follow these steps:');
        console.error('[OneSignalService]');
        console.error('[OneSignalService]    STEP 1: Go to OneSignal Dashboard');
        console.error('[OneSignalService]            → https://onesignal.com');
        console.error('[OneSignalService]            → Login and select your app');
        console.error('[OneSignalService]');
        console.error('[OneSignalService]    STEP 2: Get REST API Key');
        console.error('[OneSignalService]            → Settings → Keys & IDs');
        console.error('[OneSignalService]            → Find "REST API Key" section');
        console.error('[OneSignalService]            → Click "Copy" button (NOT "Show")');
        console.error('[OneSignalService]');
        console.error('[OneSignalService]    STEP 3: Update .env file');
        console.error('[OneSignalService]            → Open: backend/.env');
        console.error('[OneSignalService]            → Find: ONESIGNAL_REST_API_KEY=...');
        console.error('[OneSignalService]            → Replace with: ONESIGNAL_REST_API_KEY=paste_key_here');
        console.error('[OneSignalService]            → ⚠️  NO QUOTES around the key');
        console.error('[OneSignalService]            → ⚠️  NO SPACES before or after');
        console.error('[OneSignalService]');
        console.error('[OneSignalService]    STEP 4: Verify App ID matches');
        console.error(`[OneSignalService]            → Current App ID: ${this.appId}`);
        console.error('[OneSignalService]            → Should match OneSignal Dashboard');
        console.error('[OneSignalService]');
        console.error('[OneSignalService]    STEP 5: Restart backend');
        console.error('[OneSignalService]            → Stop server (Ctrl+C)');
        console.error('[OneSignalService]            → Run: npm start');
        console.error('[OneSignalService]');
        console.error('[OneSignalService] ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️');
        console.error('');
      }
      
      // Don't disable service on test failure, just log it
      return { success: false, error: error.message };
    }
  }

  getStatus() {
    return {
      enabled: this.enabled,
      appId: this.appId,
      apiKeyConfigured: !!this.apiKey && this.apiKey.length > 20 && this.apiKey !== 'YOUR_ONESIGNAL_REST_API_KEY',
      apiKeyPrefix: this.apiKey ? this.apiKey.substring(0, 15) + '...' : 'Not configured',
      baseUrl: this.baseUrl,
      maxRetries: this.maxRetries,
      requestTimeout: this.requestTimeout
    };
  }
}

module.exports = new OneSignalService();

