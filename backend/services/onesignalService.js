const https = require('https');

class OneSignalService {
  constructor() {
    this.appId = process.env.ONESIGNAL_APP_ID || '4a846145-621c-4a0d-a29f-0598da946c50';
    this.apiKey = process.env.ONESIGNAL_REST_API_KEY || 'os_v2_app_jkcgcrlcdrfa3iu7awmnvfdmkcctfawalebefpvzgzqmeqr6i366rzjtwoznrcj4f733oxeaavwcxvyh6b63d6w36wl2i57cc5wjyri';
    this.baseUrl = 'https://onesignal.com/api/v1';
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.requestTimeout = 30000;
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
    if (!this.apiKey || this.apiKey === 'YOUR_ONESIGNAL_REST_API_KEY') {
      return { success: false, error: 'OneSignal API Key not configured' };
    }

    if (!userIds.length && !segments.length) {
      return { success: false, error: 'Either userIds or segments must be provided' };
    }

    if (!title || !message) {
      return { success: false, error: 'Title and message are required' };
    }

    const notification = {
      app_id: this.appId,
      headings: { en: String(title).substring(0, 100) },
      contents: { en: String(message).substring(0, 500) },
      priority: Math.min(Math.max(priority, 0), 10),
      sound: sound,
      android_channel_id: 'default',
      android_visibility: 1,
      android_accent_color: 'FF14B8A6',
      data: {
        ...data,
        ...(deepLink ? { deepLink, url: deepLink } : {}),
        ...(url ? { url } : {})
      },
      ...(imageUrl ? { big_picture: imageUrl } : {}),
      ...(buttons ? { buttons } : {}),
      ...(badge ? { badge } : {})
    };

    if (userIds.length > 0) {
      notification.include_external_user_ids = userIds.map(String).slice(0, 2000);
    }

    if (segments.length > 0) {
      notification.included_segments = segments.slice(0, 10);
    }

    if (deepLink) {
      notification.url = deepLink;
    } else if (url) {
      notification.url = url;
    }

    try {
      const response = await this.sendWithRetry(() => 
        this.makeRequest('/notifications', 'POST', notification)
      );
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sendToUser(userId, title, message, options = {}) {
    return this.sendNotification({
      userIds: [String(userId)],
      title,
      message,
      ...options
    });
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
      const url = new URL(`${this.baseUrl}${endpoint}`);
      const authHeader = Buffer.from(`${this.apiKey}:`).toString('base64');
      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authHeader}`
      };

      let bodyString = null;
      if (body) {
        bodyString = JSON.stringify(body);
        headers['Content-Length'] = Buffer.byteLength(bodyString);
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
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              const errorMsg = parsed.errors?.join(', ') || parsed.message || data || 'Unknown error';
              reject(new Error(`OneSignal API error (${res.statusCode}): ${errorMsg}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data.substring(0, 200)}`));
          }
        });
      });

      req.on('error', (error) => {
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
}

module.exports = new OneSignalService();

