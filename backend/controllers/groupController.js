const db = require('../config/database');
const validationService = require('../services/validationService');
const cacheService = require('../services/cacheService');
const ResponseFormatter = require('../core/utils/responseFormatter');
const { createError } = require('../core/utils/errorHandler');
const { logger } = require('../core/utils/logger');
const geocodingService = require('../services/geocodingService');
const autoNotificationService = require('../services/autoNotificationService');
const activityLogService = require('../services/activityLogService');

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function getUserIdFromToken(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const TokenModel = require('../core/database/models/token.model');
  const tokenData = TokenModel.get(token);
  return tokenData ? tokenData.userId : null;
}

class GroupController {
  async createGroup(req, res) {
    try {
      const { name, address, lat, lng, createdBy, visibility } = req.body || {};
      
      const sanitized = validationService.sanitizeUserInput({ name, address, createdBy, visibility });
      const validation = validationService.validateGroupData({
        name: sanitized.name,
        createdBy: sanitized.createdBy
      });

      if (!validation.valid) {
        return res.error(validation.error, 'VALIDATION_ERROR', 400);
      }

      const group = db.createGroup({ 
        name: sanitized.name, 
        address: sanitized.address || '', 
        lat: lat ? parseFloat(lat) : null, 
        lng: lng ? parseFloat(lng) : null, 
        createdBy: sanitized.createdBy, 
        visibility: sanitized.visibility || 'private' 
      });
      
      cacheService.delete(`group:${group.id}`);
      const response = { ...group, memberCount: db.getMemberCount(group.id) };

      activityLogService.logActivity(createdBy, 'group', 'create_group', {
        groupId: group.id,
        groupName: sanitized.name,
        path: req.path
      });

      const notificationService = require('../services/notificationService');
      const user = db.findUserById(createdBy);
      if (user && user.displayName) {
        await notificationService.send(createdBy, {
          title: '🎉 Grup Oluşturuldu',
          message: `"${sanitized.name}" grubu başarıyla oluşturuldu. Grup kodunuz: ${group.code}`,
          type: 'success',
          deepLink: `bavaxe://groups?groupId=${group.id}`,
          data: { groupId: group.id, groupCode: group.code, type: 'group_created' }
        }, ['database', 'onesignal']).catch(err => {
          logger.warn('Notification send error (non-critical)', { error: err.message });
        });
      }
      
      return res.success(response, 'Grup başarıyla oluşturuldu', 201);
    } catch (e) {
      logger.error('createGroup error', e);
      throw createError('Grup oluşturulamadı', 500, 'GROUP_CREATE_ERROR');
    }
  }

  // GET /api/groups/user/:userId/admin
  getGroupsByAdmin(req, res) {
    try {
      const { userId } = req.params;
      if (!userId) throw createError('userId gereklidir', 400, 'MISSING_USER_ID');
      const groups = db.getGroupsByAdmin(userId);
      
      const requestUserId = getUserIdFromToken(req);
      if (requestUserId) {
        activityLogService.logActivity(requestUserId, 'group', 'view_admin_groups', {
          targetUserId: userId,
          groupCount: groups.length,
          path: req.path
        });
      }
      
      return res.success(groups);
    } catch (e) {
      logger.error('getGroupsByAdmin error', e);
      return res.error('Gruplar alınamadı', 'GROUPS_FETCH_ERROR', 500);
    }
  }

  // GET /api/groups/:groupId/requests
  getRequests(req, res) {
    try {
      const { groupId } = req.params;
      const reqs = db.getRequests(groupId);
      
      const userId = getUserIdFromToken(req);
      if (userId) {
        activityLogService.logActivity(userId, 'group', 'view_requests', {
          groupId,
          requestCount: reqs.length,
          path: req.path
        });
      }
      
      return res.success(reqs);
    } catch (e) {
      logger.error('getRequests error', e);
      throw createError('İstekler alınamadı', 500, 'REQUESTS_FETCH_ERROR');
    }
  }

  // POST /api/groups/:groupId/requests/:requestId/approve
  async approveRequest(req, res) {
    try {
      const { groupId, requestId } = req.params;
      const approved = db.approveRequest(groupId, requestId);
      if (!approved) throw createError('İstek bulunamadı', 404, 'REQUEST_NOT_FOUND');
      
      const notificationService = require('../services/notificationService');
      const autoNotificationService = require('../services/autoNotificationService');
      const request = db.getRequest(groupId, requestId);
      const group = db.getGroupById(groupId);
      
      if (request && request.userId) {
        await notificationService.send(request.userId, {
          title: '✅ Grup İsteği Onaylandı',
          message: `"${group?.name || 'Grup'}" grubuna katılım isteğiniz onaylandı!`,
          type: 'success',
          deepLink: `bavaxe://groups?groupId=${groupId}`,
          data: { groupId, type: 'group_approved', groupName: group?.name }
        }, ['database', 'onesignal']).catch(err => {
          logger.warn('Approval notification error', { error: err.message });
        });
        
        await autoNotificationService.notifyGroupMemberAdded(groupId, group?.name || 'Grup', request.userId, req.user?.id || group.createdBy).catch(err => {
          logger.warn('Auto notification error', { error: err.message });
        });
        
        const members = db.getMembers(groupId) || [];
        const otherMembers = members.filter(m => m.userId !== request.userId);
        const newMemberName = request.displayName || 'Yeni üye';
        
        for (const member of otherMembers) {
          await notificationService.send(member.userId, {
            title: '👋 Yeni Üye Katıldı',
            message: `${newMemberName} "${group?.name || 'Grup'}" grubuna katıldı`,
            type: 'info',
            deepLink: `bavaxe://groups?groupId=${groupId}`,
            data: { groupId, type: 'member_joined', newMemberId: request.userId, newMemberName }
          }, ['database', 'onesignal']).catch(err => {
            logger.warn('Member join notification error', { error: err.message });
          });
        }
      }
      
      const adminUserId = req.user?.id || group?.createdBy;
      if (adminUserId) {
        activityLogService.logActivity(adminUserId, 'group', 'approve_request', {
          groupId,
          requestId,
          approvedUserId: request?.userId,
          path: req.path
        });
      }
      
      return res.success(null, 'İstek onaylandı');
    } catch (e) {
      logger.error('approveRequest error', e);
      return res.error('İstek onaylanamadı', 'REQUEST_APPROVE_ERROR', 500);
    }
  }

  // POST /api/groups/:groupId/requests/:requestId/reject
  async rejectRequest(req, res) {
    try {
      const { groupId, requestId } = req.params;
      const rejected = db.rejectRequest(groupId, requestId);
      if (!rejected) throw createError('İstek bulunamadı', 404, 'REQUEST_NOT_FOUND');
      
      const notificationService = require('../services/notificationService');
      const request = db.getRequest(groupId, requestId);
      if (request && request.userId) {
        await notificationService.send(request.userId, {
          title: 'Grup İsteği Reddedildi',
          message: `${db.getGroupById(groupId)?.name || 'Grup'} grubuna katılım isteğiniz reddedildi.`,
          type: 'info',
          deepLink: 'bavaxe://groups',
          data: { groupId, type: 'group_rejected' }
        }, ['database', 'onesignal']);
      }
      
      const adminUserId = req.user?.id || db.getGroupById(groupId)?.createdBy;
      if (adminUserId) {
        activityLogService.logActivity(adminUserId, 'group', 'reject_request', {
          groupId,
          requestId,
          rejectedUserId: request?.userId,
          path: req.path
        });
      }
      
      return res.success(null, 'İstek reddedildi');
    } catch (e) {
      logger.error('rejectRequest error', e);
      return res.error('İstek reddedilemedi', 'REQUEST_REJECT_ERROR', 500);
    }
  }

  // GET /api/groups/:code/info
  getGroupInfoByCode(req, res) {
    try {
      const { code } = req.params;
      const group = db.getGroupByCode(code);
      if (!group) throw createError('Grup bulunamadı', 404, 'GROUP_NOT_FOUND');
      
      const userId = getUserIdFromToken(req);
      if (userId) {
        activityLogService.logActivity(userId, 'group', 'view_group_info', {
          groupId: group.id,
          code,
          path: req.path
        });
      }
      
      return res.success({ id: group.id, code: group.code, name: group.name, memberCount: db.getMemberCount(group.id) });
    } catch (e) {
      logger.error('getGroupInfoByCode error', e);
      return res.error('Grup bilgisi alınamadı', 'GROUP_INFO_ERROR', 500);
    }
  }

  // POST /api/groups/:code/join-request
  async createJoinRequestByCode(req, res) {
    try {
      const { code } = req.params;
      const token = req.headers.authorization?.replace('Bearer ', '');
      const tokenData = db.getToken(token || '');
      if (!tokenData) return res.error('Geçersiz token', 'UNAUTHORIZED', 401);
      
      const userId = tokenData.userId;
      const user = db.findUserById(userId);
      const displayName = user?.displayName || user?.name || user?.email || 'Bir kullanıcı';
      
      const group = db.getGroupByCode(code);
      if (!group) throw createError('Grup bulunamadı', 404, 'GROUP_NOT_FOUND');
      
      const request = db.addJoinRequest(group.id, { userId, displayName });
      
      const notificationService = require('../services/notificationService');
      const members = db.getMembers(group.id) || [];
      const admins = members.filter(m => m.role === 'admin');
      
      for (const admin of admins) {
        if (admin && admin.userId) {
          await notificationService.send(admin.userId, {
            title: '🔔 Yeni Grup İsteği',
            message: `${displayName} "${group.name}" grubuna katılmak istiyor`,
            type: 'info',
            deepLink: `bavaxe://groups?groupId=${group.id}`,
            data: { groupId: group.id, requestId: request.id, type: 'group_request', requesterName: displayName, requesterId: userId }
          }, ['database', 'onesignal']).catch(err => {
            logger.warn('Notification send error (non-critical)', { error: err.message });
          });
        }
      }
      
      activityLogService.logActivity(userId, 'group', 'create_join_request', {
        groupId: group.id,
        groupCode: code,
        path: req.path
      });
      
      return res.success(request, 'Katılma isteği oluşturuldu', 201);
    } catch (e) {
      logger.error('createJoinRequestByCode error', e);
      return res.error('Katılma isteği oluşturulamadı', 'JOIN_REQUEST_ERROR', 500);
    }
  }

  // GET /api/groups/user/:userId/active
  getActiveGroupsForUser(req, res) {
    try {
      const { userId } = req.params;
      if (!userId) throw createError('userId gereklidir', 400, 'MISSING_USER_ID');
      const groups = db.getUserGroups(userId);
      
      const requestUserId = getUserIdFromToken(req);
      if (requestUserId) {
        activityLogService.logActivity(requestUserId, 'group', 'view_user_groups', {
          targetUserId: userId,
          groupCount: groups.length,
          path: req.path
        });
      }
      
      return res.success(groups);
    } catch (e) {
      console.error('getActiveGroupsForUser error', e);
      return res.error('Gruplar alınamadı', 'GROUPS_FETCH_ERROR', 500);
    }
  }

  // GET /api/groups/:groupId/members
  getMembers(req, res) {
    try {
      const { groupId } = req.params;
      const members = db.getMembers(groupId);
      
      const userId = getUserIdFromToken(req);
      if (userId) {
        activityLogService.logActivity(userId, 'group', 'view_members', {
          groupId,
          memberCount: members.length,
          path: req.path
        });
      }
      
      return res.success(members);
    } catch (e) {
      console.error('getMembers error', e);
      return res.error('Üyeler alınamadı', 'MEMBERS_FETCH_ERROR', 500);
    }
  }

  // GET /api/groups/:groupId/members-with-locations
  getMembersWithLocations(req, res) {
    try {
      const { groupId } = req.params;
      
      if (!groupId || typeof groupId !== 'string' || groupId.trim().length === 0) {
        throw createError('groupId gereklidir', 400, 'MISSING_GROUP_ID');
      }
      
      const group = db.getGroupById(groupId);
      if (!group) {
        throw createError('Grup bulunamadı', 404, 'GROUP_NOT_FOUND', { groupId });
      }

      const locationActivityService = require('../services/locationActivityService');
      const members = db.getMembers(groupId);
      const now = Date.now();
      const enriched = members.map((member) => {
        const user = db.findUserById(member.userId);
        const history = db.getStore(member.userId);
        const lastEntry = Array.isArray(history) && history.length ? history[history.length - 1] : null;
        const previousEntry = Array.isArray(history) && history.length > 1 ? history[history.length - 2] : null;
        const location = lastEntry
          ? {
              lat: lastEntry.coords?.latitude ?? null,
              lng: lastEntry.coords?.longitude ?? null,
              timestamp: lastEntry.timestamp,
              accuracy: lastEntry.coords?.accuracy ?? null,
              heading: lastEntry.coords?.heading ?? null,
              geocode: lastEntry.geocode || null,
            }
          : null;
        const isOnline = location ? now - location.timestamp <= ONLINE_WINDOW_MS : false;
        
        let activity = null;
        if (lastEntry) {
          try {
            activity = locationActivityService.detectActivityType(lastEntry, previousEntry);
          } catch (error) {
            console.error(`[GroupController] Activity detection error for ${member.userId}:`, error);
          }
        }

        return {
          userId: member.userId,
          displayName: user?.displayName || user?.name || null,
          phone: user?.phone || null,
          role: member.role,
          isOnline,
          location,
          activity: activity ? {
            type: activity.type,
            icon: activity.icon,
            name: activity.name
          } : null
        };
      });

      const userId = getUserIdFromToken(req);
      if (userId) {
        activityLogService.logActivity(userId, 'group', 'view_members_with_locations', {
          groupId,
          memberCount: enriched.length,
          path: req.path
        });
      }

      return res.success(enriched);
    } catch (e) {
      if (e.isOperational) {
        return res.error(e.message, e.code, e.statusCode);
      }
      
      console.error('getMembersWithLocations error', e);
      throw createError('Üyeler alınamadı', 500, 'MEMBERS_FETCH_ERROR', {
        groupId: req.params.groupId,
        error: process.env.NODE_ENV === 'development' ? e.message : undefined
      });
    }
  }

  // POST /api/groups/:groupId/locations
  async recordGroupLocation(req, res) {
    try {
      const { groupId } = req.params;
      const { userId, lat, lng, accuracy, heading, speed, timestamp } = req.body || {};

      if (!groupId || typeof groupId !== 'string' || groupId.trim().length === 0) {
        throw createError('groupId gereklidir', 400, 'MISSING_GROUP_ID');
      }

      if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
        throw createError('userId gereklidir', 400, 'MISSING_USER_ID');
      }

      const group = db.getGroupById(groupId);
      if (!group) {
        throw createError('Grup bulunamadı', 404, 'GROUP_NOT_FOUND', { groupId });
      }

      const isMember = db.getMembers(groupId).some((member) => member.userId === userId);
      if (!isMember) {
        throw createError('Bu grup için yetkiniz yok', 403, 'GROUP_ACCESS_DENIED', { groupId, userId });
      }

      if (lat === undefined || lng === undefined) {
        throw createError('lat ve lng gereklidir', 400, 'MISSING_COORDINATES');
      }

      const latitude = Number(lat);
      const longitude = Number(lng);
      
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw createError('Geçersiz koordinat formatı', 400, 'INVALID_COORDINATES', { lat, lng });
      }

      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw createError('Koordinatlar geçerli aralıkta değil', 400, 'COORDINATES_OUT_OF_RANGE', { lat: latitude, lng: longitude });
      }

      activityLogService.logActivity(userId, 'location', 'share_location', {
        groupId,
        lat: latitude,
        lng: longitude,
        accuracy: accuracy !== undefined ? Number(accuracy) : null,
        path: req.path
      });

      const entry = {
        timestamp: Number.isFinite(Number(timestamp)) ? Number(timestamp) : Date.now(),
        coords: {
          latitude,
          longitude,
          accuracy: accuracy !== undefined ? Number(accuracy) : null,
          heading: heading !== undefined ? Number(heading) : null,
          speed: speed !== undefined ? Number(speed) : null,
        },
      };

      try {
        const geocode = await Promise.race([
          geocodingService.getCityProvince(latitude, longitude),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
        ]);
        entry.geocode = geocode;
      } catch (err) {
        console.warn('[GroupController] Geocoding failed or timed out, continuing without city data', { error: err.message });
      }
      
      db.addToStore(userId, entry);
      
      // 30 km mesafe kontrolü ve bildirim gönderimi (async, hata olsa bile devam et)
      try {
        const groupDistanceService = require('../services/groupDistanceService');
        groupDistanceService.checkMemberDistance(groupId, userId, latitude, longitude)
          .catch(error => {
            console.error('[GroupController] Group distance check error:', error);
          });
      } catch (error) {
        console.error('[GroupController] Failed to check group distance:', error);
      }
      
      return res.success({ 
        timestamp: entry.timestamp,
        geocode: entry.geocode || null
      }, 'Konum kaydedildi');
    } catch (e) {
      if (e.isOperational) {
        return res.error(e.message, e.code, e.statusCode);
      }
      
      console.error('recordGroupLocation error', e);
      throw createError('Konum kaydedilemedi', 500, 'LOCATION_SAVE_ERROR', {
        groupId: req.params.groupId,
        error: process.env.NODE_ENV === 'development' ? e.message : undefined
      });
    }
  }

  // GET /api/groups/:groupId/locations
  getGroupLocations(req, res) {
    try {
      const { groupId } = req.params;
      
      if (!groupId || typeof groupId !== 'string' || groupId.trim().length === 0) {
        return res.error('groupId gereklidir', 'MISSING_GROUP_ID', 400);
      }

      const group = db.getGroupById(groupId);
      if (!group) {
        throw createError('Grup bulunamadı', 404, 'GROUP_NOT_FOUND', { groupId });
      }

      const members = db.getMembers(groupId) || [];
      const locations = members.map((member) => {
        const history = db.getStore(member.userId) || [];
        const latest = history.length ? history[history.length - 1] : null;
        return {
          userId: member.userId,
          groupId,
          location: latest
            ? {
                lat: latest.coords?.latitude ?? null,
                lng: latest.coords?.longitude ?? null,
                accuracy: latest.coords?.accuracy ?? null,
                heading: latest.coords?.heading ?? null,
                speed: latest.coords?.speed ?? null,
                timestamp: latest.timestamp ?? Date.now(),
                geocode: latest.geocode || null,
              }
            : null,
        };
      }).filter(item => item.location);

      return res.success({
        groupId,
        count: locations.length,
        locations: locations.map(loc => ({
          ...loc,
          location: loc.location ? {
            ...loc.location,
            geocode: loc.location.geocode || null
          } : null
        }))
      });

    } catch (e) {
      console.error('getGroupLocations error', e);
      return res.error('Konumlar alınamadı', 'LOCATIONS_FETCH_ERROR', 500);
    }
  }

  // POST /api/groups/:groupId/leave
  async leaveGroup(req, res) {
    try {
      const { groupId } = req.params;
      const { userId } = req.body || {};
      if (!userId) throw createError('userId gereklidir', 400, 'MISSING_USER_ID');
      // prevent last admin leaving
      if (db.isLastAdmin(groupId, userId)) {
        return res.error('Son admin gruptan ayrılamaz', 'LAST_ADMIN_ERROR', 400);
      }
      const group = db.getGroupById(groupId);
      const ok = db.removeMember(groupId, userId);
      if (!ok) return res.error('Üye bulunamadı', 'MEMBER_NOT_FOUND', 404);
      
      try {
        const autoNotificationService = require('../services/autoNotificationService');
        await autoNotificationService.notifyGroupActivity(groupId, 'member_left', userId, {
          groupName: group?.name || 'Grup'
        }).catch(err => {
          console.warn('[GroupController] Group activity notification error:', err);
        });
      } catch (notifError) {
        console.warn('[GroupController] Notification error (non-critical):', notifError);
      }
      
      return res.success(null, 'Gruptan ayrıldınız');
    } catch (e) {
      console.error('leaveGroup error', e);
      return res.error('Ayrılma işlemi başarısız', 'LEAVE_GROUP_ERROR', 500);
    }
  }

  // POST /api/groups/:groupId/transfer-admin
  async transferAdmin(req, res) {
    try {
      const { groupId } = req.params;
      const { currentAdminId, newAdminId } = req.body || {};
      if (!currentAdminId || !newAdminId) return res.error('Eksik bilgi', 'VALIDATION_ERROR', 400);
      const ok = db.transferAdmin(groupId, currentAdminId, newAdminId);
      if (!ok) return res.error('Adminlik devredilemedi', 'ADMIN_TRANSFER_ERROR', 400);
      
      const notificationService = require('../services/notificationService');
      const group = db.getGroupById(groupId);
      if (group) {
        await notificationService.send(newAdminId, {
          title: 'Grup Yöneticisi Oldunuz',
          message: `"${group.name}" grubunun yeni yöneticisi oldunuz.`,
          type: 'success',
          deepLink: `bavaxe://groups?groupId=${groupId}`,
          data: { groupId, type: 'admin_transferred' }
        }, ['database', 'onesignal']);
      }
      
      activityLogService.logActivity(currentAdminId, 'group', 'transfer_admin', {
        groupId,
        newAdminId,
        path: req.path
      });
      
      return res.success(null, 'Adminlik devredildi');
    } catch (e) {
      console.error('transferAdmin error', e);
      return res.error('İşlem başarısız', 'ADMIN_TRANSFER_ERROR', 500);
    }
  }

  // DELETE /api/groups/:groupId
  deleteGroup(req, res) {
    try {
      const { groupId } = req.params;
      const { adminUserId } = req.body || {};
      if (!adminUserId) return res.error('Admin yetkisi gerekli', 'VALIDATION_ERROR', 400);
      const members = db.getMembers(groupId);
      const isAdmin = members.some(m => m.userId === adminUserId && m.role === 'admin');
      if (!isAdmin) return res.error('Admin yetkisi gerekli', 'FORBIDDEN', 403);
      const ok = db.deleteGroup(groupId);
      if (!ok) return res.error('Grup bulunamadı', 'GROUP_NOT_FOUND', 404);
      
      activityLogService.logActivity(adminUserId, 'group', 'delete_group', {
        groupId,
        path: req.path
      });
      
      return res.success(null, 'Grup silindi');
    } catch (e) {
      console.error('deleteGroup error', e);
      return res.error('Grup silinemedi', 'GROUP_DELETE_ERROR', 500);
    }
  }

  // POST /api/groups/user/:userId/leave-all
  leaveAllGroups(req, res) {
    try {
      const { userId } = req.params;
      const groups = db.getUserGroups(userId);
      for (const g of groups) {
        if (!db.isLastAdmin(g.id, userId)) {
          db.removeMember(g.id, userId);
        }
      }
      
      activityLogService.logActivity(userId, 'group', 'leave_all_groups', {
        groupCount: groups.length,
        path: req.path
      });
      
      return res.success(null, 'Tüm gruplardan ayrıldınız');
    } catch (e) {
      console.error('leaveAllGroups error', e);
      return res.error('İşlem tamamlanamadı', 'LEAVE_ALL_ERROR', 500);
    }
  }

  // POST /api/user/:userId/purge
  purgeUserData(req, res) {
    try {
      const { userId } = req.params;
      // Remove user from stores (locations)
      if (db.data.store && db.data.store[userId]) {
        delete db.data.store[userId];
      }
      db.scheduleSave();
      
      const requestUserId = getUserIdFromToken(req);
      if (requestUserId) {
        activityLogService.logActivity(requestUserId, 'group', 'purge_user_data', {
          targetUserId: userId,
          path: req.path
        });
      }
      
      return res.success(null, 'Kullanıcı verileri temizlendi');
    } catch (e) {
      console.error('purgeUserData error', e);
      return res.error('Temizleme başarısız', 'PURGE_ERROR', 500);
    }
  }
}

module.exports = new GroupController();


