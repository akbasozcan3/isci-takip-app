/**
 * Startup Service
 * Handles application startup and initialization
 */

let logger;
try {
  const loggerModule = require('../utils/logger');
  logger = loggerModule.logger || loggerModule;
} catch (err) {
  logger = {
    info: (...args) => console.log('[StartupService]', ...args),
    warn: (...args) => console.warn('[StartupService]', ...args),
    error: (...args) => console.error('[StartupService]', ...args),
  };
}

class StartupService {
  constructor() {
    this.initialized = false;
    this.services = [];
    this.startTime = Date.now();
    this.initializationPromise = null;
  }

  /**
   * Register a service for initialization
   */
  registerService(name, initFn, priority = 0) {
    this.services.push({
      name,
      initFn,
      priority,
      initialized: false,
      error: null,
    });
    
    // Sort by priority (higher first)
    this.services.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Initialize all services
   */
  async initialize() {
    if (this.initialized) {
      logger.warn('Startup service already initialized');
      return;
    }

    logger.info('Starting application initialization...');
    const initStartTime = Date.now();

    // Initialize services in parallel for faster startup (non-blocking)
    const initPromises = this.services.map(async (service) => {
      try {
        logger.info(`Initializing service: ${service.name}`);
        const serviceStartTime = Date.now();
        
        await service.initFn();
        
        service.initialized = true;
        const duration = Date.now() - serviceStartTime;
        logger.info(`✅ Service ${service.name} initialized in ${duration}ms`);
      } catch (error) {
        service.error = error.message;
        // In development, don't fail completely on service errors
        const isDevelopment = process.env.NODE_ENV !== 'production';
        if (isDevelopment) {
          logger.warn(`⚠️  Service ${service.name} failed but continuing (dev mode):`, error.message);
        } else {
          logger.error(`❌ Failed to initialize service ${service.name}:`, error);
        }
      }
    });

    // Wait for all services to initialize (or fail gracefully)
    await Promise.allSettled(initPromises);

    this.initialized = true;
    const totalDuration = Date.now() - initStartTime;
    logger.info(`Application initialization completed in ${totalDuration}ms`);

    // Log summary
    const successful = this.services.filter(s => s.initialized).length;
    const failed = this.services.filter(s => !s.initialized).length;
    
    logger.info(`Initialization summary: ${successful} successful, ${failed} failed`);
    
    if (failed > 0) {
      const failedServices = this.services
        .filter(s => !s.initialized)
        .map(s => `${s.name} (${s.error})`)
        .join(', ');
      const isDevelopment = process.env.NODE_ENV !== 'production';
      if (isDevelopment) {
        logger.warn(`Failed services (non-critical in dev): ${failedServices}`);
      } else {
        logger.warn(`Failed services: ${failedServices}`);
      }
    }
  }

  /**
   * Get initialization status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      startTime: this.startTime,
      initializationTime: this.initialized ? Date.now() - this.startTime : null,
      services: this.services.map(s => ({
        name: s.name,
        initialized: s.initialized,
        error: s.error,
      })),
      summary: {
        total: this.services.length,
        successful: this.services.filter(s => s.initialized).length,
        failed: this.services.filter(s => !s.initialized).length,
      },
    };
  }

  /**
   * Check if all critical services are initialized
   * In development, be more lenient - only require database
   */
  isReady() {
    // If initialization hasn't started yet, allow requests (graceful degradation)
    if (!this.initialized && this.services.length === 0) {
      return true;
    }
    
    // If not initialized yet, check if enough time has passed
    if (!this.initialized) {
      const elapsed = Date.now() - this.startTime;
      const isDevelopment = process.env.NODE_ENV !== 'production';
      // In dev mode, allow after 1 second, in prod wait for initialization
      return isDevelopment && elapsed > 1000;
    }
    
    // Check critical services (priority >= 10)
    const criticalServices = this.services.filter(s => s.priority >= 10);
    if (criticalServices.length === 0) {
      // No critical services registered, consider ready
      return true;
    }
    
    // In development, only require database service
    const isDevelopment = process.env.NODE_ENV !== 'production';
    if (isDevelopment) {
      const databaseService = this.services.find(s => s.name === 'Database' || s.name === 'Database Service');
      if (databaseService) {
        return databaseService.initialized;
      }
      // If no database service registered, allow anyway
      return true;
    }
    
    // In production, require all critical services
    return criticalServices.every(s => s.initialized);
  }
}

module.exports = new StartupService();

