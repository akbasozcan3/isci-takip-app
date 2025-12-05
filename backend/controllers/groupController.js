const db = require('../config/database');
const validationService = require('../services/validationService');
const cacheService = require('../services/cacheService');
const ResponseFormatter = require('../core/utils/responseFormatter');
const { createError } = require('../core/utils/errorHandler');

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

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
          console.warn('[GroupController] Notification send error (non-critical):', err);
        });
      }
      
      return res.success(response, 'Grup başarıyla oluşturuldu', 201);
    } catch (e) {
      console.error('createGroup error', e);
      throw createError('Grup oluşturulamadı', 500, 'GROUP_CREATE_ERROR');
    }
  }

  // GET /api/groups/user/:userId/admin
  getGroupsByAdmin(req, res) {
    try {
      const { userId } = req.params;
      if (!userId) throw createError('userId gereklidir', 400, 'MISSING_USER_ID');
      const groups = db.getGroupsByAdmin(userId);
      return res.success(groups);
    } catch (e) {
      console.error('getGroupsByAdmin error', e);
      return res.error('Gruplar alınamadı', 'GROUPS_FETCH_ERROR', 500);
    }
  }

  // GET /api/groups/:groupId/requests
  getRequests(req, res) {
    try {
      const { groupId } = req.params;
      const reqs = db.getRequests(groupId);
      return res.success(reqs);
    } catch (e) {
      console.error('getRequests error', e);
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
          console.warn('[GroupController] Approval notification error:', err);
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
            console.warn('[GroupController] Member join notification error:', err);
          });
        }
      }
      
      return res.success(null, 'İstek onaylandı');
    } catch (e) {
      console.error('approveRequest error', e);
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
      
      return res.success(null, 'İstek reddedildi');
    } catch (e) {
      console.error('rejectRequest error', e);
      return res.error('İstek reddedilemedi', 'REQUEST_REJECT_ERROR', 500);
    }
  }

  // GET /api/groups/:code/info
  getGroupInfoByCode(req, res) {
    try {
      const { code } = req.params;
      const group = db.getGroupByCode(code);
      if (!group) throw createError('Grup bulunamadı', 404, 'GROUP_NOT_FOUND');
      return res.success({ id: group.id, code: group.code, name: group.name, memberCount: db.getMemberCount(group.id) });
    } catch (e) {
      console.error('getGroupInfoByCode error', e);
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
            console.warn('[GroupController] Notification send error (non-critical):', err);
          });
        }
      }
      
      return res.success(request, 'Katılma isteği oluşturuldu', 201);
    } catch (e) {
      console.error('createJoinRequestByCode error', e);
      return res.error('Katılma isteği oluşturulamadı', 'JOIN_REQUEST_ERROR', 500);
    }
  }

  // GET /api/groups/user/:userId/active
  getActiveGroupsForUser(req, res) {
    try {
      const { userId } = req.params;
      if (!userId) throw createError('userId gereklidir', 400, 'MISSING_USER_ID');
      const groups = db.getUserGroups(userId);
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
      const group = db.getGroupById(groupId);
      if (!group) {
        throw createError('Grup bulunamadı', 404, 'GROUP_NOT_FOUND');
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

      return res.success(enriched);
    } catch (e) {
      console.error('getMembersWithLocations error', e);
      return res.error('Üyeler alınamadı', 'MEMBERS_FETCH_ERROR', 500);
    }
  }

  // POST /api/groups/:groupId/locations
  recordGroupLocation(req, res) {
    try {
      const { groupId } = req.params;
      const { userId, lat, lng, accuracy, heading, speed, timestamp } = req.body || {};

      if (!groupId || !userId) {
        throw createError('groupId ve userId gereklidir', 400, 'MISSING_PARAMS');
      }

      const group = db.getGroupById(groupId);
      if (!group) {
        throw createError('Grup bulunamadı', 404, 'GROUP_NOT_FOUND');
      }

      const isMember = db.getMembers(groupId).some((member) => member.userId === userId);
      if (!isMember) {
        return res.error('Bu grup için yetkiniz yok', 'FORBIDDEN', 403);
      }

      if (lat === undefined || lng === undefined) {
        return res.error('lat ve lng gereklidir', 'VALIDATION_ERROR', 400);
      }

      const latitude = Number(lat);
      const longitude = Number(lng);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw createError('Geçersiz koordinatlar', 400, 'INVALID_COORDINATES');
      }

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
      
      return res.success({ timestamp: entry.timestamp }, 'Konum kaydedildi');
    } catch (e) {
      console.error('recordGroupLocation error', e);
      return res.error('Konum kaydedilemedi', 'LOCATION_SAVE_ERROR', 500);
    }
  }

  // GET /api/groups/:groupId/locations
  getGroupLocations(req, res) {
    try {
      const { groupId } = req.params;
      if (!groupId) {
        return res.error('groupId gereklidir', 'VALIDATION_ERROR', 400);
      }

      const group = db.getGroupById(groupId);
      if (!group) {
        throw createError('Grup bulunamadı', 404, 'GROUP_NOT_FOUND');
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
              }
            : null,
        };
      }).filter(item => item.location);

      return res.success({
        groupId,
        count: locations.length,
        locations,
      });
    } catch (e) {
      console.error('getGroupLocations error', e);
      return res.error('Konumlar alınamadı', 'LOCATIONS_FETCH_ERROR', 500);
    }
  }

  // POST /api/groups/:groupId/leave
  leaveGroup(req, res) {
    try {
      const { groupId } = req.params;
      const { userId } = req.body || {};
      if (!userId) throw createError('userId gereklidir', 400, 'MISSING_USER_ID');
      // prevent last admin leaving
      if (db.isLastAdmin(groupId, userId)) {
        return res.error('Son admin gruptan ayrılamaz', 'LAST_ADMIN_ERROR', 400);
      }
      const ok = db.removeMember(groupId, userId);
      if (!ok) return res.error('Üye bulunamadı', 'MEMBER_NOT_FOUND', 404);
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
      return res.success(null, 'Kullanıcı verileri temizlendi');
    } catch (e) {
      console.error('purgeUserData error', e);
      return res.error('Temizleme başarısız', 'PURGE_ERROR', 500);
    }
  }
}

module.exports = new GroupController();


