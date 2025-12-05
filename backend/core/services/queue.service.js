const { createLogger } = require('../core/utils/logger');

const logger = createLogger('QueueService');

class QueueService {
  constructor() {
    this.queues = new Map();
    this.processing = new Map();
    this.maxConcurrency = 5;
    this.retryService = require('../core/services/retry.service');
  }

  createQueue(name, options = {}) {
    if (!this.queues.has(name)) {
      this.queues.set(name, {
        jobs: [],
        processing: 0,
        maxConcurrency: options.maxConcurrency || this.maxConcurrency,
        retry: options.retry || false,
        onError: options.onError || null
      });
      this.processing.set(name, new Set());
    }
    return this.queues.get(name);
  }

  async add(queueName, job, options = {}) {
    const queue = this.createQueue(queueName, options);
    
    const jobData = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data: job,
      priority: options.priority || 0,
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      createdAt: Date.now(),
      ...options
    };
    
    queue.jobs.push(jobData);
    queue.jobs.sort((a, b) => b.priority - a.priority);
    
    this.processQueue(queueName);
    
    return jobData.id;
  }

  async processQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) return;
    
    if (queue.processing >= queue.maxConcurrency) {
      return;
    }
    
    if (queue.jobs.length === 0) {
      return;
    }
    
    const job = queue.jobs.shift();
    queue.processing++;
    this.processing.get(queueName).add(job.id);
    
    try {
      if (queue.retry) {
        await this.retryService.execute(
          async () => await job.data(),
          {
            maxRetries: job.maxAttempts - 1,
            onRetry: (error, attempt, waitTime) => {
              logger.warn('Job retry', {
                queue: queueName,
                jobId: job.id,
                attempt,
                waitTime
              });
            }
          }
        );
      } else {
        await job.data();
      }
      
      logger.info('Job completed', {
        queue: queueName,
        jobId: job.id
      });
    } catch (error) {
      logger.error('Job failed', error, {
        queue: queueName,
        jobId: job.id,
        attempts: job.attempts
      });
      
      if (queue.onError) {
        queue.onError(error, job);
      }
      
      if (job.attempts < job.maxAttempts) {
        job.attempts++;
        queue.jobs.push(job);
      }
    } finally {
      queue.processing--;
      this.processing.get(queueName).delete(job.id);
      
      if (queue.jobs.length > 0) {
        setImmediate(() => this.processQueue(queueName));
      }
    }
  }

  getQueueStats(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) return null;
    
    return {
      name: queueName,
      pending: queue.jobs.length,
      processing: queue.processing,
      maxConcurrency: queue.maxConcurrency
    };
  }

  getAllStats() {
    const stats = {};
    for (const name of this.queues.keys()) {
      stats[name] = this.getQueueStats(name);
    }
    return stats;
  }

  clearQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (queue) {
      queue.jobs = [];
    }
  }
}

module.exports = new QueueService();

