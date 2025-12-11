/**
 * Startup Service
 * Handles application startup and initialization
 */

const { logger } = require('../utils/logger');

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

    for (const service of this.services) {
      try {
        logger.info(`Initializing service: ${service.name}`);
        const serviceStartTime = Date.now();
        
        await service.initFn();
        
        service.initialized = true;
        const duration = Date.now() - serviceStartTime;
        logger.info(`✅ Service ${service.name} initialized in ${duration}ms`);
      } catch (error) {
        service.error = error.message;
        logger.error(`❌ Failed to initialize service ${service.name}:`, error);
      }
    }

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
      logger.warn(`Failed services: ${failedServices}`);
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
   */
  isReady() {
    if (!this.initialized) return false;
    
    const criticalServices = this.services.filter(s => s.priority >= 10);
    return criticalServices.every(s => s.initialized);
  }
}

module.exports = new StartupService();

