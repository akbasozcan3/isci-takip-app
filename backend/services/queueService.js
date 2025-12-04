class QueueService {
  constructor() {
    this.queues = new Map();
    this.processing = new Map();
    this.maxConcurrency = 5;
  }

  createQueue(name, processor, options = {}) {
    if (this.queues.has(name)) {
      return this.queues.get(name);
    }

    const queue = {
      name,
      items: [],
      processor,
      concurrency: options.concurrency || this.maxConcurrency,
      retries: options.retries || 3,
      delay: options.delay || 0
    };

    this.queues.set(name, queue);
    this.processing.set(name, 0);
    return queue;
  }

  async enqueue(queueName, item, priority = 0) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} does not exist`);
    }

    queue.items.push({ item, priority, attempts: 0, addedAt: Date.now() });
    queue.items.sort((a, b) => b.priority - a.priority);
    
    this.processQueue(queueName);
  }

  async processQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) return;

    const processing = this.processing.get(queueName);
    if (processing >= queue.concurrency) return;

    if (queue.items.length === 0) return;

    const job = queue.items.shift();
    this.processing.set(queueName, processing + 1);

    try {
      if (queue.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, queue.delay));
      }

      await queue.processor(job.item);
      job.attempts = queue.retries;
    } catch (error) {
      job.attempts++;
      if (job.attempts < queue.retries) {
        queue.items.unshift(job);
      } else {
        console.error(`[Queue ${queueName}] Job failed after ${queue.retries} attempts:`, error);
      }
    } finally {
      this.processing.set(queueName, this.processing.get(queueName) - 1);
      if (queue.items.length > 0) {
        setImmediate(() => this.processQueue(queueName));
      }
    }
  }

  getQueueStats(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) return null;

    return {
      name: queueName,
      pending: queue.items.length,
      processing: this.processing.get(queueName),
      concurrency: queue.concurrency
    };
  }

  getAllStats() {
    const stats = {};
    for (const name of this.queues.keys()) {
      stats[name] = this.getQueueStats(name);
    }
    return stats;
  }
}

module.exports = new QueueService();

