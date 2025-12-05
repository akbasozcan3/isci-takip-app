const db = require('../config/database');
const ResponseFormatter = require('../core/utils/responseFormatter');
const SubscriptionModel = require('../core/database/models/subscription.model');
const { getUserIdFromToken } = require('../core/middleware/auth.middleware');
const createError = require('../core/utils/errorHandler').createError;

class CrossPageController {
  async getNavigationData(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        throw createError('Kimlik doğrulaması gerekli', 401, 'UNAUTHORIZED');
      }

      const user = db.findUserById(userId);
      if (!user) {
        throw createError('Kullanıcı bulunamadı', 404, 'USER_NOT_FOUND');
      }

      const subscription = db.getUserSubscription(userId);
      const planId = subscription?.planId || 'free';
      const planLimits = SubscriptionModel.getPlanLimits(planId);

      const groups = db.getUserGroups(userId) || [];
      const activeGroups = groups.filter(g => {
        const members = db.getMembers(g.id) || [];
        return members.length > 0;
      });

      const store = db.data.store || {};
      const now = Date.now();
      const activeWindow = 15 * 60 * 1000;
      const cutoff = now - activeWindow;

      let totalActiveMembers = 0;
      let totalMembers = 0;
      let todayDistance = 0;
      const today = new Date().toDateString();

      for (const group of activeGroups) {
        const members = db.getMembers(group.id) || [];
        totalMembers += members.length;

        for (const member of members) {
          const locations = store[member.userId] || [];
          if (locations.length > 0) {
            const lastLoc = locations[locations.length - 1];
            if (lastLoc.timestamp > cutoff) {
              totalActiveMembers++;
            }

            const todayLocs = locations.filter(l => 
              new Date(l.timestamp).toDateString() === today
            );
            if (todayLocs.length > 1) {
              for (let i = 1; i < todayLocs.length; i++) {
                todayDistance += this.haversineKm(
                  todayLocs[i - 1].coords,
                  todayLocs[i].coords
                );
              }
            }
          }
        }
      }

      return res.json(ResponseFormatter.success({
        user: {
          id: user.id,
          name: user.name || user.displayName || user.email,
          email: user.email,
          planId,
          planName: planId === 'business' ? 'Business' : planId === 'plus' ? 'Plus' : 'Free'
        },
        groups: activeGroups.map(g => ({
          id: g.id,
          code: g.code,
          name: g.name,
          memberCount: db.getMemberCount(g.id),
          isAdmin: g.createdBy === userId
        })),
        stats: {
          totalGroups: activeGroups.length,
          totalMembers,
          activeMembers: totalActiveMembers,
          todayDistance: Math.round(todayDistance * 10) / 10
        },
        navigation: {
          canAccessTrack: true,
          canAccessAnalytics: planLimits.advancedAnalytics || planId !== 'free',
          canAccessGroups: true,
          canAccessLocationFeatures: true,
          canAccessAdmin: planId === 'business' || activeGroups.some(g => g.createdBy === userId)
        },
        planLimits: {
          maxGroups: planLimits.maxGroups,
          maxFamilyMembers: planLimits.maxFamilyMembers,
          maxDeliveries: planLimits.maxDeliveries,
          maxRoutes: planLimits.maxRoutes,
          performanceBoost: planLimits.performanceBoost
        }
      }));
    } catch (error) {
      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code));
      }
      console.error('Get navigation data error:', error);
      return res.status(500).json(ResponseFormatter.error('Navigasyon verisi alınamadı', 'NAVIGATION_ERROR'));
    }
  }

  async getPageContext(req, res) {
    try {
      const { page } = req.query;
      const userId = getUserIdFromToken(req);
      
      if (!userId) {
        throw createError('Kimlik doğrulaması gerekli', 401, 'UNAUTHORIZED');
      }

      const user = db.findUserById(userId);
      if (!user) {
        throw createError('Kullanıcı bulunamadı', 404, 'USER_NOT_FOUND');
      }

      const subscription = db.getUserSubscription(userId);
      const planId = subscription?.planId || 'free';
      const planLimits = SubscriptionModel.getPlanLimits(planId);

      let context = {
        user: {
          id: user.id,
          name: user.name || user.displayName || user.email,
          email: user.email
        },
        planId,
        planLimits: {
          maxGroups: planLimits.maxGroups,
          maxFamilyMembers: planLimits.maxFamilyMembers,
          maxDeliveries: planLimits.maxDeliveries,
          maxRoutes: planLimits.maxRoutes
        }
      };

      switch (page) {
        case 'track':
          const groups = db.getUserGroups(userId) || [];
          const activeGroup = groups.find(g => {
            const members = db.getMembers(g.id) || [];
            return members.some(m => m.userId === userId);
          });
          context.group = activeGroup ? {
            id: activeGroup.id,
            code: activeGroup.code,
            name: activeGroup.name,
            memberCount: db.getMemberCount(activeGroup.id)
          } : null;
          break;

        case 'analytics':
          const deviceId = req.query.deviceId || userId;
          const locations = (db.data.store || {})[deviceId] || [];
          context.hasData = locations.length > 0;
          context.deviceId = deviceId;
          break;

        case 'location-features':
          const adminGroups = groups.filter(g => g.createdBy === userId);
          context.selectedGroup = adminGroups.length > 0 ? {
            id: adminGroups[0].id,
            code: adminGroups[0].code,
            name: adminGroups[0].name
          } : null;
          context.availableGroups = adminGroups.map(g => ({
            id: g.id,
            code: g.code,
            name: g.name
          }));
          break;
      }

      return res.json(ResponseFormatter.success(context));
    } catch (error) {
      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code));
      }
      console.error('Get page context error:', error);
      return res.status(500).json(ResponseFormatter.error('Sayfa bağlamı alınamadı', 'CONTEXT_ERROR'));
    }
  }

  async shareDataBetweenPages(req, res) {
    try {
      const { sourcePage, targetPage, data } = req.body;
      const userId = getUserIdFromToken(req);
      
      if (!userId) {
        throw createError('Kimlik doğrulaması gerekli', 401, 'UNAUTHORIZED');
      }

      const validPages = ['index', 'track', 'groups', 'location-features', 'analytics', 'admin', 'settings'];
      if (!validPages.includes(sourcePage) || !validPages.includes(targetPage)) {
        throw createError('Geçersiz sayfa adı', 400, 'INVALID_PAGE');
      }

      const shareKey = `share:${userId}:${sourcePage}:${targetPage}:${Date.now()}`;
      const shareData = {
        sourcePage,
        targetPage,
        data,
        userId,
        timestamp: Date.now(),
        expiresAt: Date.now() + 5 * 60 * 1000
      };

      if (!db.data.pageShares) {
        db.data.pageShares = {};
      }
      db.data.pageShares[shareKey] = shareData;

      setTimeout(() => {
        if (db.data.pageShares && db.data.pageShares[shareKey]) {
          delete db.data.pageShares[shareKey];
        }
      }, 5 * 60 * 1000);

      return res.json(ResponseFormatter.success({
        shareKey,
        expiresAt: shareData.expiresAt
      }));
    } catch (error) {
      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code));
      }
      console.error('Share data between pages error:', error);
      return res.status(500).json(ResponseFormatter.error('Veri paylaşılamadı', 'SHARE_ERROR'));
    }
  }

  async getSharedData(req, res) {
    try {
      const { shareKey } = req.query;
      const userId = getUserIdFromToken(req);
      
      if (!userId) {
        throw createError('Kimlik doğrulaması gerekli', 401, 'UNAUTHORIZED');
      }

      if (!shareKey || !db.data.pageShares || !db.data.pageShares[shareKey]) {
        throw createError('Paylaşılan veri bulunamadı', 404, 'SHARE_NOT_FOUND');
      }

      const shareData = db.data.pageShares[shareKey];
      
      if (shareData.userId !== userId) {
        throw createError('Bu veriye erişim yetkiniz yok', 403, 'FORBIDDEN');
      }

      if (shareData.expiresAt < Date.now()) {
        delete db.data.pageShares[shareKey];
        throw createError('Paylaşılan veri süresi dolmuş', 410, 'SHARE_EXPIRED');
      }

      return res.json(ResponseFormatter.success(shareData.data));
    } catch (error) {
      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code));
      }
      console.error('Get shared data error:', error);
      return res.status(500).json(ResponseFormatter.error('Paylaşılan veri alınamadı', 'SHARE_GET_ERROR'));
    }
  }

  haversineKm(coords1, coords2) {
    if (!coords1 || !coords2) return 0;
    const R = 6371;
    const dLat = this.toRad(coords2.latitude - coords1.latitude);
    const dLon = this.toRad(coords2.longitude - coords1.longitude);
    const lat1 = this.toRad(coords1.latitude);
    const lat2 = this.toRad(coords2.latitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2) * 
              Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(deg) {
    return deg * Math.PI / 180;
  }
}

module.exports = new CrossPageController();

