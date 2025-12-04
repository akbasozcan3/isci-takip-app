const https = require('https');

class OneSignalService {
  constructor() {
    this.appId = process.env.ONESIGNAL_APP_ID || '4a846145-621c-4a0d-a29f-0598da946c50';
    this.apiKey = process.env.ONESIGNAL_REST_API_KEY || '';
    this.baseUrl = 'https://onesignal.com/api/v1';
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
    if (!this.apiKey) {
      console.warn('[OneSignal] REST API Key not configured. Set ONESIGNAL_REST_API_KEY in environment variables.');
      return { success: false, error: 'OneSignal API Key not configured' };
    }

    if (!userIds.length && !segments.length) {
      return { success: false, error: 'Either userIds or segments must be provided' };
    }

    const notification = {
      app_id: this.appId,
      headings: { en: title },
      contents: { en: message },
      priority: priority,
      sound: sound,
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
      notification.include_external_user_ids = userIds;
    }

    if (segments.length > 0) {
      notification.included_segments = segments;
    }

    if (deepLink) {
      notification.url = deepLink;
    } else if (url) {
      notification.url = url;
    }

    try {
      const response = await this.makeRequest('/notifications', 'POST', notification);
      return { success: true, data: response };
    } catch (error) {
      console.error('[OneSignal] Error sending notification:', error);
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
      
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + (url.search || ''),
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${authHeader}`
        },
        timeout: 30000
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

      if (body) {
        req.write(JSON.stringify(body));
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

