let logger;
try {
  const { getLogger } = require('../utils/loggerHelper');
  logger = getLogger('RetryService');
} catch (err) {
  logger = {
    warn: (...args) => console.warn('[RetryService]', ...args),
    error: (...args) => console.error('[RetryService]', ...args),
    info: (...args) => console.log('[RetryService]', ...args),
    debug: (...args) => console.debug('[RetryService]', ...args)
  };
}

class RetryService {
  async execute(fn, options = {}) {
    const {
      maxRetries = 3,
      delay = 1000,
      backoff = 'exponential',
      onRetry = null,
      shouldRetry = null
    } = options;

    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (shouldRetry && !shouldRetry(error, attempt)) {
          throw error;
        }
        
        if (attempt === maxRetries) {
          logger.error('Max retries exceeded', error, {
            maxRetries,
            attempt: attempt + 1
          });
          throw error;
        }
        
        const waitTime = this.calculateDelay(delay, attempt, backoff);
        
        if (onRetry) {
          onRetry(error, attempt + 1, waitTime);
        }
        
        logger.warn('Retrying operation', {
          attempt: attempt + 1,
          maxRetries,
          waitTime: `${waitTime}ms`,
          error: error.message
        });
        
        await this.sleep(waitTime);
      }
    }
    
    throw lastError;
  }

  calculateDelay(baseDelay, attempt, backoff) {
    switch (backoff) {
      case 'exponential':
        return baseDelay * Math.pow(2, attempt);
      case 'linear':
        return baseDelay * (attempt + 1);
      case 'fixed':
      default:
        return baseDelay;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new RetryService();

