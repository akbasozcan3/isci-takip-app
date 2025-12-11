/**
 * Professional Messaging Controller
 * Real-time messaging system with Socket.IO integration
 */

const ResponseFormatter = require('../core/utils/responseFormatter');
const { logger } = require('../core/utils/logger');
const db = require('../config/database');
const notificationService = require('../services/notificationService');
const activityLogService = require('../services/activityLogService');

class MessagingController {
  /**
   * Send a message
   */
  async sendMessage(req, res) {
    try {
      const userId = req.user?.id;
      const { recipientId, recipientPhone, groupId, message, type = 'text', metadata = {} } = req.body;

      if (!message || message.trim().length === 0) {
        return res.status(400).json(
          ResponseFormatter.validationError([{
            field: 'message',
            message: 'Message is required'
          }])
        );
      }

      if (!recipientId && !recipientPhone && !groupId) {
        return res.status(400).json(
          ResponseFormatter.validationError([{
            field: 'recipient',
            message: 'Either recipientId, recipientPhone, or groupId is required'
          }])
        );
      }

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const timestamp = Date.now();

      const messageData = {
        id: messageId,
        senderId: userId,
        recipientId: recipientId || null,
        recipientPhone: recipientPhone || null,
        groupId: groupId || null,
        message: message.trim(),
        type: type, // text, location, image, file, system
        status: 'sent',
        read: false,
        readAt: null,
        metadata: metadata,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      // Save message to database
      if (!db.data.messages) {
        db.data.messages = {};
      }
      if (!db.data.messages[userId]) {
        db.data.messages[userId] = [];
      }
      db.data.messages[userId].push(messageData);
      db.scheduleSave();

      // If group message, save to all members
      if (groupId) {
        const group = db.findGroupById(groupId);
        if (group && group.members) {
          for (const memberId of group.members) {
            if (memberId !== userId) {
              if (!db.data.messages[memberId]) {
                db.data.messages[memberId] = [];
              }
              db.data.messages[memberId].push({
                ...messageData,
                status: 'received'
              });
            }
          }
          db.scheduleSave();
        }
      } else if (recipientId) {
        // Direct message - save to recipient
        if (!db.data.messages[recipientId]) {
          db.data.messages[recipientId] = [];
        }
        db.data.messages[recipientId].push({
          ...messageData,
          status: 'received'
        });
        db.scheduleSave();
      }

      // Emit via Socket.IO if available
      const io = req.app.get('io');
      if (io) {
        if (groupId) {
          // Broadcast to group
          io.to(`group-${groupId}`).emit('new_message', {
            ...messageData,
            sender: {
              id: userId,
              name: req.user?.name || req.user?.displayName || 'Unknown'
            }
          });
        } else if (recipientId) {
          // Send to specific recipient
          io.to(`user-${recipientId}`).emit('new_message', {
            ...messageData,
            sender: {
              id: userId,
              name: req.user?.name || req.user?.displayName || 'Unknown'
            }
          });
        }
      }

      // Send push notification
      if (recipientId) {
        try {
          const recipient = db.findUserById(recipientId);
          if (recipient) {
            await notificationService.send(recipientId, {
              title: req.user?.name || req.user?.displayName || 'Yeni Mesaj',
              message: message.trim().substring(0, 100),
              type: 'message',
              data: {
                messageId,
                senderId: userId,
                type: 'direct_message'
              },
              deepLink: `bavaxe://messages/${messageId}`
            }, ['database', 'onesignal']);
          }
        } catch (notifError) {
          logger.warn('Message notification error', { error: notifError.message });
        }
      }

      // Log activity
      activityLogService.logActivity(userId, 'messaging', 'send_message', {
        messageId,
        recipientId,
        groupId,
        type,
        path: req.path
      });

      return res.json(ResponseFormatter.success({
        message: messageData
      }, 'Mesaj başarıyla gönderildi'));
    } catch (error) {
      logger.error('sendMessage error', error);
      return res.status(500).json(
        ResponseFormatter.error('Mesaj gönderilemedi', 'MESSAGE_SEND_ERROR', { message: error.message })
      );
    }
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(req, res) {
    try {
      const userId = req.user?.id;
      const { recipientId, groupId, limit = 50, before } = req.query;

      if (!recipientId && !groupId) {
        return res.status(400).json(
          ResponseFormatter.validationError([{
            field: 'recipient',
            message: 'Either recipientId or groupId is required'
          }])
        );
      }

      let messages = [];
      if (db.data.messages && db.data.messages[userId]) {
        messages = db.data.messages[userId].filter(msg => {
          if (groupId) {
            return msg.groupId === groupId;
          } else if (recipientId) {
            return (msg.recipientId === recipientId && msg.senderId === userId) ||
                   (msg.senderId === recipientId && msg.recipientId === userId);
          }
          return false;
        });
      }

      // Sort by timestamp (newest first)
      messages.sort((a, b) => b.createdAt - a.createdAt);

      // Apply pagination
      if (before) {
        const beforeTimestamp = parseInt(before, 10);
        messages = messages.filter(msg => msg.createdAt < beforeTimestamp);
      }

      messages = messages.slice(0, parseInt(limit, 10));

      // Reverse to show oldest first
      messages.reverse();

      return res.json(ResponseFormatter.paginated(
        messages,
        req.query.page || 1,
        parseInt(limit, 10),
        messages.length
      ));
    } catch (error) {
      logger.error('getMessages error', error);
      return res.status(500).json(
        ResponseFormatter.error('Mesajlar alınamadı', 'MESSAGES_FETCH_ERROR', { message: error.message })
      );
    }
  }

  /**
   * Get all conversations
   */
  async getConversations(req, res) {
    try {
      const userId = req.user?.id;
      const conversations = new Map();

      if (db.data.messages && db.data.messages[userId]) {
        const messages = db.data.messages[userId];

        for (const msg of messages) {
          let conversationKey;
          let otherUserId;

          if (msg.groupId) {
            conversationKey = `group-${msg.groupId}`;
            const group = db.findGroupById(msg.groupId);
            if (group) {
              conversations.set(conversationKey, {
                id: conversationKey,
                type: 'group',
                groupId: msg.groupId,
                groupName: group.name,
                lastMessage: msg.message,
                lastMessageAt: msg.createdAt,
                unreadCount: msg.read === false ? 1 : 0,
                participants: group.members || []
              });
            }
          } else if (msg.recipientId) {
            otherUserId = msg.senderId === userId ? msg.recipientId : msg.senderId;
            conversationKey = `user-${otherUserId}`;
            
            const existing = conversations.get(conversationKey);
            if (!existing || msg.createdAt > existing.lastMessageAt) {
              const otherUser = db.findUserById(otherUserId);
              conversations.set(conversationKey, {
                id: conversationKey,
                type: 'direct',
                userId: otherUserId,
                userName: otherUser?.name || otherUser?.displayName || 'Unknown',
                lastMessage: msg.message,
                lastMessageAt: msg.createdAt,
                unreadCount: (existing?.unreadCount || 0) + (msg.read === false ? 1 : 0)
              });
            } else if (msg.read === false) {
              existing.unreadCount = (existing.unreadCount || 0) + 1;
            }
          }
        }
      }

      const conversationsList = Array.from(conversations.values());
      conversationsList.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

      return res.json(ResponseFormatter.success({
        conversations: conversationsList
      }));
    } catch (error) {
      logger.error('getConversations error', error);
      return res.status(500).json(
        ResponseFormatter.error('Konuşmalar alınamadı', 'CONVERSATIONS_FETCH_ERROR', { message: error.message })
      );
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(req, res) {
    try {
      const userId = req.user?.id;
      const { messageId } = req.params;

      if (!db.data.messages || !db.data.messages[userId]) {
        return res.status(404).json(
          ResponseFormatter.error('Mesaj bulunamadı', 'MESSAGE_NOT_FOUND')
        );
      }

      const message = db.data.messages[userId].find(msg => msg.id === messageId);
      if (!message) {
        return res.status(404).json(
          ResponseFormatter.error('Mesaj bulunamadı', 'MESSAGE_NOT_FOUND')
        );
      }

      message.read = true;
      message.readAt = Date.now();
      db.scheduleSave();

      // Emit read receipt via Socket.IO
      const io = req.app.get('io');
      if (io && message.senderId) {
        io.to(`user-${message.senderId}`).emit('message_read', {
          messageId,
          readAt: message.readAt
        });
      }

      activityLogService.logActivity(userId, 'messaging', 'mark_read', {
        messageId,
        path: req.path
      });

      return res.json(ResponseFormatter.success({
        message: {
          id: messageId,
          read: true,
          readAt: message.readAt
        }
      }, 'Mesaj okundu olarak işaretlendi'));
    } catch (error) {
      logger.error('markAsRead error', error);
      return res.status(500).json(
        ResponseFormatter.error('Mesaj işaretlenemedi', 'MESSAGE_MARK_ERROR', { message: error.message })
      );
    }
  }

  /**
   * Mark all messages as read in a conversation
   */
  async markAllAsRead(req, res) {
    try {
      const userId = req.user?.id;
      const { recipientId, groupId } = req.body;

      if (!recipientId && !groupId) {
        return res.status(400).json(
          ResponseFormatter.validationError([{
            field: 'recipient',
            message: 'Either recipientId or groupId is required'
          }])
        );
      }

      if (!db.data.messages || !db.data.messages[userId]) {
        return res.json(ResponseFormatter.success({ count: 0 }));
      }

      let count = 0;
      const timestamp = Date.now();

      for (const msg of db.data.messages[userId]) {
        if (msg.read === false) {
          if (groupId && msg.groupId === groupId) {
            msg.read = true;
            msg.readAt = timestamp;
            count++;
          } else if (recipientId && (
            (msg.recipientId === recipientId && msg.senderId === userId) ||
            (msg.senderId === recipientId && msg.recipientId === userId)
          )) {
            msg.read = true;
            msg.readAt = timestamp;
            count++;
          }
        }
      }

      if (count > 0) {
        db.scheduleSave();
      }

      activityLogService.logActivity(userId, 'messaging', 'mark_all_read', {
        recipientId,
        groupId,
        count,
        path: req.path
      });

      return res.json(ResponseFormatter.success({
        count
      }, `${count} mesaj okundu olarak işaretlendi`));
    } catch (error) {
      logger.error('markAllAsRead error', error);
      return res.status(500).json(
        ResponseFormatter.error('Mesajlar işaretlenemedi', 'MESSAGES_MARK_ERROR', { message: error.message })
      );
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(req, res) {
    try {
      const userId = req.user?.id;
      const { messageId } = req.params;

      if (!db.data.messages || !db.data.messages[userId]) {
        return res.status(404).json(
          ResponseFormatter.error('Mesaj bulunamadı', 'MESSAGE_NOT_FOUND')
        );
      }

      const index = db.data.messages[userId].findIndex(msg => msg.id === messageId);
      if (index === -1) {
        return res.status(404).json(
          ResponseFormatter.error('Mesaj bulunamadı', 'MESSAGE_NOT_FOUND')
        );
      }

      const message = db.data.messages[userId][index];
      
      // Only allow deleting own messages
      if (message.senderId !== userId) {
        return res.status(403).json(
          ResponseFormatter.error('Bu mesajı silme yetkiniz yok', 'MESSAGE_DELETE_FORBIDDEN')
        );
      }

      db.data.messages[userId].splice(index, 1);
      db.scheduleSave();

      activityLogService.logActivity(userId, 'messaging', 'delete_message', {
        messageId,
        path: req.path
      });

      return res.json(ResponseFormatter.success(null, 'Mesaj başarıyla silindi'));
    } catch (error) {
      logger.error('deleteMessage error', error);
      return res.status(500).json(
        ResponseFormatter.error('Mesaj silinemedi', 'MESSAGE_DELETE_ERROR', { message: error.message })
      );
    }
  }
}

module.exports = new MessagingController();

