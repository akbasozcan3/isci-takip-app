/**
 * Professional Messaging Service
 * Centralized messaging service with queue support
 */

const db = require('../config/database');
const notificationService = require('./notificationService');
const queueService = require('./queueService');
const { logger } = require('../core/utils/logger');

class MessagingService {
  constructor() {
    this.messageQueue = [];
    this.processing = false;
    this.startQueueProcessor();
  }

  /**
   * Start queue processor
   */
  startQueueProcessor() {
    setInterval(() => {
      if (this.messageQueue.length > 0 && !this.processing) {
        this.processQueue();
      }
    }, 1000); // Process every second
  }

  /**
   * Process message queue
   */
  async processQueue() {
    if (this.processing || this.messageQueue.length === 0) {
      return;
    }

    this.processing = true;
    const batch = this.messageQueue.splice(0, 10); // Process 10 at a time

    for (const messageTask of batch) {
      try {
        await this.processMessage(messageTask);
      } catch (error) {
        logger.error('Message queue processing error', { error: error.message, messageTask });
      }
    }

    this.processing = false;
  }

  /**
   * Process a single message
   */
  async processMessage(messageTask) {
    const { message, io, socket } = messageTask;
    
    // Save to database
    if (!db.data.messages) {
      db.data.messages = {};
    }

    const userId = message.senderId;
    if (!db.data.messages[userId]) {
      db.data.messages[userId] = [];
    }
    db.data.messages[userId].push(message);

    // Save to recipients
    if (message.groupId) {
      const group = db.findGroupById(message.groupId);
      if (group && group.members) {
        for (const memberId of group.members) {
          if (memberId !== userId) {
            if (!db.data.messages[memberId]) {
              db.data.messages[memberId] = [];
            }
            db.data.messages[memberId].push({
              ...message,
              status: 'received'
            });
          }
        }
      }
    } else if (message.recipientId) {
      if (!db.data.messages[message.recipientId]) {
        db.data.messages[message.recipientId] = [];
      }
      db.data.messages[message.recipientId].push({
        ...message,
        status: 'received'
      });
    }

    db.scheduleSave();

    // Emit via Socket.IO
    if (io) {
      if (message.groupId) {
        io.to(`group-${message.groupId}`).emit('new_message', message);
      } else if (message.recipientId) {
        io.to(`user-${message.recipientId}`).emit('new_message', message);
      }
    }

    // Send push notification
    if (message.recipientId) {
      try {
        await notificationService.send(message.recipientId, {
          title: 'Yeni Mesaj',
          message: message.message.substring(0, 100),
          type: 'message',
          data: {
            messageId: message.id,
            senderId: message.senderId,
            type: 'direct_message'
          }
        }, ['database', 'onesignal']);
      } catch (notifError) {
        logger.warn('Message notification error', { error: notifError.message });
      }
    }
  }

  /**
   * Queue message for processing
   */
  queueMessage(message, io, socket) {
    this.messageQueue.push({ message, io, socket });
  }

  /**
   * Send message immediately (synchronous)
   */
  async sendMessage(messageData, io) {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const timestamp = Date.now();

    const message = {
      id: messageId,
      ...messageData,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await this.processMessage({ message, io, socket: null });
    return message;
  }

  /**
   * Get message statistics
   */
  getStats() {
    if (!db.data.messages) {
      return {
        totalMessages: 0,
        totalConversations: 0,
        messagesByType: {},
        queueLength: this.messageQueue.length
      };
    }

    const stats = {
      totalMessages: 0,
      totalConversations: 0,
      messagesByType: {},
      queueLength: this.messageQueue.length
    };

    const conversations = new Set();

    for (const userId in db.data.messages) {
      const messages = db.data.messages[userId];
      stats.totalMessages += messages.length;

      for (const msg of messages) {
        // Count by type
        stats.messagesByType[msg.type] = (stats.messagesByType[msg.type] || 0) + 1;

        // Count conversations
        if (msg.groupId) {
          conversations.add(`group-${msg.groupId}`);
        } else if (msg.recipientId) {
          const key = [msg.senderId, msg.recipientId].sort().join('-');
          conversations.add(key);
        }
      }
    }

    stats.totalConversations = conversations.size;
    return stats;
  }
}

module.exports = new MessagingService();

