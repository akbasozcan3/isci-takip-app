const db = require('../config/database');
const ResponseFormatter = require('../core/utils/responseFormatter');
const { createError } = require('../core/utils/errorHandler');

function getUserIdFromToken(req) {
  if (req.user && req.user.id) {
    return req.user.id;
  }
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const tokenData = db.getToken(token);
  return tokenData ? tokenData.userId : null;
}

class StepController {
  async storeSteps(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }
      const { steps, timestamp, distance, calories, duration } = req.body || {};

      if (steps === undefined || steps === null) {
        return res.status(400).json(ResponseFormatter.error('Adım sayısı gereklidir', 'MISSING_STEPS'));
      }

      const stepCount = parseInt(steps);
      if (!Number.isFinite(stepCount) || stepCount < 0) {
        return res.status(400).json(ResponseFormatter.error('Geçersiz adım sayısı', 'INVALID_STEPS'));
      }

      const stepData = {
        timestamp: timestamp || Date.now(),
        steps: stepCount,
        distance: distance ? parseFloat(distance) : (stepCount * 0.762 / 1000),
        calories: calories ? parseFloat(calories) : (stepCount * 0.04),
        duration: duration ? parseInt(duration) : null,
      };

      if (!db.data.steps) {
        db.data.steps = {};
      }

      if (!db.data.steps[userId]) {
        db.data.steps[userId] = [];
      }

      const today = new Date(stepData.timestamp);
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const existingIndex = db.data.steps[userId].findIndex(
        (entry) => entry.date === todayKey
      );

      const previousSteps = existingIndex >= 0 ? db.data.steps[userId][existingIndex].steps : 0;

      if (existingIndex >= 0) {
        const existing = db.data.steps[userId][existingIndex];
        db.data.steps[userId][existingIndex] = {
          ...existing,
          steps: Math.max(stepCount, existing.steps || 0),
          distance: stepData.distance !== null ? stepData.distance : (existing.distance || stepData.distance),
          calories: stepData.calories !== null ? stepData.calories : (existing.calories || stepData.calories),
          duration: stepData.duration !== null ? stepData.duration : (existing.duration || stepData.duration),
          lastUpdated: stepData.timestamp,
          syncCount: (existing.syncCount || 0) + 1,
        };
      } else {
        db.data.steps[userId].push({
          date: todayKey,
          steps: stepCount,
          distance: stepData.distance,
          calories: stepData.calories,
          duration: stepData.duration,
          lastUpdated: stepData.timestamp,
          syncCount: 1,
        });
      }

      db.data.steps[userId].sort((a, b) => new Date(b.date) - new Date(a.date));

      if (db.data.steps[userId].length > 365) {
        db.data.steps[userId] = db.data.steps[userId].slice(0, 365);
      }

      const activityLogService = require('../services/activityLogService');
      activityLogService.logActivity(userId, 'steps', 'store_steps', {
        steps: stepCount,
        distance: stepData.distance,
        calories: stepData.calories,
        path: req.path
      });

      const goal = this.getUserGoal(userId);
      const achievements = this.checkAchievements(userId, stepCount, stepData.distance || 0);
      const streak = this.updateStreak(userId, todayKey);

      if (goal && goal > 0) {
        if (previousSteps < goal && stepCount >= goal) {
          const notificationService = require('../services/notificationService');
          await notificationService.send(userId, {
            title: '🎉 Hedef Tamamlandı!',
            message: `Tebrikler! ${goal.toLocaleString('tr-TR')} adım hedefinize ulaştınız.`,
            type: 'success',
            deepLink: 'bavaxe://steps',
            data: {
              type: 'step_goal_achieved',
              steps: stepCount,
              goal: goal
            }
          }, ['database', 'onesignal']).catch(err => {
            console.error('Goal notification error:', err);
          });
        } else if (stepCount > 0 && stepCount % 1000 === 0 && previousSteps < stepCount) {
          const notificationService = require('../services/notificationService');
          await notificationService.send(userId, {
            title: '🏃 Adım Milestone',
            message: `${stepCount.toLocaleString('tr-TR')} adım tamamlandı! Devam edin!`,
            type: 'info',
            deepLink: 'bavaxe://steps',
            data: {
              type: 'step_milestone',
              steps: stepCount
            }
          }, ['database', 'onesignal']).catch(err => {
            console.error('Milestone notification error:', err);
          });
        } else if (goal > 0 && stepCount >= goal * 0.5 && previousSteps < goal * 0.5) {
          const notificationService = require('../services/notificationService');
          await notificationService.send(userId, {
            title: '💪 Yarı Yoldasınız!',
            message: `Hedefinizin %50'sine ulaştınız. Devam edin!`,
            type: 'info',
            deepLink: 'bavaxe://steps',
            data: {
              type: 'step_halfway',
              steps: stepCount,
              goal: goal
            }
          }, ['database', 'onesignal']).catch(err => {
            console.error('Halfway notification error:', err);
          });
        }
      }

      if (achievements.length > 0) {
        const notificationService = require('../services/notificationService');
        for (const achievement of achievements) {
          await notificationService.send(userId, {
            title: `🏆 ${achievement.title}`,
            message: achievement.message,
            type: 'success',
            deepLink: 'bavaxe://steps',
            data: {
              type: 'achievement_unlocked',
              achievementId: achievement.id
            }
          }, ['database', 'onesignal']).catch(err => {
            console.error('Achievement notification error:', err);
          });
        }
      }

      db.scheduleSave();

      return res.json(ResponseFormatter.success({
        steps: stepCount,
        date: todayKey,
        timestamp: stepData.timestamp,
        goal: goal || null,
        goalAchieved: goal && stepCount >= goal,
        achievements: achievements,
        streak: streak
      }, 'Adım verileri kaydedildi'));
    } catch (error) {
      console.error('Store steps error:', error);
      return res.status(500).json(ResponseFormatter.error('Adım verileri kaydedilemedi', 'STORAGE_ERROR'));
    }
  }

  checkAchievements(userId, steps, distance) {
    if (!db.data.stepAchievements) {
      db.data.stepAchievements = {};
    }
    if (!db.data.stepAchievements[userId]) {
      db.data.stepAchievements[userId] = [];
    }

    const newlyUnlocked = [];
    const achievements = [
      { id: 'first_1000', title: 'İlk 1000 Adım', message: 'İlk 1000 adımınızı tamamladınız!', threshold: 1000 },
      { id: 'first_5000', title: 'İlk 5000 Adım', message: '5000 adım hedefine ulaştınız!', threshold: 5000 },
      { id: 'first_10000', title: 'İlk 10000 Adım', message: '10000 adım hedefine ulaştınız!', threshold: 10000 },
      { id: 'first_km', title: 'İlk Kilometre', message: 'İlk kilometrenizi tamamladınız!', threshold: 0, distanceThreshold: 1 },
      { id: 'first_5km', title: '5 Kilometre', message: '5 kilometre mesafe katettiniz!', threshold: 0, distanceThreshold: 5 },
      { id: 'first_10km', title: '10 Kilometre', message: '10 kilometre mesafe katettiniz!', threshold: 0, distanceThreshold: 10 },
      { id: 'week_streak_7', title: '7 Gün Serisi', message: '7 gün üst üste hedefinize ulaştınız!', threshold: 0, streakThreshold: 7 },
      { id: 'week_streak_30', title: '30 Gün Serisi', message: '30 gün üst üste hedefinize ulaştınız!', threshold: 0, streakThreshold: 30 },
    ];

    const goal = this.getUserGoal(userId);
    const userAchievements = db.data.stepAchievements[userId];

    for (const achievement of achievements) {
      if (userAchievements.includes(achievement.id)) {
        continue;
      }

      let shouldUnlock = false;
      if (achievement.threshold > 0 && steps >= achievement.threshold) {
        shouldUnlock = true;
      } else if (achievement.distanceThreshold && distance >= achievement.distanceThreshold) {
        shouldUnlock = true;
      } else if (achievement.streakThreshold) {
        const streak = this.getCurrentStreak(userId);
        if (streak >= achievement.streakThreshold && goal && steps >= goal) {
          shouldUnlock = true;
        }
      }

      if (shouldUnlock) {
        userAchievements.push(achievement.id);
        newlyUnlocked.push({
          id: achievement.id,
          title: achievement.title,
          message: achievement.message
        });
      }
    }

    return newlyUnlocked;
  }

  updateStreak(userId, todayKey) {
    if (!db.data.stepStreaks) {
      db.data.stepStreaks = {};
    }
    if (!db.data.stepStreaks[userId]) {
      db.data.stepStreaks[userId] = {
        current: 0,
        longest: 0,
        lastDate: null
      };
    }

    const goal = this.getUserGoal(userId);
    if (!goal || goal <= 0) {
      return db.data.stepStreaks[userId];
    }

    const streak = db.data.stepStreaks[userId];
    const today = new Date(todayKey);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    if (!db.data.steps || !db.data.steps[userId]) {
      return streak;
    }

    const todayData = db.data.steps[userId].find(e => e.date === todayKey);
    if (!todayData || todayData.steps < goal) {
      return streak;
    }

    if (streak.lastDate === todayKey) {
      return streak;
    }

    if (streak.lastDate === yesterdayKey) {
      streak.current += 1;
    } else if (streak.lastDate && streak.lastDate !== yesterdayKey) {
      streak.current = 1;
    } else {
      streak.current = 1;
    }

    if (streak.current > streak.longest) {
      streak.longest = streak.current;
    }

    streak.lastDate = todayKey;
    return streak;
  }

  getCurrentStreak(userId) {
    if (!db.data.stepStreaks || !db.data.stepStreaks[userId]) {
      return 0;
    }
    return db.data.stepStreaks[userId].current || 0;
  }

  getUserGoal(userId) {
    if (!db.data.stepGoals) {
      db.data.stepGoals = {};
    }
    return db.data.stepGoals[userId] || null;
  }

  async setGoal(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }
      const { goal } = req.body || {};

      if (goal === undefined || goal === null) {
        return res.status(400).json(ResponseFormatter.error('Hedef gereklidir', 'MISSING_GOAL'));
      }

      const goalValue = parseInt(goal);
      if (!Number.isFinite(goalValue) || goalValue < 0) {
        return res.status(400).json(ResponseFormatter.error('Geçersiz hedef değeri', 'INVALID_GOAL'));
      }

      if (goalValue > 100000) {
        return res.status(400).json(ResponseFormatter.error('Hedef 100.000 adımdan fazla olamaz', 'GOAL_TOO_HIGH'));
      }

      if (!db.data.stepGoals) {
        db.data.stepGoals = {};
      }

      db.data.stepGoals[userId] = goalValue;
      db.scheduleSave();

      const activityLogService = require('../services/activityLogService');
      activityLogService.logActivity(userId, 'steps', 'set_goal', {
        goal: goalValue,
        path: req.path
      });

      return res.json(ResponseFormatter.success({
        goal: goalValue
      }, 'Hedef kaydedildi'));
    } catch (error) {
      console.error('Set goal error:', error);
      return res.status(500).json(ResponseFormatter.error('Hedef kaydedilemedi', 'STORAGE_ERROR'));
    }
  }

  async deleteGoal(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      if (!db.data.stepGoals) {
        db.data.stepGoals = {};
      }

      if (db.data.stepGoals[userId]) {
        delete db.data.stepGoals[userId];
        db.scheduleSave();

        const activityLogService = require('../services/activityLogService');
        activityLogService.logActivity(userId, 'steps', 'delete_goal', {
          path: req.path
        });

        return res.json(ResponseFormatter.success({
          goal: null
        }, 'Hedef silindi'));
      } else {
        return res.json(ResponseFormatter.success({
          goal: null
        }, 'Hedef zaten yok'));
      }
    } catch (error) {
      console.error('Delete goal error:', error);
      return res.status(500).json(ResponseFormatter.error('Hedef silinemedi', 'STORAGE_ERROR'));
    }
  }

  async getGoal(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      const goal = this.getUserGoal(userId);

      const activityLogService = require('../services/activityLogService');
      activityLogService.logActivity(userId, 'steps', 'view_goal', {
        path: req.path
      });

      return res.json(ResponseFormatter.success({
        goal: goal
      }));
    } catch (error) {
      console.error('Get goal error:', error);
      return res.status(500).json(ResponseFormatter.error('Hedef alınamadı', 'FETCH_ERROR'));
    }
  }

  async getTodaySteps(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }
      
      if (!db.data.steps || !db.data.steps[userId]) {
        const goal = this.getUserGoal(userId);
        const streakData = db.data.stepStreaks && db.data.stepStreaks[userId] ? db.data.stepStreaks[userId] : { current: 0, longest: 0, lastDate: null };
        return res.json(ResponseFormatter.success({
          steps: 0,
          distance: 0,
          calories: 0,
          duration: 0,
          date: new Date().toISOString().split('T')[0],
          goal: goal,
          streak: {
            current: streakData.current || 0,
            longest: streakData.longest || 0,
            lastDate: streakData.lastDate || null
          }
        }));
      }

      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const todayData = db.data.steps[userId].find((entry) => entry.date === todayKey);
      const goal = this.getUserGoal(userId);
      const streakData = db.data.stepStreaks && db.data.stepStreaks[userId] ? db.data.stepStreaks[userId] : { current: 0, longest: 0, lastDate: null };

      const activityLogService = require('../services/activityLogService');
      activityLogService.logActivity(userId, 'steps', 'view_today_steps', {
        path: req.path
      });

      const result = {
        ...(todayData || {
          steps: 0,
          distance: 0,
          calories: 0,
          duration: 0,
          date: todayKey,
        }),
        goal: goal,
        streak: {
          current: streakData.current || 0,
          longest: streakData.longest || 0,
          lastDate: streakData.lastDate || null
        }
      };

      return res.json(ResponseFormatter.success(result));
    } catch (error) {
      console.error('Get today steps error:', error);
      return res.status(500).json(ResponseFormatter.error('Adım verileri alınamadı', 'FETCH_ERROR'));
    }
  }

  async getStepsHistory(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }
      const { days = 30 } = req.query;

      if (!db.data.steps || !db.data.steps[userId]) {
        return res.json(ResponseFormatter.success([]));
      }

      const limit = Math.min(parseInt(days) || 30, 365);
      const history = db.data.steps[userId].slice(0, limit);

      const activityLogService = require('../services/activityLogService');
      activityLogService.logActivity(userId, 'steps', 'view_history', {
        days: limit,
        path: req.path
      });

      return res.json(ResponseFormatter.success(history));
    } catch (error) {
      console.error('Get steps history error:', error);
      return res.status(500).json(ResponseFormatter.error('Adım geçmişi alınamadı', 'FETCH_ERROR'));
    }
  }

  async getStepsStats(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }
      const { period = 'week' } = req.query;

      if (!db.data.steps || !db.data.steps[userId]) {
        return res.json(ResponseFormatter.success({
          totalSteps: 0,
          averageSteps: 0,
          totalDistance: 0,
          totalCalories: 0,
          period,
          bestDay: null,
          trend: 'stable'
        }));
      }

      const now = new Date();
      let startDate;
      
      if (period === 'week') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'month') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else {
        startDate = new Date(0);
      }

      const filtered = db.data.steps[userId].filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate >= startDate;
      });

      const totalSteps = filtered.reduce((sum, entry) => sum + (entry.steps || 0), 0);
      const totalDistance = filtered.reduce((sum, entry) => sum + (entry.distance || 0), 0);
      const totalCalories = filtered.reduce((sum, entry) => sum + (entry.calories || 0), 0);
      const averageSteps = filtered.length > 0 ? Math.round(totalSteps / filtered.length) : 0;

      let bestDay = null;
      if (filtered.length > 0) {
        bestDay = filtered.reduce((best, entry) => {
          return (entry.steps || 0) > (best.steps || 0) ? entry : best;
        }, filtered[0]);
      }

      let trend = 'stable';
      if (filtered.length >= 7) {
        const firstHalf = filtered.slice(0, Math.floor(filtered.length / 2));
        const secondHalf = filtered.slice(Math.floor(filtered.length / 2));
        const firstAvg = firstHalf.reduce((sum, e) => sum + (e.steps || 0), 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, e) => sum + (e.steps || 0), 0) / secondHalf.length;
        if (secondAvg > firstAvg * 1.1) {
          trend = 'increasing';
        } else if (secondAvg < firstAvg * 0.9) {
          trend = 'decreasing';
        }
      }

      return res.json(ResponseFormatter.success({
        totalSteps,
        averageSteps,
        totalDistance: Math.round(totalDistance * 100) / 100,
        totalCalories: Math.round(totalCalories * 100) / 100,
        days: filtered.length,
        period,
        bestDay: bestDay ? {
          date: bestDay.date,
          steps: bestDay.steps,
          distance: bestDay.distance
        } : null,
        trend
      }));

    } catch (error) {
      console.error('Get steps stats error:', error);
      return res.status(500).json(ResponseFormatter.error('İstatistikler alınamadı', 'FETCH_ERROR'));
    }
  }

  async getAchievements(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      if (!db.data.stepAchievements || !db.data.stepAchievements[userId]) {
        const activityLogService = require('../services/activityLogService');
        activityLogService.logActivity(userId, 'steps', 'view_achievements', {
          path: req.path
        });
        return res.json(ResponseFormatter.success([]));
      }

      const activityLogService = require('../services/activityLogService');
      activityLogService.logActivity(userId, 'steps', 'view_achievements', {
        path: req.path
      });

      return res.json(ResponseFormatter.success(db.data.stepAchievements[userId]));
    } catch (error) {
      console.error('Get achievements error:', error);
      return res.status(500).json(ResponseFormatter.error('Başarılar alınamadı', 'FETCH_ERROR'));
    }
  }

  async getStreak(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      if (!db.data.stepStreaks || !db.data.stepStreaks[userId]) {
        const activityLogService = require('../services/activityLogService');
        activityLogService.logActivity(userId, 'steps', 'view_streak', {
          path: req.path
        });
        return res.json(ResponseFormatter.success({
          current: 0,
          longest: 0,
          lastDate: null
        }));
      }

      const activityLogService = require('../services/activityLogService');
      activityLogService.logActivity(userId, 'steps', 'view_streak', {
        path: req.path
      });

      return res.json(ResponseFormatter.success(db.data.stepStreaks[userId]));
    } catch (error) {
      console.error('Get streak error:', error);
      return res.status(500).json(ResponseFormatter.error('Seri alınamadı', 'FETCH_ERROR'));
    }
  }

  async startTracking(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      console.log(`[StepController] 🚀 Starting tracking for user: ${userId}`);

      // Check if user has OneSignal player ID
      const user = db.findUserById(userId);
      const playerId = user?.onesignalPlayerId || db.getUserOnesignalPlayerId(userId);
      console.log(`[StepController] 🔍 User OneSignal Player ID: ${playerId || 'NOT SET'}`);
      
      if (!playerId) {
        console.warn(`[StepController] ⚠️ User ${userId} does not have OneSignal Player ID - notification may not be delivered`);
      }

      // Use professional step notification service
      const stepNotificationService = require('../services/stepNotificationService');
      
      console.log(`[StepController] 📤 Sending start notification to user ${userId}`);

      let notificationResult = [];
      try {
        const result = await stepNotificationService.notifyTrackingStart(userId);
        notificationResult = result.channels || [];
        
        if (result.success) {
          console.log(`[StepController] ✅ Start notification sent successfully`);
        } else {
          console.warn(`[StepController] ⚠️ Start notification partially failed:`, result.error);
        }
      } catch (err) {
        console.error(`[StepController] ❌ Start tracking notification error:`, err.message || err);
        notificationResult = [];
      }

      const onesignalResult = notificationResult.find(r => r.channel === 'onesignal');
      const databaseResult = notificationResult.find(r => r.channel === 'database');
      
      const onesignalSuccess = onesignalResult?.success || false;
      const databaseSuccess = databaseResult?.success || false;

      const activityLogService = require('../services/activityLogService');
      activityLogService.logActivity(userId, 'steps', 'start_tracking', {
        path: req.path
      });

      return res.json(ResponseFormatter.success({
        started: true,
        timestamp: Date.now(),
        notificationSent: onesignalSuccess || databaseSuccess,
        notificationChannels: notificationResult
      }, 'Adım takibi başlatıldı'));
    } catch (error) {
      console.error('[StepController] Start tracking error:', error);
      return res.status(500).json(ResponseFormatter.error('Takip başlatılamadı', 'TRACKING_START_ERROR'));
    }
  }

  async stopTracking(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      console.log(`[StepController] 🛑 Stopping tracking for user: ${userId}`);

      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      let todaySteps = 0;
      if (db.data.steps && db.data.steps[userId]) {
        const todayEntry = db.data.steps[userId].find(e => e.date === todayKey);
        if (todayEntry) {
          todaySteps = todayEntry.steps || 0;
        }
      }

      // Check if user has OneSignal player ID
      const user = db.findUserById(userId);
      const playerId = user?.onesignalPlayerId || db.getUserOnesignalPlayerId(userId);
      console.log(`[StepController] 🔍 User OneSignal Player ID: ${playerId || 'NOT SET'}`);
      
      if (!playerId) {
        console.warn(`[StepController] ⚠️ User ${userId} does not have OneSignal Player ID - notification may not be delivered`);
      }

      // Use professional step notification service
      const stepNotificationService = require('../services/stepNotificationService');
      
      console.log(`[StepController] 📤 Sending stop notification to user ${userId} (${todaySteps} steps)`);

      let notificationResult = [];
      try {
        const result = await stepNotificationService.notifyTrackingStop(userId, todaySteps);
        notificationResult = result.channels || [];
        
        if (result.success) {
          console.log(`[StepController] ✅ Stop notification sent successfully`);
        } else {
          console.warn(`[StepController] ⚠️ Stop notification partially failed:`, result.error);
        }
      } catch (err) {
        console.error(`[StepController] ❌ Stop tracking notification error:`, err.message || err);
        notificationResult = [];
      }

      const onesignalResult = notificationResult.find(r => r.channel === 'onesignal');
      const databaseResult = notificationResult.find(r => r.channel === 'database');
      
      const onesignalSuccess = onesignalResult?.success || false;
      const databaseSuccess = databaseResult?.success || false;

      const activityLogService = require('../services/activityLogService');
      activityLogService.logActivity(userId, 'steps', 'stop_tracking', {
        todaySteps,
        path: req.path
      });

      return res.json(ResponseFormatter.success({
        stopped: true,
        timestamp: Date.now(),
        todaySteps: todaySteps,
        notificationSent: onesignalSuccess || databaseSuccess,
        notificationChannels: notificationResult
      }, 'Adım takibi durduruldu'));
    } catch (error) {
      console.error('[StepController] Stop tracking error:', error);
      return res.status(500).json(ResponseFormatter.error('Takip durdurulamadı', 'TRACKING_STOP_ERROR'));
    }
  }
}

module.exports = new StepController();
