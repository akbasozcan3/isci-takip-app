const fetch = require('node-fetch');

class ApiGatewayService {
  constructor() {
    this.services = {
      nodejs: {
        baseUrl: process.env.NODEJS_SERVICE_URL || 'http://localhost:4000',
        health: '/api/health',
        timeout: 5000
      },
      python: {
        baseUrl: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
        health: '/health',
        timeout: 5000
      },
      go: {
        baseUrl: process.env.GO_SERVICE_URL || 'http://localhost:8080',
        health: '/health',
        timeout: 3000
      },
      php: {
        baseUrl: process.env.PHP_SERVICE_URL || 'http://localhost:9000',
        health: '/health',
        timeout: 5000
      },
      java: {
        baseUrl: process.env.JAVA_SERVICE_URL || 'http://localhost:7000',
        health: '/api/health',
        timeout: 5000
      }
    };
    this.circuitBreakers = {};
    this.initializeCircuitBreakers();
  }

  initializeCircuitBreakers() {
    Object.keys(this.services).forEach(serviceName => {
      this.circuitBreakers[serviceName] = {
        state: 'closed',
        failures: 0,
        lastFailure: null,
        successCount: 0,
        threshold: 5,
        timeout: 60000
      };
    });
  }

  async checkServiceHealth(serviceName) {
    const service = this.services[serviceName];
    if (!service) return false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), service.timeout);

      const response = await fetch(`${service.baseUrl}${service.health}`, {
        signal: controller.signal,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      this.handleServiceFailure(serviceName);
      return false;
    }
  }

  handleServiceFailure(serviceName) {
    const breaker = this.circuitBreakers[serviceName];
    if (!breaker) return;

    breaker.failures++;
    breaker.lastFailure = Date.now();
    breaker.successCount = 0;

    if (breaker.failures >= breaker.threshold) {
      breaker.state = 'open';
      setTimeout(() => {
        if (breaker.state === 'open') {
          breaker.state = 'half-open';
          breaker.failures = 0;
        }
      }, breaker.timeout);
    }
  }

  handleServiceSuccess(serviceName) {
    const breaker = this.circuitBreakers[serviceName];
    if (!breaker) return;

    breaker.failures = Math.max(0, breaker.failures - 1);
    breaker.successCount++;
    
    if (breaker.state === 'half-open') {
      if (breaker.successCount >= 2) {
        breaker.state = 'closed';
        breaker.failures = 0;
        breaker.successCount = 0;
      }
    } else if (breaker.state === 'closed' && breaker.failures > 0) {
      breaker.failures = 0;
    }
  }

  async routeRequest(serviceName, endpoint, options = {}) {
    const service = this.services[serviceName];
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    const breaker = this.circuitBreakers[serviceName];
    if (breaker.state === 'open') {
      if (Date.now() < breaker.lastFailure + breaker.timeout) {
        throw new Error(`Service ${serviceName} circuit breaker is open`);
      }
      breaker.state = 'half-open';
      breaker.failures = 0;
    }

    const url = `${service.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), service.timeout);

    try {
      const fetchOptions = {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ...options.headers
        }
      };

      if (options.body && typeof options.body === 'string') {
        fetchOptions.body = options.body;
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        const error = new Error(`Service ${serviceName} returned ${response.status}: ${errorText}`);
        error.statusCode = response.status;
        throw error;
      }

      this.handleServiceSuccess(serviceName);
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return await response.text();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        this.handleServiceFailure(serviceName);
        throw new Error(`Service ${serviceName} request timeout after ${service.timeout}ms`);
      }
      
      this.handleServiceFailure(serviceName);
      throw error;
    }
  }

  async getAnalytics(userId, dateRange) {
    return await this.routeRequest('python', `/api/analytics/${userId}`, {
      method: 'GET',
      headers: {
        'X-Date-Range': dateRange
      }
    });
  }

  async getReports(userId, reportType) {
    return await this.routeRequest('python', `/api/analytics/export/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ type: reportType }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async processLocationBatch(locations) {
    return await this.routeRequest('go', '/api/location/batch', {
      method: 'POST',
      body: JSON.stringify({ locations }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async processNotifications(userId, notifications) {
    return await this.routeRequest('php', '/api/notifications/process', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, notifications }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async getNotificationStats(userId) {
    return await this.routeRequest('php', `/api/notifications/stats?user_id=${userId}`, {
      method: 'GET'
    });
  }

  async processBilling(userId, plan, amount) {
    return await this.routeRequest('java', '/api/billing/process', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, plan, amount }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async getBillingHistory(userId) {
    return await this.routeRequest('java', `/api/billing/history?user_id=${userId}`, {
      method: 'GET'
    });
  }

  async generateReport(userId, reportType, dateRange, format) {
    return {
      user_id: userId,
      report_type: reportType,
      generated_at: new Date().toISOString(),
      data: {
        summary: {
          total_records: 0,
          date_range: dateRange || '7d',
          format: format || 'json'
        },
        sections: []
      },
      download_url: null
    };
  }

  async listReports(userId) {
    return {
      user_id: userId,
      available_reports: [],
      timestamp: new Date().toISOString()
    };
  }

  async getServiceStatus() {
    const status = {};
    const healthChecks = await Promise.allSettled(
      Object.keys(this.services).map(async (serviceName) => {
        const isHealthy = await this.checkServiceHealth(serviceName);
        const breaker = this.circuitBreakers[serviceName];
        return {
          name: serviceName,
          healthy: isHealthy,
          circuitBreaker: breaker.state,
          failures: breaker.failures,
          successCount: breaker.successCount,
          baseUrl: this.services[serviceName].baseUrl,
          lastFailure: breaker.lastFailure
        };
      })
    );

    healthChecks.forEach((result, index) => {
      const serviceName = Object.keys(this.services)[index];
      if (result.status === 'fulfilled') {
        status[serviceName] = result.value;
      } else {
        const breaker = this.circuitBreakers[serviceName];
        status[serviceName] = {
          healthy: false,
          circuitBreaker: breaker?.state || 'unknown',
          failures: breaker?.failures || 0,
          baseUrl: this.services[serviceName].baseUrl,
          error: result.reason?.message
        };
      }
    });

    return status;
  }
}

module.exports = new ApiGatewayService();
