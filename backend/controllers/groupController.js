// Groups Controller
const db = require('../config/database');
const validationService = require('../services/validationService');
const cacheService = require('../services/cacheService');

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

class GroupController {
  // POST /api/groups
  createGroup(req, res) {
    try {
      const { name, address, lat, lng, createdBy, visibility } = req.body || {};
      
      const sanitized = validationService.sanitizeUserInput({ name, address, createdBy, visibility });
      const validation = validationService.validateGroupData({
        name: sanitized.name,
        createdBy: sanitized.createdBy
      });

      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
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
      return res.status(201).json(response);
    } catch (e) {
      console.error('createGroup error', e);
      return res.status(500).json({ error: 'Grup oluşturulamadı' });
    }
  }

  // GET /api/groups/user/:userId/admin
  getGroupsByAdmin(req, res) {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ error: 'userId required' });
      const groups = db.getGroupsByAdmin(userId);
      return res.json(groups);
    } catch (e) {
      console.error('getGroupsByAdmin error', e);
      return res.status(500).json({ error: 'Gruplar alınamadı' });
    }
  }

  // GET /api/groups/:groupId/requests
  getRequests(req, res) {
    try {
      const { groupId } = req.params;
      const reqs = db.getRequests(groupId);
      return res.json(reqs);
    } catch (e) {
      console.error('getRequests error', e);
      return res.status(500).json({ error: 'İstekler alınamadı' });
    }
  }

  // POST /api/groups/:groupId/requests/:requestId/approve
  async approveRequest(req, res) {
    try {
      const { groupId, requestId } = req.params;
      const approved = db.approveRequest(groupId, requestId);
      if (!approved) return res.status(404).json({ error: 'İstek bulunamadı' });
      
      const notificationService = require('../services/notificationService');
      const request = db.getRequest(groupId, requestId);
      if (request && request.userId) {
        await notificationService.send(request.userId, {
          title: 'Grup İsteği Onaylandı',
          message: `${db.getGroupById(groupId)?.name || 'Grup'} grubuna katılım isteğiniz onaylandı!`,
          type: 'success',
          deepLink: `bavaxe://groups?groupId=${groupId}`,
          data: { groupId, type: 'group_approved' }
        }, ['database', 'onesignal']);
      }
      
      return res.json({ success: true });
    } catch (e) {
      console.error('approveRequest error', e);
      return res.status(500).json({ error: 'İstek onaylanamadı' });
    }
  }

  // POST /api/groups/:groupId/requests/:requestId/reject
  async rejectRequest(req, res) {
    try {
      const { groupId, requestId } = req.params;
      const rejected = db.rejectRequest(groupId, requestId);
      if (!rejected) return res.status(404).json({ error: 'İstek bulunamadı' });
      
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
      
      return res.json({ success: true });
    } catch (e) {
      console.error('rejectRequest error', e);
      return res.status(500).json({ error: 'İstek reddedilemedi' });
    }
  }

  // GET /api/groups/:code/info
  getGroupInfoByCode(req, res) {
    try {
      const { code } = req.params;
      const group = db.getGroupByCode(code);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      return res.json({ id: group.id, code: group.code, name: group.name, memberCount: db.getMemberCount(group.id) });
    } catch (e) {
      console.error('getGroupInfoByCode error', e);
      return res.status(500).json({ error: 'Grup bilgisi alınamadı' });
    }
  }

  // POST /api/groups/:code/join-request
  async createJoinRequestByCode(req, res) {
    try {
      const { code } = req.params;
      const { userId, displayName } = req.body || {};
      const group = db.getGroupByCode(code);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      if (!userId || !displayName) return res.status(400).json({ error: 'Eksik bilgi' });
      const request = db.addJoinRequest(group.id, { userId, displayName });
      
      const notificationService = require('../services/notificationService');
      const admin = db.getMembers(group.id).find(m => m.role === 'admin');
      if (admin && admin.userId) {
        await notificationService.send(admin.userId, {
          title: 'Yeni Grup İsteği',
          message: `${displayName} "${group.name}" grubuna katılmak istiyor`,
          type: 'info',
          deepLink: `bavaxe://groups?groupId=${group.id}`,
          data: { groupId: group.id, requestId: request.id, type: 'group_request' }
        }, ['database', 'onesignal']);
      }
      
      return res.status(201).json(request);
    } catch (e) {
      console.error('createJoinRequestByCode error', e);
      return res.status(500).json({ error: 'Katılma isteği oluşturulamadı' });
    }
  }

  // GET /api/groups/user/:userId/active
  getActiveGroupsForUser(req, res) {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ error: 'userId required' });
      const groups = db.getUserGroups(userId);
      return res.json(groups);
    } catch (e) {
      console.error('getActiveGroupsForUser error', e);
      return res.status(500).json({ error: 'Gruplar alınamadı' });
    }
  }

  // GET /api/groups/:groupId/members
  getMembers(req, res) {
    try {
      const { groupId } = req.params;
      const members = db.getMembers(groupId);
      return res.json(members);
    } catch (e) {
      console.error('getMembers error', e);
      return res.status(500).json({ error: 'Üyeler alınamadı' });
    }
  }

  // GET /api/groups/:groupId/members-with-locations
  getMembersWithLocations(req, res) {
    try {
      const { groupId } = req.params;
      const group = db.getGroupById(groupId);
      if (!group) {
        return res.status(404).json({ error: 'Grup bulunamadı' });
      }

      const members = db.getMembers(groupId);
      const now = Date.now();
      const enriched = members.map((member) => {
        const user = db.findUserById(member.userId);
        const history = db.getStore(member.userId);
        const lastEntry = Array.isArray(history) && history.length ? history[history.length - 1] : null;
        const location = lastEntry
          ? {
              lat: lastEntry.coords?.latitude ?? null,
              lng: lastEntry.coords?.longitude ?? null,
              timestamp: lastEntry.timestamp,
            }
          : null;
        const isOnline = location ? now - location.timestamp <= ONLINE_WINDOW_MS : false;

        return {
          userId: member.userId,
          displayName: user?.displayName || user?.name || null,
          phone: user?.phone || null,
          role: member.role,
          isOnline,
          location,
        };
      });

      return res.json(enriched);
    } catch (e) {
      console.error('getMembersWithLocations error', e);
      return res.status(500).json({ error: 'Üyeler alınamadı' });
    }
  }

  // POST /api/groups/:groupId/locations
  recordGroupLocation(req, res) {
    try {
      const { groupId } = req.params;
      const { userId, lat, lng, accuracy, heading, speed, timestamp } = req.body || {};

      if (!groupId || !userId) {
        return res.status(400).json({ error: 'groupId ve userId gereklidir' });
      }

      const group = db.getGroupById(groupId);
      if (!group) {
        return res.status(404).json({ error: 'Grup bulunamadı' });
      }

      const isMember = db.getMembers(groupId).some((member) => member.userId === userId);
      if (!isMember) {
        return res.status(403).json({ error: 'Bu grup için yetkiniz yok' });
      }

      if (lat === undefined || lng === undefined) {
        return res.status(400).json({ error: 'lat ve lng gereklidir' });
      }

      const latitude = Number(lat);
      const longitude = Number(lng);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return res.status(400).json({ error: 'Geçersiz koordinatlar' });
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
      return res.json({ success: true, timestamp: entry.timestamp });
    } catch (e) {
      console.error('recordGroupLocation error', e);
      return res.status(500).json({ error: 'Konum kaydedilemedi' });
    }
  }

  // POST /api/groups/:groupId/leave
  leaveGroup(req, res) {
    try {
      const { groupId } = req.params;
      const { userId } = req.body || {};
      if (!userId) return res.status(400).json({ error: 'userId required' });
      // prevent last admin leaving
      if (db.isLastAdmin(groupId, userId)) {
        return res.status(400).json({ error: 'last admin cannot leave' });
      }
      const ok = db.removeMember(groupId, userId);
      if (!ok) return res.status(404).json({ error: 'not a member' });
      return res.json({ success: true });
    } catch (e) {
      console.error('leaveGroup error', e);
      return res.status(500).json({ error: 'Ayrılma işlemi başarısız' });
    }
  }

  // POST /api/groups/:groupId/transfer-admin
  async transferAdmin(req, res) {
    try {
      const { groupId } = req.params;
      const { currentAdminId, newAdminId } = req.body || {};
      if (!currentAdminId || !newAdminId) return res.status(400).json({ error: 'Eksik bilgi' });
      const ok = db.transferAdmin(groupId, currentAdminId, newAdminId);
      if (!ok) return res.status(400).json({ error: 'Adminlik devredilemedi' });
      
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
      
      return res.json({ success: true });
    } catch (e) {
      console.error('transferAdmin error', e);
      return res.status(500).json({ error: 'İşlem başarısız' });
    }
  }

  // DELETE /api/groups/:groupId
  deleteGroup(req, res) {
    try {
      const { groupId } = req.params;
      const { adminUserId } = req.body || {};
      if (!adminUserId) return res.status(400).json({ error: 'admin access required' });
      const members = db.getMembers(groupId);
      const isAdmin = members.some(m => m.userId === adminUserId && m.role === 'admin');
      if (!isAdmin) return res.status(403).json({ error: 'admin access required' });
      const ok = db.deleteGroup(groupId);
      if (!ok) return res.status(404).json({ error: 'Grup bulunamadı' });
      return res.json({ success: true });
    } catch (e) {
      console.error('deleteGroup error', e);
      return res.status(500).json({ error: 'Grup silinemedi' });
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
      return res.json({ success: true });
    } catch (e) {
      console.error('leaveAllGroups error', e);
      return res.status(500).json({ error: 'İşlem tamamlanamadı' });
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
      return res.json({ success: true });
    } catch (e) {
      console.error('purgeUserData error', e);
      return res.status(500).json({ error: 'Temizleme başarısız' });
    }
  }
}

module.exports = new GroupController();


