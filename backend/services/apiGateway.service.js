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
      },
      csharp: {
        baseUrl: process.env.CSHARP_SERVICE_URL || 'http://localhost:6000',
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

    if (breaker.failures >= breaker.threshold) {
      breaker.state = 'open';
      setTimeout(() => {
        breaker.state = 'half-open';
        breaker.failures = 0;
      }, breaker.timeout);
    }
  }

  handleServiceSuccess(serviceName) {
    const breaker = this.circuitBreakers[serviceName];
    if (!breaker) return;

    breaker.successCount++;
    if (breaker.state === 'half-open' && breaker.successCount >= 2) {
      breaker.state = 'closed';
      breaker.failures = 0;
      breaker.successCount = 0;
    }
  }

  async routeRequest(serviceName, endpoint, options = {}) {
    const service = this.services[serviceName];
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    const breaker = this.circuitBreakers[serviceName];
    if (breaker.state === 'open') {
      throw new Error(`Service ${serviceName} circuit breaker is open`);
    }

    try {
      const url = `${service.baseUrl}${endpoint}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), service.timeout);

      const fetchOptions = {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
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
        throw new Error(`Service ${serviceName} returned ${response.status}: ${errorText}`);
      }

      this.handleServiceSuccess(serviceName);
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return await response.text();
    } catch (error) {
      if (error.name === 'AbortError') {
        this.handleServiceFailure(serviceName);
        throw new Error(`Service ${serviceName} request timeout`);
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
    return await this.routeRequest('csharp', '/api/reports/generate', {
      method: 'POST',
      body: JSON.stringify({ 
        user_id: userId, 
        report_type: reportType,
        date_range: dateRange,
        format: format
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async listReports(userId) {
    return await this.routeRequest('csharp', `/api/reports/list?user_id=${userId}`, {
      method: 'GET'
    });
  }

  async getServiceStatus() {
    const status = {};
    for (const serviceName of Object.keys(this.services)) {
      const isHealthy = await this.checkServiceHealth(serviceName);
      const breaker = this.circuitBreakers[serviceName];
      status[serviceName] = {
        healthy: isHealthy,
        circuitBreaker: breaker.state,
        failures: breaker.failures,
        baseUrl: this.services[serviceName].baseUrl
      };
    }
    return status;
  }
}

module.exports = new ApiGatewayService();
